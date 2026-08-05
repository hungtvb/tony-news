export const EVENT_SNAPSHOT_SCHEMA_VERSION = "event-snapshot.v1" as const;
export const SUMMARY_SCHEMA_VERSION = "citation-safe-summary.v1" as const;

export const ARTICLE_VERSION_STATES = ["active", "disabled"] as const;
export type ArticleVersionState = (typeof ARTICLE_VERSION_STATES)[number];

export const CLAIM_STATES = ["active", "disabled"] as const;
export type ClaimState = (typeof CLAIM_STATES)[number];

export const CLAIM_EPISTEMIC_STATUSES = [
  "confirmed",
  "reported",
  "estimate",
  "prediction",
  "rumor",
  "allegation",
  "opinion",
  "correction",
  "uncertain",
] as const;
export type ClaimEpistemicStatus =
  (typeof CLAIM_EPISTEMIC_STATUSES)[number];

export const CLAIM_POLARITIES = ["affirmed", "denied"] as const;
export type ClaimPolarity = (typeof CLAIM_POLARITIES)[number];

export const NUMBER_SCALES = [
  "unit",
  "thousand",
  "million",
  "billion",
  "trillion",
  "percent",
  "basis-point",
] as const;
export type NumberScale = (typeof NUMBER_SCALES)[number];

export const TIME_ROLES = [
  "event",
  "published",
  "updated",
  "effective",
  "announced",
] as const;
export type TimeRole = (typeof TIME_ROLES)[number];

export const SUMMARY_SENTENCE_KINDS = ["one-line", "bullet"] as const;
export type SummarySentenceKind = (typeof SUMMARY_SENTENCE_KINDS)[number];

export interface ArticleVersionRef {
  articleId: string;
  articleVersionId: string;
  state: ArticleVersionState;
}

export interface StructuredNumber {
  key: string;
  value: string;
  unit: string;
  currency: string | null;
  scale: NumberScale;
}

export interface StructuredTime {
  key: string;
  value: string;
  role: TimeRole;
}

export interface RetainedClaim {
  id: string;
  articleId: string;
  articleVersionId: string;
  state: ClaimState;
  propositionId: string;
  epistemicStatus: ClaimEpistemicStatus;
  polarity: ClaimPolarity;
  entities: string[];
  numbers: StructuredNumber[];
  times: StructuredTime[];
}

export interface EventSnapshot {
  schemaVersion: typeof EVENT_SNAPSHOT_SCHEMA_VERSION;
  snapshotId: string;
  snapshotVersion: number;
  articleVersions: ArticleVersionRef[];
  claims: RetainedClaim[];
}

export interface SummaryCitation {
  articleId: string;
  articleVersionId: string;
  claimIds: string[];
}

export interface ProposedAssertion {
  propositionId: string;
  epistemicStatus: ClaimEpistemicStatus;
  polarity: ClaimPolarity;
  entities: string[];
  numbers: StructuredNumber[];
  times: StructuredTime[];
}

export interface ProposedSummarySentence {
  id: string;
  kind: SummarySentenceKind;
  text: string;
  claimIds: string[];
  citations: SummaryCitation[];
  assertion: ProposedAssertion;
}

export interface ProposedSummary {
  schemaVersion: typeof SUMMARY_SCHEMA_VERSION;
  snapshotId: string;
  snapshotVersion: number;
  sentences: ProposedSummarySentence[];
}

export const SUMMARY_VALIDATION_ISSUE_CODES = [
  "invalid-type",
  "missing-field",
  "unknown-field",
  "invalid-enum",
  "invalid-format",
  "empty-value",
  "duplicate-sentence-id",
  "multiple-one-line-sentences",
  "snapshot-id-mismatch",
  "snapshot-version-mismatch",
  "unknown-article-version",
  "disabled-article-version",
  "unknown-claim",
  "disabled-claim",
  "claim-provenance-mismatch",
  "duplicate-citation",
  "duplicate-claim-reference",
  "claim-set-mismatch",
  "mixed-proposition",
  "proposition-mismatch",
  "epistemic-upgrade",
  "mixed-polarity",
  "polarity-mismatch",
  "unsupported-entity",
  "unsupported-number",
  "unsupported-time",
  "invalid-snapshot",
] as const;
export type SummaryValidationIssueCode =
  (typeof SUMMARY_VALIDATION_ISSUE_CODES)[number];

export interface SummaryValidationIssue {
  code: SummaryValidationIssueCode;
  path: string;
  sentenceId?: string;
  articleId?: string;
  articleVersionId?: string;
  claimId?: string;
}

export interface SummaryValidationSuccess {
  valid: true;
  summary: ProposedSummary;
  issues: [];
}

export interface SummaryValidationFailure {
  valid: false;
  issues: SummaryValidationIssue[];
}

export type SummaryValidationResult =
  | SummaryValidationSuccess
  | SummaryValidationFailure;
