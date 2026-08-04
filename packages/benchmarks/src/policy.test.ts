import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { BenchmarkManifest } from "./manifest.ts";
import {
  validateBenchmarkCaseSemantics,
  validateBenchmarkCoverage,
  type BenchmarkCoveragePolicy,
} from "./policy.ts";

function article(
  id: string,
  sourceId: string,
  category: "technology" | "entertainment" | "sports" = "technology",
) {
  return {
    id,
    category,
    sourceId,
    title: `Article ${id}`,
    canonicalUrl: `https://example.com/${id.toLowerCase()}`,
    observedDate: "2026-08-04",
    verification: "page-fetched" as const,
    contentType: "news-report",
    entities: [id],
    uncertainty: "none" as const,
  };
}

function manifest(): BenchmarkManifest {
  return {
    schemaVersion: "2.0.0",
    datasetVersion: "policy-test",
    generatedAt: "2026-08-04T07:00:00Z",
    legalBoundary: "Metadata only.",
    articles: [article("TN-T001", "vne-tech"), article("TN-T002", "tto-tech")],
    cases: [
      {
        id: "TN-C001",
        kind: "same-event",
        articleIds: ["TN-T001", "TN-T002"],
        expectedRelation: "same-event",
        expectedClusterId: "event-one",
        evaluationFocus: "Cross-source positive pair.",
        knownUncertainty: "Provisional.",
        labelProvenance: {
          status: "provisional",
          method: "project-seed",
          reviewedBy: [],
          notes: "Test fixture.",
        },
      },
    ],
  };
}

const permissivePolicy: BenchmarkCoveragePolicy = {
  minimumArticles: 2,
  minimumArticlesPerCategory: 0,
  minimumCases: 1,
  minimumMultiSourceSameEventCases: 1,
  minimumHardNegativeCases: 0,
  minimumUncertaintyCases: 0,
};

describe("benchmark policy", () => {
  test("accepts a semantically consistent case and matching coverage", () => {
    const value = manifest();
    assert.deepEqual(validateBenchmarkCaseSemantics(value), []);
    assert.deepEqual(validateBenchmarkCoverage(value, permissivePolicy), []);
  });

  test("rejects relation-kind mismatch and missing same-event cluster ID", () => {
    const value = manifest();
    const { expectedClusterId: _removed, ...withoutClusterId } = value.cases[0]!;
    value.cases[0] = {
      ...withoutClusterId,
      expectedRelation: "different-event",
    };

    const issues = validateBenchmarkCaseSemantics(value);
    assert.ok(issues.some((issue) => issue.includes("requires relation same-event")));
    assert.ok(issues.some((issue) => issue.includes("requires expectedClusterId")));
  });

  test("kill-test: fails when hard-negative coverage drops below policy", () => {
    const issues = validateBenchmarkCoverage(manifest(), {
      ...permissivePolicy,
      minimumHardNegativeCases: 1,
    });

    assert.deepEqual(issues, ["hardNegativeCases 0 is below 1"]);
  });

  test("rejects same-event cases that cross categories", () => {
    const value = manifest();
    value.articles[1] = article("TN-T002", "tto-ent", "entertainment");

    const issues = validateBenchmarkCaseSemantics(value);
    assert.ok(issues.includes("TN-C001 same-event articles cross categories"));
  });
});
