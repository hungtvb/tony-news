import assert from "node:assert/strict";
import test from "node:test";

import {
  isRetryablePersistenceError,
  isUniqueViolation,
  persistArticleSnapshotWithRetry,
  postgresErrorCode,
} from "./node-postgres.ts";
import type {
  ArticlePersistenceRepository,
  ArticlePersistenceTransaction,
  ArticleSnapshot,
  PersistArticleResult,
} from "./persistence.ts";

function snapshot(): ArticleSnapshot {
  return {
    sourceId: "tto-tech",
    sourceArticleId: "retry-test-article",
    canonicalUrl: "https://tuoitre.vn/retry-test.htm",
    title: "Retry policy test article",
    authorStatus: "unknown",
    contentHash: "retry-test-hash",
    normalizedText: "Deterministic persistence retry test content.",
    textLength: 45,
    paragraphCount: 1,
    extractionStrategy: "test-fixture",
    qualityDecision: "ready",
    observedAt: new Date("2026-08-05T00:00:00Z"),
  };
}

function wrappedPostgresError(code: string, message = code): Error {
  const postgresError = Object.assign(new Error(message), { code });
  return new Error("Drizzle query failed", { cause: postgresError });
}

function scriptedRepository(failures: readonly unknown[]): {
  repository: ArticlePersistenceRepository;
  attempts(): number;
  result: PersistArticleResult;
} {
  let attempts = 0;
  const result: PersistArticleResult = {
    outcome: "created",
    articleId: "article-1",
    versionNumber: 1,
  };

  const repository: ArticlePersistenceRepository = {
    transaction: async <T>(
      _operation: (transaction: ArticlePersistenceTransaction) => Promise<T>,
    ): Promise<T> => {
      attempts += 1;
      const failure = failures[attempts - 1];
      if (failure !== undefined) throw failure;
      return result as T;
    },
  };

  return {
    repository,
    attempts: () => attempts,
    result,
  };
}

test("extracts PostgreSQL codes through wrapped Drizzle causes", () => {
  const error = wrappedPostgresError("40P01", "deadlock detected");

  assert.equal(postgresErrorCode(error), "40P01");
});

test("classifies only reviewed persistence transaction errors as retryable", () => {
  for (const code of ["23505", "40001", "40P01"]) {
    assert.equal(
      isRetryablePersistenceError(wrappedPostgresError(code)),
      true,
      `${code} should be retryable`,
    );
  }

  for (const code of ["22001", "23503", "42501", "42P01"]) {
    assert.equal(
      isRetryablePersistenceError(wrappedPostgresError(code)),
      false,
      `${code} should fail fast`,
    );
  }

  assert.equal(isRetryablePersistenceError(new Error("not PostgreSQL")), false);
  assert.equal(isUniqueViolation(wrappedPostgresError("23505")), true);
  assert.equal(isUniqueViolation(wrappedPostgresError("40P01")), false);
});

for (const code of ["23505", "40001", "40P01"]) {
  test(`retries ${code} and replays the complete persistence transaction`, async () => {
    const firstFailure = wrappedPostgresError(code);
    const scripted = scriptedRepository([firstFailure]);

    const result = await persistArticleSnapshotWithRetry(
      scripted.repository,
      snapshot(),
      { maxAttempts: 3, delayMs: 0 },
    );

    assert.deepEqual(result, scripted.result);
    assert.equal(scripted.attempts(), 2);
  });
}

test("does not retry a non-transient PostgreSQL error", async () => {
  const foreignKeyError = wrappedPostgresError("23503", "foreign key violation");
  const scripted = scriptedRepository([foreignKeyError]);

  await assert.rejects(
    persistArticleSnapshotWithRetry(scripted.repository, snapshot(), {
      maxAttempts: 5,
      delayMs: 0,
    }),
    (error: unknown) => error === foreignKeyError,
  );
  assert.equal(scripted.attempts(), 1);
});

test("retry exhaustion preserves the final actionable database error", async () => {
  const first = wrappedPostgresError("40P01", "deadlock attempt 1");
  const second = wrappedPostgresError("40P01", "deadlock attempt 2");
  const final = wrappedPostgresError("40P01", "deadlock attempt 3");
  const scripted = scriptedRepository([first, second, final]);

  await assert.rejects(
    persistArticleSnapshotWithRetry(scripted.repository, snapshot(), {
      maxAttempts: 3,
      delayMs: 0,
    }),
    (error: unknown) => error === final,
  );
  assert.equal(scripted.attempts(), 3);
});

test("validates retry configuration before opening a transaction", async () => {
  const scripted = scriptedRepository([]);

  await assert.rejects(
    persistArticleSnapshotWithRetry(scripted.repository, snapshot(), {
      maxAttempts: 0,
    }),
    /maxAttempts must be a positive integer/,
  );
  await assert.rejects(
    persistArticleSnapshotWithRetry(scripted.repository, snapshot(), {
      delayMs: -1,
    }),
    /delayMs must be non-negative/,
  );
  assert.equal(scripted.attempts(), 0);
});
