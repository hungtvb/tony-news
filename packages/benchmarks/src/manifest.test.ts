import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildBenchmarkInventory,
  validateBenchmarkManifest,
  type BenchmarkManifest,
} from "./manifest.ts";

function validManifest(): BenchmarkManifest {
  return {
    schemaVersion: "2.0.0",
    datasetVersion: "test-v1",
    generatedAt: "2026-08-04T06:00:00Z",
    legalBoundary: "Metadata-only fixture.",
    articles: [
      {
        id: "TN-T001",
        category: "technology",
        sourceId: "vne-tech",
        title: "Article one",
        canonicalUrl: "https://example.com/article-one",
        observedDate: "2026-08-04",
        verification: "page-fetched",
        contentType: "news-report",
        entities: ["Example"],
        uncertainty: "none",
      },
      {
        id: "TN-T002",
        category: "technology",
        sourceId: "tto-tech",
        title: "Article two",
        canonicalUrl: "https://example.org/article-two",
        observedDate: "2026-08-04",
        verification: "url-observed",
        contentType: "news-report",
        entities: ["Example"],
        uncertainty: "none",
      },
    ],
    cases: [
      {
        id: "TN-C001",
        kind: "same-event",
        articleIds: ["TN-T001", "TN-T002"],
        expectedRelation: "same-event",
        expectedClusterId: "example-event",
        evaluationFocus: "Cross-source positive pair.",
        knownUncertainty: "Titles only; label remains provisional.",
        labelProvenance: {
          status: "provisional",
          method: "project-seed",
          reviewedBy: [],
          notes: "Not accepted as ground truth.",
        },
      },
    ],
  };
}

describe("benchmark manifest", () => {
  test("accepts a valid provisional manifest and builds inventory", () => {
    const manifest = validManifest();
    assert.deepEqual(validateBenchmarkManifest(manifest), []);

    const inventory = buildBenchmarkInventory(manifest);
    assert.equal(inventory.articleCount, 2);
    assert.equal(inventory.caseCount, 1);
    assert.equal(inventory.categories.technology, 2);
    assert.equal(inventory.caseKinds["same-event"], 1);
    assert.equal(inventory.labelStatuses.provisional, 1);
    assert.equal(inventory.multiSourceSameEventCases, 1);
  });

  test("rejects accepted labels without a human reviewer and timestamp", () => {
    const manifest = validManifest();
    manifest.cases[0]!.labelProvenance = {
      status: "accepted",
      method: "project-seed",
      reviewedBy: [],
      notes: "Unsafe promotion attempt.",
    };

    const issues = validateBenchmarkManifest(manifest);
    assert.ok(issues.some((issue) => issue.includes("human-review provenance")));
    assert.ok(issues.some((issue) => issue.includes("at least one reviewer")));
    assert.ok(issues.some((issue) => issue.includes("reviewedAt")));
  });

  test("rejects duplicate IDs, duplicate URLs, and unknown article references", () => {
    const manifest = validManifest();
    manifest.articles[1] = {
      ...manifest.articles[1]!,
      id: "TN-T001",
      canonicalUrl: "https://example.com/article-one",
    };
    manifest.cases[0]!.articleIds = ["TN-T001", "TN-MISSING"];

    const issues = validateBenchmarkManifest(manifest);
    assert.ok(issues.includes("article IDs must be unique"));
    assert.ok(issues.includes("canonical URLs must be unique"));
    assert.ok(issues.some((issue) => issue.includes("unknown article TN-MISSING")));
  });

  test("kill-test: does not permit an empty hard-negative case", () => {
    const manifest = validManifest();
    manifest.cases[0] = {
      ...manifest.cases[0]!,
      kind: "hard-negative",
      expectedRelation: "different-event",
      articleIds: [],
    };

    const issues = validateBenchmarkManifest(manifest);
    assert.ok(issues.some((issue) => issue.includes("articleIds must be a non-empty array")));
  });
});
