import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_SNAPSHOT_SCHEMA_VERSION,
  SUMMARY_SCHEMA_VERSION,
} from "./contracts.ts";
import type {
  EventSnapshot,
  ProposedSummary,
  RetainedClaim,
} from "./contracts.ts";
import { parseProposedSummary, validateProposedSummary } from "./validator.ts";

function number(value = "90", unit = "VND", currency: string | null = "VND") {
  return {
    key: "box-office-gross",
    value,
    unit,
    currency,
    scale: "billion" as const,
  };
}

function eventTime(value = "2026-08-03T20:00:00+07:00") {
  return { key: "match-time", value, role: "event" as const };
}

function claim(
  id: string,
  articleId: string,
  articleVersionId: string,
  overrides: Partial<RetainedClaim> = {},
): RetainedClaim {
  return {
    id,
    articleId,
    articleVersionId,
    state: "active",
    propositionId: "prop-box-office-90b-vnd",
    epistemicStatus: "reported",
    polarity: "affirmed",
    entities: ["Spider-Man", "Vietnam box office"],
    numbers: [number()],
    times: [eventTime()],
    ...overrides,
  };
}

function snapshot(): EventSnapshot {
  return {
    schemaVersion: EVENT_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: "story-1:snapshot",
    snapshotVersion: 3,
    articleVersions: [
      { articleId: "article-1", articleVersionId: "article-1:v2", state: "active" },
      { articleId: "article-2", articleVersionId: "article-2:v1", state: "active" },
      { articleId: "article-disabled", articleVersionId: "article-disabled:v1", state: "disabled" },
    ],
    claims: [
      claim("claim-1", "article-1", "article-1:v2"),
      claim("claim-2", "article-2", "article-2:v1"),
      claim("claim-rumor", "article-1", "article-1:v2", {
        propositionId: "prop-price-rumor",
        epistemicStatus: "rumor",
        entities: ["iPhone 18 Pro"],
        numbers: [
          {
            key: "price-increase",
            value: "300",
            unit: "USD",
            currency: "USD",
            scale: "unit",
          },
        ],
        times: [],
      }),
      claim("claim-denied", "article-2", "article-2:v1", {
        propositionId: "prop-box-office-90b-vnd",
        polarity: "denied",
      }),
      claim("claim-other", "article-2", "article-2:v1", {
        propositionId: "prop-unrelated",
      }),
      claim("claim-disabled", "article-disabled", "article-disabled:v1", {
        state: "disabled",
      }),
    ],
  };
}

function validSummary(): ProposedSummary {
  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    snapshotId: "story-1:snapshot",
    snapshotVersion: 3,
    sentences: [
      {
        id: "sentence-1",
        kind: "one-line",
        text: "Doanh thu mở màn được hai nguồn ghi nhận ở mức 90 tỉ đồng.",
        claimIds: ["claim-1", "claim-2"],
        citations: [
          {
            articleId: "article-1",
            articleVersionId: "article-1:v2",
            claimIds: ["claim-1"],
          },
          {
            articleId: "article-2",
            articleVersionId: "article-2:v1",
            claimIds: ["claim-2"],
          },
        ],
        assertion: {
          propositionId: "prop-box-office-90b-vnd",
          epistemicStatus: "reported",
          polarity: "affirmed",
          entities: ["Spider-Man", "Vietnam box office"],
          numbers: [number()],
          times: [eventTime()],
        },
      },
    ],
  };
}

function issueCodes(value: unknown): string[] {
  const result = validateProposedSummary(value, snapshot());
  assert.equal(result.valid, false);
  return result.issues.map((item) => item.code);
}

function cloneSummary(): ProposedSummary {
  return structuredClone(validSummary());
}

test("accepts one atomic assertion supported by exact article versions and claims", () => {
  const result = validateProposedSummary(validSummary(), snapshot());
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.summary.sentences.length, 1);
});

test("allows a confirmed claim to be stated more cautiously", () => {
  const current = snapshot();
  current.claims = current.claims.map((item) =>
    item.id === "claim-1" || item.id === "claim-2"
      ? { ...item, epistemicStatus: "confirmed" }
      : item,
  );
  const result = validateProposedSummary(validSummary(), current);
  assert.equal(result.valid, true);
});

test("rejects unknown critical fields instead of silently accepting schema drift", () => {
  const summary = { ...validSummary(), modelReasoning: "hidden" };
  const parsed = parseProposedSummary(summary);
  assert.equal(parsed.valid, false);
  if (!parsed.valid) {
    assert.ok(parsed.issues.some((item) => item.code === "unknown-field"));
  }
});

test("rejects malformed and empty material output", () => {
  assert.deepEqual(issueCodes(null), ["invalid-type"]);
  const summary = cloneSummary();
  summary.sentences[0]!.text = "   ";
  assert.ok(issueCodes(summary).includes("empty-value"));
});

test("rejects a fake claim even when the citation shape looks valid", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.claimIds = ["claim-1", "claim-fake"];
  summary.sentences[0]!.citations[1]!.claimIds = ["claim-fake"];
  assert.ok(issueCodes(summary).includes("unknown-claim"));
});

test("rejects a citation to an article version outside the snapshot", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.citations[0]!.articleVersionId = "article-1:v1";
  const codes = issueCodes(summary);
  assert.ok(codes.includes("unknown-article-version"));
  assert.ok(codes.includes("claim-provenance-mismatch"));
});

test("rejects a claim attached to the wrong article citation", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.citations[1] = {
    articleId: "article-1",
    articleVersionId: "article-1:v2",
    claimIds: ["claim-2"],
  };
  assert.ok(issueCodes(summary).includes("claim-provenance-mismatch"));
});

test("rejects disabled article versions and claims", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.claimIds = ["claim-disabled"];
  summary.sentences[0]!.citations = [
    {
      articleId: "article-disabled",
      articleVersionId: "article-disabled:v1",
      claimIds: ["claim-disabled"],
    },
  ];
  const codes = issueCodes(summary);
  assert.ok(codes.includes("disabled-article-version"));
  assert.ok(codes.includes("disabled-claim"));
});

test("rejects duplicate citations and duplicate claim references", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.citations.push(
    structuredClone(summary.sentences[0]!.citations[0]!),
  );
  const codes = issueCodes(summary);
  assert.ok(codes.includes("duplicate-citation"));
  assert.ok(codes.includes("duplicate-claim-reference"));
});

test("rejects top-level claim IDs that do not exactly match cited claims", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.claimIds = ["claim-1"];
  assert.ok(issueCodes(summary).includes("claim-set-mismatch"));
});

test("kill test: citation presence cannot upgrade a rumor into confirmed fact", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.claimIds = ["claim-rumor"];
  summary.sentences[0]!.citations = [
    {
      articleId: "article-1",
      articleVersionId: "article-1:v2",
      claimIds: ["claim-rumor"],
    },
  ];
  summary.sentences[0]!.assertion = {
    propositionId: "prop-price-rumor",
    epistemicStatus: "confirmed",
    polarity: "affirmed",
    entities: ["iPhone 18 Pro"],
    numbers: [
      {
        key: "price-increase",
        value: "300",
        unit: "USD",
        currency: "USD",
        scale: "unit",
      },
    ],
    times: [],
  };
  assert.ok(issueCodes(summary).includes("epistemic-upgrade"));
});

test("allows uncertain wording for a rumor without upgrading it", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.claimIds = ["claim-rumor"];
  summary.sentences[0]!.citations = [
    {
      articleId: "article-1",
      articleVersionId: "article-1:v2",
      claimIds: ["claim-rumor"],
    },
  ];
  summary.sentences[0]!.assertion = {
    propositionId: "prop-price-rumor",
    epistemicStatus: "uncertain",
    polarity: "affirmed",
    entities: ["iPhone 18 Pro"],
    numbers: [
      {
        key: "price-increase",
        value: "300",
        unit: "USD",
        currency: "USD",
        scale: "unit",
      },
    ],
    times: [],
  };
  assert.equal(validateProposedSummary(summary, snapshot()).valid, true);
});

test("rejects mixed or changed polarity", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.claimIds = ["claim-1", "claim-denied"];
  summary.sentences[0]!.citations[1]!.claimIds = ["claim-denied"];
  const codes = issueCodes(summary);
  assert.ok(codes.includes("mixed-polarity"));
  assert.ok(codes.includes("polarity-mismatch"));
});

test("rejects combining multiple propositions into one cited sentence", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.claimIds = ["claim-1", "claim-other"];
  summary.sentences[0]!.citations[1]!.claimIds = ["claim-other"];
  const codes = issueCodes(summary);
  assert.ok(codes.includes("mixed-proposition"));
  assert.ok(codes.includes("proposition-mismatch"));
});

test("rejects entities not supported by every cited claim", () => {
  const summary = cloneSummary();
  summary.sentences[0]!.assertion.entities.push("The Odyssey");
  assert.ok(issueCodes(summary).includes("unsupported-entity"));
});

test("kill test: citations do not excuse number, unit, currency, or scale drift", () => {
  for (const altered of [
    number("91"),
    number("90", "USD", "USD"),
    { ...number(), currency: null },
    { ...number(), scale: "million" as const },
  ]) {
    const summary = cloneSummary();
    summary.sentences[0]!.assertion.numbers = [altered];
    assert.ok(issueCodes(summary).includes("unsupported-number"));
  }
});

test("rejects an unsupported absolute time and relative time syntax", () => {
  const changed = cloneSummary();
  changed.sentences[0]!.assertion.times = [eventTime("2026-08-04T20:00:00+07:00")];
  assert.ok(issueCodes(changed).includes("unsupported-time"));

  const relative = cloneSummary() as unknown as Record<string, unknown>;
  const sentences = relative.sentences as Array<Record<string, unknown>>;
  const assertion = sentences[0]!.assertion as Record<string, unknown>;
  assertion.times = [{ key: "match-time", value: "yesterday", role: "event" }];
  const parsed = parseProposedSummary(relative);
  assert.equal(parsed.valid, false);
  if (!parsed.valid) {
    assert.ok(parsed.issues.some((item) => item.code === "invalid-format"));
  }
});

test("rejects summary output for a different snapshot identity or version", () => {
  const wrongId = cloneSummary();
  wrongId.snapshotId = "story-2:snapshot";
  assert.ok(issueCodes(wrongId).includes("snapshot-id-mismatch"));

  const wrongVersion = cloneSummary();
  wrongVersion.snapshotVersion = 2;
  assert.ok(issueCodes(wrongVersion).includes("snapshot-version-mismatch"));
});

test("rejects duplicate sentence IDs and multiple one-line summaries", () => {
  const summary = cloneSummary();
  summary.sentences.push(structuredClone(summary.sentences[0]!));
  const codes = issueCodes(summary);
  assert.ok(codes.includes("duplicate-sentence-id"));
  assert.ok(codes.includes("multiple-one-line-sentences"));
});

test("fails closed when retained snapshot provenance is invalid", () => {
  const current = snapshot();
  current.claims[0] = { ...current.claims[0]!, articleVersionId: "missing:v1" };
  const result = validateProposedSummary(validSummary(), current);
  assert.equal(result.valid, false);
  if (!result.valid) assert.deepEqual(result.issues[0]?.code, "invalid-snapshot");
});
