import type {
  BenchmarkCase,
  BenchmarkLabelStatus,
  BenchmarkManifest,
} from "../../benchmarks/src/manifest.ts";
import {
  classifyEventRelation,
  type EventRelation,
  type EventRelationDecision,
} from "./relation.ts";

export const EVENT_RELATION_POLICY_VERSION = "event-relation-v1";

export interface EventRelationPairEvaluation {
  leftArticleId: string;
  rightArticleId: string;
  decision: EventRelationDecision;
}

export interface EventRelationCaseEvaluation {
  caseId: string;
  caseKind: BenchmarkCase["kind"];
  labelStatus: BenchmarkLabelStatus;
  expectedRelation: EventRelation;
  predictedRelation: EventRelation | "mixed";
  matchesExpected: boolean;
  pairs: EventRelationPairEvaluation[];
}

export interface EventRelationEvaluationSummary {
  evaluatedCases: number;
  skippedCases: number;
  hardNegativeFailures: number;
  accepted: {
    cases: number;
    matches: number;
    mismatches: number;
  };
  provisionalReview: {
    cases: number;
    matches: number;
    mismatches: number;
  };
}

export interface EventRelationEvaluationReport {
  policyVersion: string;
  datasetVersion: string;
  provisionalLabelsExcludedFromAcceptanceMetrics: true;
  summary: EventRelationEvaluationSummary;
  blockingFailureCaseIds: string[];
  strictProvisionalFailureCaseIds: string[];
  cases: EventRelationCaseEvaluation[];
}

function expectedEventRelation(
  benchmarkCase: BenchmarkCase,
): EventRelation | undefined {
  switch (benchmarkCase.kind) {
    case "same-event":
      return "same-event-candidate";
    case "related-subevent":
      return "related-not-merge";
    case "hard-negative":
      return "different-event";
    case "uncertainty":
    case "numeric-fact":
    case "developing-story":
      return undefined;
  }
}

function articlePairs(articleIds: readonly string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let leftIndex = 0; leftIndex < articleIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < articleIds.length;
      rightIndex += 1
    ) {
      const left = articleIds[leftIndex];
      const right = articleIds[rightIndex];
      if (left && right) pairs.push([left, right]);
    }
  }
  return pairs;
}

export function evaluateEventRelations(
  manifest: BenchmarkManifest,
): EventRelationEvaluationReport {
  const articleById = new Map(
    manifest.articles.map((article) => [article.id, article]),
  );
  const cases: EventRelationCaseEvaluation[] = [];
  let skippedCases = 0;

  for (const benchmarkCase of manifest.cases) {
    const expectedRelation = expectedEventRelation(benchmarkCase);
    if (!expectedRelation) {
      skippedCases += 1;
      continue;
    }

    const pairs = articlePairs(benchmarkCase.articleIds).map(
      ([leftArticleId, rightArticleId]): EventRelationPairEvaluation => {
        const left = articleById.get(leftArticleId);
        const right = articleById.get(rightArticleId);
        if (!left || !right) {
          throw new Error(
            `${benchmarkCase.id} references missing pair ${leftArticleId}/${rightArticleId}`,
          );
        }
        return {
          leftArticleId,
          rightArticleId,
          decision: classifyEventRelation(left, right),
        };
      },
    );

    const predictedRelations = new Set(
      pairs.map((pair) => pair.decision.relation),
    );
    const predictedRelation =
      predictedRelations.size === 1
        ? (pairs[0]?.decision.relation ?? "uncertain")
        : "mixed";
    const matchesExpected = pairs.every(
      (pair) => pair.decision.relation === expectedRelation,
    );

    cases.push({
      caseId: benchmarkCase.id,
      caseKind: benchmarkCase.kind,
      labelStatus: benchmarkCase.labelProvenance.status,
      expectedRelation,
      predictedRelation,
      matchesExpected,
      pairs,
    });
  }

  const acceptedCases = cases.filter((item) => item.labelStatus === "accepted");
  const provisionalCases = cases.filter(
    (item) => item.labelStatus === "provisional",
  );
  const blockingFailureCaseIds = cases
    .filter(
      (item) =>
        (!item.matchesExpected && item.labelStatus === "accepted") ||
        (!item.matchesExpected && item.caseKind === "hard-negative"),
    )
    .map((item) => item.caseId);
  const strictProvisionalFailureCaseIds = provisionalCases
    .filter((item) => !item.matchesExpected)
    .map((item) => item.caseId);

  return {
    policyVersion: EVENT_RELATION_POLICY_VERSION,
    datasetVersion: manifest.datasetVersion,
    provisionalLabelsExcludedFromAcceptanceMetrics: true,
    summary: {
      evaluatedCases: cases.length,
      skippedCases,
      hardNegativeFailures: cases.filter(
        (item) => item.caseKind === "hard-negative" && !item.matchesExpected,
      ).length,
      accepted: {
        cases: acceptedCases.length,
        matches: acceptedCases.filter((item) => item.matchesExpected).length,
        mismatches: acceptedCases.filter((item) => !item.matchesExpected).length,
      },
      provisionalReview: {
        cases: provisionalCases.length,
        matches: provisionalCases.filter((item) => item.matchesExpected).length,
        mismatches: provisionalCases.filter((item) => !item.matchesExpected)
          .length,
      },
    },
    blockingFailureCaseIds,
    strictProvisionalFailureCaseIds,
    cases,
  };
}
