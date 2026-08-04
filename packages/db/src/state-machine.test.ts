import assert from "node:assert/strict";
import test from "node:test";

import {
  assertIngestionRunTransition,
  canTransitionIngestionRun,
  decideProcessingFailure,
} from "./state-machine.ts";

test("allows the normal ingestion lifecycle", () => {
  assert.equal(canTransitionIngestionRun("queued", "running"), true);
  assert.equal(canTransitionIngestionRun("running", "succeeded"), true);
  assert.equal(canTransitionIngestionRun("running", "partial"), true);
  assert.equal(canTransitionIngestionRun("running", "failed"), true);
});

test("rejects invalid terminal transitions", () => {
  assert.equal(canTransitionIngestionRun("succeeded", "running"), false);
  assert.throws(
    () => assertIngestionRunTransition("cancelled", "queued"),
    /Invalid ingestion run transition/,
  );
});

test("permits explicit retry from failed or partial to queued", () => {
  assert.equal(canTransitionIngestionRun("failed", "queued"), true);
  assert.equal(canTransitionIngestionRun("partial", "queued"), true);
});

test("retries only retryable failures below max attempts", () => {
  assert.deepEqual(
    decideProcessingFailure({
      category: "network",
      retryable: true,
      message: "connection reset",
      attempt: 1,
      maxAttempts: 3,
      traceId: "trace-1",
    }),
    {
      terminalStatus: "failed",
      shouldRetry: true,
      nextAttempt: 2,
    },
  );

  assert.deepEqual(
    decideProcessingFailure({
      category: "validation",
      retryable: false,
      message: "invalid canonical URL",
      attempt: 1,
      maxAttempts: 3,
      traceId: "trace-2",
    }),
    {
      terminalStatus: "failed",
      shouldRetry: false,
    },
  );
});

test("stops retrying at max attempts and validates counters", () => {
  assert.equal(
    decideProcessingFailure({
      category: "timeout",
      retryable: true,
      message: "timed out",
      attempt: 3,
      maxAttempts: 3,
      traceId: "trace-3",
    }).shouldRetry,
    false,
  );

  assert.throws(
    () =>
      decideProcessingFailure({
        category: "unknown",
        retryable: true,
        message: "bad counters",
        attempt: 4,
        maxAttempts: 3,
        traceId: "trace-4",
      }),
    /Invalid processing failure attempt counters/,
  );
});
