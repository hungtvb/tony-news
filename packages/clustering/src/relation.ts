import type { BenchmarkArticle } from "../../benchmarks/src/manifest.ts";

export const EVENT_RELATIONS = [
  "same-event-candidate",
  "related-not-merge",
  "different-event",
  "uncertain",
] as const;

export type EventRelation = (typeof EVENT_RELATIONS)[number];

export type EventRelationConfidence = "high" | "medium" | "low";

export type EventRelationReason =
  | "category-mismatch"
  | "protected-content-boundary"
  | "multiple-shared-entities"
  | "single-shared-entity-same-family"
  | "broad-single-entity"
  | "no-shared-entity"
  | "weak-title-overlap"
  | "date-outside-window"
  | "insufficient-evidence";

export interface EventRelationSignals {
  sameCategory: boolean;
  dateDistanceDays: number;
  sameContentFamily: boolean;
  sharedEntities: string[];
  titleTokenOverlap: number;
}

export interface EventRelationDecision {
  relation: EventRelation;
  confidence: EventRelationConfidence;
  reasons: EventRelationReason[];
  signals: EventRelationSignals;
}

const GENERIC_ENTITY_KEYS = new Set([
  "ai",
  "bao chi",
  "cong nghe",
  "dien anh",
  "giai tri",
  "nguoi ham mo",
  "phong ve",
  "the thao",
]);

const BROAD_SINGLE_ENTITY_KEYS = new Set([
  "apple",
  "google",
  "ha noi",
  "indonesia",
  "meta",
  "netflix",
  "samsung",
  "trung quoc",
  "uc",
  "viet nam",
]);

const TITLE_STOP_WORDS = new Set([
  "ai",
  "bi",
  "cho",
  "cua",
  "da",
  "dang",
  "de",
  "duoc",
  "gi",
  "hon",
  "khi",
  "la",
  "mot",
  "nhung",
  "o",
  "sau",
  "tai",
  "the",
  "theo",
  "thi",
  "tren",
  "trong",
  "tu",
  "va",
  "ve",
  "vi",
  "voi",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/giu, "d")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalEntityKeys(value: string): string[] {
  const normalized = normalizeText(value)
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const keys = new Set<string>();

  if (normalized) {
    keys.add(normalized);
  }
  if (/\b(?:doi tuyen|tuyen) viet nam\b/.test(normalized)) {
    keys.add("viet nam");
  }
  if (/\bhlv indonesia\b/.test(normalized)) {
    keys.add("indonesia");
  }
  if (/\bnguoi nhen\b/.test(normalized)) {
    keys.add("spider man");
  }

  return [...keys].filter((key) => !GENERIC_ENTITY_KEYS.has(key));
}

function specificEntitySet(article: BenchmarkArticle): Set<string> {
  return new Set(article.entities.flatMap(canonicalEntityKeys));
}

function contentFamily(contentType: string): string {
  const normalized = normalizeText(contentType);

  if (normalized.includes("box office")) return "box-office";
  if (normalized.includes("match")) return "match";
  if (normalized.includes("policy")) return "policy";
  if (normalized.includes("rumor")) return "rumor";
  if (normalized.includes("reaction")) return "reaction";
  if (normalized.includes("milestone")) return "milestone";
  if (normalized.includes("preview")) return "preview";
  if (normalized.includes("result")) return "result";
  return normalized;
}

function isProtectedContentBoundary(leftType: string, rightType: string): boolean {
  const left = normalizeText(leftType);
  const right = normalizeText(rightType);
  const leftReaction = left.includes("reaction");
  const rightReaction = right.includes("reaction");
  const leftMilestone = left.includes("milestone");
  const rightMilestone = right.includes("milestone");
  const leftPreview = left.includes("preview");
  const rightPreview = right.includes("preview");
  const leftResult = left.includes("result");
  const rightResult = right.includes("result");

  return (
    leftReaction !== rightReaction ||
    leftMilestone !== rightMilestone ||
    (leftPreview && rightResult) ||
    (rightPreview && leftResult)
  );
}

function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeText(title)
      .split(" ")
      .filter(
        (token) =>
          token.length >= 3 &&
          !TITLE_STOP_WORDS.has(token) &&
          !/^\d+$/.test(token),
      ),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

function dateDistanceDays(leftDate: string, rightDate: string): number {
  const left = Date.parse(`${leftDate}T00:00:00Z`);
  const right = Date.parse(`${rightDate}T00:00:00Z`);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.round(Math.abs(left - right) / 86_400_000);
}

function buildSignals(
  left: BenchmarkArticle,
  right: BenchmarkArticle,
): EventRelationSignals {
  const leftEntities = specificEntitySet(left);
  const rightEntities = specificEntitySet(right);
  const sharedEntities = [...leftEntities]
    .filter((entity) => rightEntities.has(entity))
    .sort();

  return {
    sameCategory: left.category === right.category,
    dateDistanceDays: dateDistanceDays(left.observedDate, right.observedDate),
    sameContentFamily:
      contentFamily(left.contentType) === contentFamily(right.contentType),
    sharedEntities,
    titleTokenOverlap: jaccard(titleTokens(left.title), titleTokens(right.title)),
  };
}

export function classifyEventRelation(
  left: BenchmarkArticle,
  right: BenchmarkArticle,
): EventRelationDecision {
  const signals = buildSignals(left, right);

  if (!signals.sameCategory) {
    return {
      relation: "different-event",
      confidence: "high",
      reasons: ["category-mismatch"],
      signals,
    };
  }

  if (
    signals.sharedEntities.length > 0 &&
    isProtectedContentBoundary(left.contentType, right.contentType)
  ) {
    return {
      relation: "related-not-merge",
      confidence: "high",
      reasons: ["protected-content-boundary"],
      signals,
    };
  }

  if (
    signals.sharedEntities.length >= 2 &&
    signals.dateDistanceDays <= 2
  ) {
    return {
      relation: "same-event-candidate",
      confidence: "high",
      reasons: ["multiple-shared-entities"],
      signals,
    };
  }

  const singleSharedEntity = signals.sharedEntities[0];
  if (
    signals.sharedEntities.length === 1 &&
    singleSharedEntity !== undefined &&
    !BROAD_SINGLE_ENTITY_KEYS.has(singleSharedEntity) &&
    signals.sameContentFamily &&
    signals.dateDistanceDays <= 1
  ) {
    return {
      relation: "same-event-candidate",
      confidence: "medium",
      reasons: ["single-shared-entity-same-family"],
      signals,
    };
  }

  if (
    signals.sharedEntities.length === 1 &&
    singleSharedEntity !== undefined &&
    BROAD_SINGLE_ENTITY_KEYS.has(singleSharedEntity)
  ) {
    return {
      relation: "uncertain",
      confidence: "low",
      reasons: ["broad-single-entity", "insufficient-evidence"],
      signals,
    };
  }

  if (
    signals.sharedEntities.length === 0 &&
    signals.titleTokenOverlap < 0.2
  ) {
    return {
      relation: "different-event",
      confidence: "medium",
      reasons: ["no-shared-entity", "weak-title-overlap"],
      signals,
    };
  }

  if (
    signals.sharedEntities.length === 0 &&
    signals.dateDistanceDays > 7
  ) {
    return {
      relation: "different-event",
      confidence: "medium",
      reasons: ["no-shared-entity", "date-outside-window"],
      signals,
    };
  }

  return {
    relation: "uncertain",
    confidence: "low",
    reasons: ["insufficient-evidence"],
    signals,
  };
}
