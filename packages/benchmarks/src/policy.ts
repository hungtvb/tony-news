import {
  buildBenchmarkInventory,
  type BenchmarkCase,
  type BenchmarkManifest,
} from "./manifest.ts";

export interface BenchmarkCoveragePolicy {
  minimumArticles: number;
  minimumArticlesPerCategory: number;
  minimumCases: number;
  minimumMultiSourceSameEventCases: number;
  minimumHardNegativeCases: number;
  minimumUncertaintyCases: number;
}

export const PHASE_0_BENCHMARK_COVERAGE: BenchmarkCoveragePolicy = {
  minimumArticles: 30,
  minimumArticlesPerCategory: 10,
  minimumCases: 14,
  minimumMultiSourceSameEventCases: 4,
  minimumHardNegativeCases: 4,
  minimumUncertaintyCases: 2,
};

function expectedRelationForKind(
  kind: BenchmarkCase["kind"],
): BenchmarkCase["expectedRelation"] {
  switch (kind) {
    case "same-event":
      return "same-event";
    case "related-subevent":
      return "related-not-merge";
    case "hard-negative":
      return "different-event";
    case "uncertainty":
      return "preserve-uncertainty";
    case "numeric-fact":
      return "preserve-numeric-facts";
    case "developing-story":
      return "preserve-timeline";
  }
}

export function validateBenchmarkCaseSemantics(
  manifest: BenchmarkManifest,
): string[] {
  const issues: string[] = [];
  const articleById = new Map(
    manifest.articles.map((article) => [article.id, article]),
  );

  for (const benchmarkCase of manifest.cases) {
    const expectedRelation = expectedRelationForKind(benchmarkCase.kind);
    if (benchmarkCase.expectedRelation !== expectedRelation) {
      issues.push(
        `${benchmarkCase.id} kind ${benchmarkCase.kind} requires relation ${expectedRelation}`,
      );
    }

    if (
      ["same-event", "related-subevent", "hard-negative"].includes(
        benchmarkCase.kind,
      ) &&
      benchmarkCase.articleIds.length < 2
    ) {
      issues.push(`${benchmarkCase.id} requires at least two articles`);
    }

    if (
      benchmarkCase.kind === "same-event" &&
      (!benchmarkCase.expectedClusterId ||
        benchmarkCase.expectedClusterId.trim().length === 0)
    ) {
      issues.push(`${benchmarkCase.id} same-event case requires expectedClusterId`);
    }

    if (benchmarkCase.kind === "same-event") {
      const categories = benchmarkCase.articleIds
        .map((articleId) => articleById.get(articleId)?.category)
        .filter((category): category is NonNullable<typeof category> =>
          Boolean(category),
        );
      if (new Set(categories).size > 1) {
        issues.push(`${benchmarkCase.id} same-event articles cross categories`);
      }
    }

    if (benchmarkCase.kind === "hard-negative") {
      const uniqueArticles = new Set(benchmarkCase.articleIds);
      if (uniqueArticles.size < 2) {
        issues.push(`${benchmarkCase.id} hard-negative requires distinct articles`);
      }
    }
  }

  return issues;
}

export function validateBenchmarkCoverage(
  manifest: BenchmarkManifest,
  policy: BenchmarkCoveragePolicy = PHASE_0_BENCHMARK_COVERAGE,
): string[] {
  const issues: string[] = [];
  const inventory = buildBenchmarkInventory(manifest);

  if (inventory.articleCount < policy.minimumArticles) {
    issues.push(
      `articleCount ${inventory.articleCount} is below ${policy.minimumArticles}`,
    );
  }
  for (const [category, count] of Object.entries(inventory.categories)) {
    if (count < policy.minimumArticlesPerCategory) {
      issues.push(
        `${category} article count ${count} is below ${policy.minimumArticlesPerCategory}`,
      );
    }
  }
  if (inventory.caseCount < policy.minimumCases) {
    issues.push(`caseCount ${inventory.caseCount} is below ${policy.minimumCases}`);
  }
  if (
    inventory.multiSourceSameEventCases <
    policy.minimumMultiSourceSameEventCases
  ) {
    issues.push(
      `multiSourceSameEventCases ${inventory.multiSourceSameEventCases} is below ${policy.minimumMultiSourceSameEventCases}`,
    );
  }
  if (inventory.hardNegativeCases < policy.minimumHardNegativeCases) {
    issues.push(
      `hardNegativeCases ${inventory.hardNegativeCases} is below ${policy.minimumHardNegativeCases}`,
    );
  }
  if (inventory.uncertaintyCases < policy.minimumUncertaintyCases) {
    issues.push(
      `uncertaintyCases ${inventory.uncertaintyCases} is below ${policy.minimumUncertaintyCases}`,
    );
  }

  return issues;
}
