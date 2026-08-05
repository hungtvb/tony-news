import assert from "node:assert/strict";
import test from "node:test";

import type {
  BenchmarkArticle,
  BenchmarkCase,
  BenchmarkManifest,
} from "../../benchmarks/src/manifest.ts";
import { evaluateEventRelations } from "./evaluation.ts";

function article(
  id: string,
  entities: string[],
  overrides: Partial<BenchmarkArticle> = {},
): BenchmarkArticle {
  return {
    id,
    category: overrides.category ?? "sports",
    sourceId: overrides.sourceId ?? `source-${id}`,
    title: overrides.title ?? `Article ${id}`,
    canonicalUrl: overrides.canonicalUrl ?? `https://example.com/${id}`,
    observedDate: overrides.observedDate ?? "2026-08-03",
    verification: overrides.verification ?? "page-fetched",
    contentType: overrides.contentType ?? "match-result",
    entities,
    uncertainty: overrides.uncertainty ?? "none",
  };
}

function benchmarkCase(
  id: string,
  kind: BenchmarkCase["kind"],
  articleIds: string[],
  status: BenchmarkCase["labelProvenance"]["status"] = "provisional",
): BenchmarkCase {
  const expectedRelationByKind: Record<
    BenchmarkCase["kind"],
    BenchmarkCase["expectedRelation"]
  > = {
    "same-event": "same-event",
    "related-subevent": "related-not-merge",
    "hard-negative": "different-event",
    uncertainty: "preserve-uncertainty",
    "numeric-fact": "preserve-numeric-facts",
    "developing-story": "preserve-timeline",
  };
  const labelProvenance: BenchmarkCase["labelProvenance"] =
    status === "accepted"
      ? {
          status,
          method: "human-review",
          reviewedBy: ["reviewer"],
          reviewedAt: "2026-08-05T00:00:00Z",
          notes: "Accepted test fixture.",
        }
      : {
          status,
          method: "project-seed",
          reviewedBy: [],
          notes: "Provisional test fixture.",
        };

  return {
    id,
    kind,
    articleIds,
    expectedRelation: expectedRelationByKind[kind],
    ...(kind === "same-event" ? { expectedClusterId: `cluster-${id}` } : {}),
    evaluationFocus: "Exercise relation evaluation.",
    knownUncertainty: "Synthetic metadata fixture.",
    labelProvenance,
  };
}

function manifest(
  articles: BenchmarkArticle[],
  cases: BenchmarkCase[],
): BenchmarkManifest {
  return {
    schemaVersion: "2.0.0",
    datasetVersion: "test-dataset",
    generatedAt: "2026-08-05T00:00:00Z",
    legalBoundary: "Synthetic metadata only.",
    articles,
    cases,
  };
}

test("provisional results are reported separately from accepted metrics", () => {
  const articles = [
    article("A", ["Việt Nam", "Indonesia", "ASEAN Cup"]),
    article("B", ["Việt Nam", "Indonesia", "ASEAN Cup 2026"]),
    article("C", ["CLB TP.HCM I", "Hà Nội", "giải nữ VĐQG"]),
    article("D", ["Google", "Meta", "Úc"], {
      category: "technology",
      contentType: "policy-report",
    }),
    article("E", ["Liên minh châu Âu", "AI", "deepfake"], {
      category: "technology",
      contentType: "policy-report",
    }),
  ];
  const report = evaluateEventRelations(
    manifest(articles, [
      benchmarkCase("accepted-positive", "same-event", ["A", "B"], "accepted"),
      benchmarkCase("provisional-negative", "hard-negative", ["D", "E"]),
      benchmarkCase("provisional-skip", "uncertainty", ["C"]),
    ]),
  );

  assert.equal(report.provisionalLabelsExcludedFromAcceptanceMetrics, true);
  assert.deepEqual(report.summary.accepted, {
    cases: 1,
    matches: 1,
    mismatches: 0,
  });
  assert.deepEqual(report.summary.provisionalReview, {
    cases: 1,
    matches: 1,
    mismatches: 0,
  });
  assert.equal(report.summary.skippedCases, 1);
  assert.deepEqual(report.blockingFailureCaseIds, []);
});

test("a provisional hard-negative regression is still a blocking safety failure", () => {
  const report = evaluateEventRelations(
    manifest(
      [
        article("A", ["Việt Nam", "Indonesia", "ASEAN Cup"]),
        article("B", ["Việt Nam", "Indonesia", "ASEAN Cup 2026"]),
      ],
      [benchmarkCase("kill-test", "hard-negative", ["A", "B"])],
    ),
  );

  assert.equal(report.summary.hardNegativeFailures, 1);
  assert.deepEqual(report.blockingFailureCaseIds, ["kill-test"]);
  assert.deepEqual(report.strictProvisionalFailureCaseIds, ["kill-test"]);
});
