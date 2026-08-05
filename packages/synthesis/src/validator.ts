import {
  ARTICLE_VERSION_STATES,
  CLAIM_EPISTEMIC_STATUSES,
  CLAIM_POLARITIES,
  CLAIM_STATES,
  EVENT_SNAPSHOT_SCHEMA_VERSION,
  NUMBER_SCALES,
  SUMMARY_SCHEMA_VERSION,
  SUMMARY_SENTENCE_KINDS,
  TIME_ROLES,
} from "./contracts.ts";
import type {
  ClaimEpistemicStatus,
  EventSnapshot,
  ProposedAssertion,
  ProposedSummary,
  ProposedSummarySentence,
  RetainedClaim,
  StructuredNumber,
  StructuredTime,
  SummaryCitation,
  SummaryValidationIssue,
  SummaryValidationResult,
} from "./contracts.ts";

interface ParseContext {
  issues: SummaryValidationIssue[];
}

type JsonRecord = Record<string, unknown>;

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const ABSOLUTE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const STATUS_DOWNGRADE_POLICY: Readonly<
  Record<ClaimEpistemicStatus, ReadonlySet<ClaimEpistemicStatus>>
> = {
  confirmed: new Set(["confirmed", "reported", "uncertain"]),
  reported: new Set(["reported", "uncertain"]),
  estimate: new Set(["estimate", "uncertain"]),
  prediction: new Set(["prediction", "uncertain"]),
  rumor: new Set(["rumor", "uncertain"]),
  allegation: new Set(["allegation", "uncertain"]),
  opinion: new Set(["opinion", "uncertain"]),
  correction: new Set(["correction", "uncertain"]),
  uncertain: new Set(["uncertain"]),
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  context: ParseContext,
  code: SummaryValidationIssue["code"],
  path: string,
  refs: Omit<SummaryValidationIssue, "code" | "path"> = {},
): void {
  context.issues.push({ code, path, ...refs });
}

function exactKeys(
  value: JsonRecord,
  allowed: readonly string[],
  path: string,
  context: ParseContext,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      issue(context, "unknown-field", `${path}.${key}`);
    }
  }
  for (const key of allowed) {
    if (!(key in value)) {
      issue(context, "missing-field", `${path}.${key}`);
    }
  }
}

function parseRecord(
  value: unknown,
  path: string,
  context: ParseContext,
): JsonRecord | undefined {
  if (!isRecord(value)) {
    issue(context, "invalid-type", path);
    return undefined;
  }
  return value;
}

function parseString(
  value: unknown,
  path: string,
  context: ParseContext,
): string | undefined {
  if (typeof value !== "string") {
    issue(context, "invalid-type", path);
    return undefined;
  }
  if (value.trim().length === 0) {
    issue(context, "empty-value", path);
    return undefined;
  }
  return value;
}

function parseInteger(
  value: unknown,
  path: string,
  context: ParseContext,
): number | undefined {
  if (!Number.isInteger(value) || (value as number) < 1) {
    issue(context, "invalid-format", path);
    return undefined;
  }
  return value as number;
}

function parseEnum<const T extends readonly string[]>(
  value: unknown,
  options: T,
  path: string,
  context: ParseContext,
): T[number] | undefined {
  if (typeof value !== "string") {
    issue(context, "invalid-type", path);
    return undefined;
  }
  if (!options.includes(value)) {
    issue(context, "invalid-enum", path);
    return undefined;
  }
  return value as T[number];
}

function parseStringArray(
  value: unknown,
  path: string,
  context: ParseContext,
  allowEmpty = true,
): string[] | undefined {
  if (!Array.isArray(value)) {
    issue(context, "invalid-type", path);
    return undefined;
  }
  if (!allowEmpty && value.length === 0) {
    issue(context, "empty-value", path);
    return undefined;
  }

  const result: string[] = [];
  for (const [index, item] of value.entries()) {
    const parsed = parseString(item, `${path}[${index}]`, context);
    if (parsed !== undefined) result.push(parsed);
  }
  return result;
}

function parseStructuredNumber(
  value: unknown,
  path: string,
  context: ParseContext,
): StructuredNumber | undefined {
  const record = parseRecord(value, path, context);
  if (record === undefined) return undefined;
  exactKeys(record, ["key", "value", "unit", "currency", "scale"], path, context);

  const key = parseString(record.key, `${path}.key`, context);
  const numberValue = parseString(record.value, `${path}.value`, context);
  const unit = parseString(record.unit, `${path}.unit`, context);
  let currency: string | null | undefined;
  if (record.currency === null) {
    currency = null;
  } else {
    currency = parseString(record.currency, `${path}.currency`, context);
  }
  const scale = parseEnum(record.scale, NUMBER_SCALES, `${path}.scale`, context);

  if (numberValue !== undefined && !DECIMAL_PATTERN.test(numberValue)) {
    issue(context, "invalid-format", `${path}.value`);
  }

  if (
    key === undefined ||
    numberValue === undefined ||
    unit === undefined ||
    currency === undefined ||
    scale === undefined ||
    !DECIMAL_PATTERN.test(numberValue)
  ) {
    return undefined;
  }

  return { key, value: numberValue, unit, currency, scale };
}

function parseStructuredTime(
  value: unknown,
  path: string,
  context: ParseContext,
): StructuredTime | undefined {
  const record = parseRecord(value, path, context);
  if (record === undefined) return undefined;
  exactKeys(record, ["key", "value", "role"], path, context);

  const key = parseString(record.key, `${path}.key`, context);
  const timeValue = parseString(record.value, `${path}.value`, context);
  const role = parseEnum(record.role, TIME_ROLES, `${path}.role`, context);

  if (
    timeValue !== undefined &&
    (!ABSOLUTE_TIME_PATTERN.test(timeValue) || Number.isNaN(Date.parse(timeValue)))
  ) {
    issue(context, "invalid-format", `${path}.value`);
  }

  if (
    key === undefined ||
    timeValue === undefined ||
    role === undefined ||
    !ABSOLUTE_TIME_PATTERN.test(timeValue) ||
    Number.isNaN(Date.parse(timeValue))
  ) {
    return undefined;
  }

  return { key, value: timeValue, role };
}

function parseStructuredArray<T>(
  value: unknown,
  path: string,
  context: ParseContext,
  parser: (item: unknown, itemPath: string, context: ParseContext) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value)) {
    issue(context, "invalid-type", path);
    return undefined;
  }
  const result: T[] = [];
  for (const [index, item] of value.entries()) {
    const parsed = parser(item, `${path}[${index}]`, context);
    if (parsed !== undefined) result.push(parsed);
  }
  return result;
}

function parseCitation(
  value: unknown,
  path: string,
  context: ParseContext,
): SummaryCitation | undefined {
  const record = parseRecord(value, path, context);
  if (record === undefined) return undefined;
  exactKeys(record, ["articleId", "articleVersionId", "claimIds"], path, context);

  const articleId = parseString(record.articleId, `${path}.articleId`, context);
  const articleVersionId = parseString(
    record.articleVersionId,
    `${path}.articleVersionId`,
    context,
  );
  const claimIds = parseStringArray(
    record.claimIds,
    `${path}.claimIds`,
    context,
    false,
  );

  if (
    articleId === undefined ||
    articleVersionId === undefined ||
    claimIds === undefined
  ) {
    return undefined;
  }
  return { articleId, articleVersionId, claimIds };
}

function parseAssertion(
  value: unknown,
  path: string,
  context: ParseContext,
): ProposedAssertion | undefined {
  const record = parseRecord(value, path, context);
  if (record === undefined) return undefined;
  exactKeys(
    record,
    [
      "propositionId",
      "epistemicStatus",
      "polarity",
      "entities",
      "numbers",
      "times",
    ],
    path,
    context,
  );

  const propositionId = parseString(
    record.propositionId,
    `${path}.propositionId`,
    context,
  );
  const epistemicStatus = parseEnum(
    record.epistemicStatus,
    CLAIM_EPISTEMIC_STATUSES,
    `${path}.epistemicStatus`,
    context,
  );
  const polarity = parseEnum(
    record.polarity,
    CLAIM_POLARITIES,
    `${path}.polarity`,
    context,
  );
  const entities = parseStringArray(record.entities, `${path}.entities`, context);
  const numbers = parseStructuredArray(
    record.numbers,
    `${path}.numbers`,
    context,
    parseStructuredNumber,
  );
  const times = parseStructuredArray(
    record.times,
    `${path}.times`,
    context,
    parseStructuredTime,
  );

  if (
    propositionId === undefined ||
    epistemicStatus === undefined ||
    polarity === undefined ||
    entities === undefined ||
    numbers === undefined ||
    times === undefined
  ) {
    return undefined;
  }

  return {
    propositionId,
    epistemicStatus,
    polarity,
    entities,
    numbers,
    times,
  };
}

function parseSentence(
  value: unknown,
  path: string,
  context: ParseContext,
): ProposedSummarySentence | undefined {
  const record = parseRecord(value, path, context);
  if (record === undefined) return undefined;
  exactKeys(
    record,
    ["id", "kind", "text", "claimIds", "citations", "assertion"],
    path,
    context,
  );

  const id = parseString(record.id, `${path}.id`, context);
  const kind = parseEnum(
    record.kind,
    SUMMARY_SENTENCE_KINDS,
    `${path}.kind`,
    context,
  );
  const text = parseString(record.text, `${path}.text`, context);
  const claimIds = parseStringArray(
    record.claimIds,
    `${path}.claimIds`,
    context,
    false,
  );
  const citations = parseStructuredArray(
    record.citations,
    `${path}.citations`,
    context,
    parseCitation,
  );
  if (Array.isArray(record.citations) && record.citations.length === 0) {
    issue(context, "empty-value", `${path}.citations`);
  }
  const assertion = parseAssertion(record.assertion, `${path}.assertion`, context);

  if (
    id === undefined ||
    kind === undefined ||
    text === undefined ||
    claimIds === undefined ||
    citations === undefined ||
    citations.length === 0 ||
    assertion === undefined
  ) {
    return undefined;
  }

  return { id, kind, text, claimIds, citations, assertion };
}

export function parseProposedSummary(value: unknown): SummaryValidationResult {
  const context: ParseContext = { issues: [] };
  const record = parseRecord(value, "$", context);
  if (record === undefined) return { valid: false, issues: context.issues };
  exactKeys(
    record,
    ["schemaVersion", "snapshotId", "snapshotVersion", "sentences"],
    "$",
    context,
  );

  const schemaVersion = parseEnum(
    record.schemaVersion,
    [SUMMARY_SCHEMA_VERSION] as const,
    "$.schemaVersion",
    context,
  );
  const snapshotId = parseString(record.snapshotId, "$.snapshotId", context);
  const snapshotVersion = parseInteger(
    record.snapshotVersion,
    "$.snapshotVersion",
    context,
  );
  const sentences = parseStructuredArray(
    record.sentences,
    "$.sentences",
    context,
    parseSentence,
  );
  if (Array.isArray(record.sentences) && record.sentences.length === 0) {
    issue(context, "empty-value", "$.sentences");
  }

  if (
    context.issues.length > 0 ||
    schemaVersion === undefined ||
    snapshotId === undefined ||
    snapshotVersion === undefined ||
    sentences === undefined ||
    sentences.length === 0
  ) {
    return { valid: false, issues: context.issues };
  }

  return {
    valid: true,
    summary: { schemaVersion, snapshotId, snapshotVersion, sentences },
    issues: [],
  };
}

function articleVersionKey(articleId: string, articleVersionId: string): string {
  return `${articleId}\u0000${articleVersionId}`;
}

function numberKey(value: StructuredNumber): string {
  return [value.key, value.value, value.unit, value.currency ?? "", value.scale].join(
    "\u0000",
  );
}

function timeKey(value: StructuredTime): string {
  return [value.key, value.value, value.role].join("\u0000");
}

function citationKey(citation: SummaryCitation): string {
  return [
    citation.articleId,
    citation.articleVersionId,
    [...citation.claimIds].sort().join("\u0001"),
  ].join("\u0000");
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return rightSet.size === right.length && left.every((value) => rightSet.has(value));
}

function validateSnapshot(snapshot: EventSnapshot): SummaryValidationIssue[] {
  const issues: SummaryValidationIssue[] = [];
  if (
    snapshot.schemaVersion !== EVENT_SNAPSHOT_SCHEMA_VERSION ||
    snapshot.snapshotId.trim().length === 0 ||
    !Number.isInteger(snapshot.snapshotVersion) ||
    snapshot.snapshotVersion < 1
  ) {
    issues.push({ code: "invalid-snapshot", path: "$snapshot" });
    return issues;
  }

  const articleKeys = new Set<string>();
  for (const [index, article] of snapshot.articleVersions.entries()) {
    const path = `$snapshot.articleVersions[${index}]`;
    if (
      article.articleId.trim().length === 0 ||
      article.articleVersionId.trim().length === 0 ||
      !ARTICLE_VERSION_STATES.includes(article.state)
    ) {
      issues.push({ code: "invalid-snapshot", path });
      continue;
    }
    const key = articleVersionKey(article.articleId, article.articleVersionId);
    if (articleKeys.has(key)) issues.push({ code: "invalid-snapshot", path });
    articleKeys.add(key);
  }

  const claimIds = new Set<string>();
  for (const [index, claim] of snapshot.claims.entries()) {
    const path = `$snapshot.claims[${index}]`;
    if (
      claim.id.trim().length === 0 ||
      claim.articleId.trim().length === 0 ||
      claim.articleVersionId.trim().length === 0 ||
      claim.propositionId.trim().length === 0 ||
      !CLAIM_STATES.includes(claim.state) ||
      !CLAIM_EPISTEMIC_STATUSES.includes(claim.epistemicStatus) ||
      !CLAIM_POLARITIES.includes(claim.polarity) ||
      !articleKeys.has(articleVersionKey(claim.articleId, claim.articleVersionId))
    ) {
      issues.push({ code: "invalid-snapshot", path, claimId: claim.id });
      continue;
    }
    if (claimIds.has(claim.id)) {
      issues.push({ code: "invalid-snapshot", path, claimId: claim.id });
    }
    claimIds.add(claim.id);
  }
  return issues;
}

function pushSentenceIssue(
  issues: SummaryValidationIssue[],
  code: SummaryValidationIssue["code"],
  path: string,
  sentence: ProposedSummarySentence,
  refs: Omit<SummaryValidationIssue, "code" | "path" | "sentenceId"> = {},
): void {
  issues.push({ code, path, sentenceId: sentence.id, ...refs });
}

function validateSentence(
  sentence: ProposedSummarySentence,
  sentenceIndex: number,
  snapshot: EventSnapshot,
  issues: SummaryValidationIssue[],
): void {
  const path = `$.sentences[${sentenceIndex}]`;
  const articles = new Map(
    snapshot.articleVersions.map((article) => [
      articleVersionKey(article.articleId, article.articleVersionId),
      article,
    ]),
  );
  const claims = new Map(snapshot.claims.map((claim) => [claim.id, claim]));
  const citedClaims: RetainedClaim[] = [];
  const citationKeys = new Set<string>();
  const citedClaimIds = new Set<string>();

  for (const [citationIndex, citation] of sentence.citations.entries()) {
    const citationPath = `${path}.citations[${citationIndex}]`;
    const key = citationKey(citation);
    if (citationKeys.has(key)) {
      pushSentenceIssue(issues, "duplicate-citation", citationPath, sentence, {
        articleId: citation.articleId,
        articleVersionId: citation.articleVersionId,
      });
    }
    citationKeys.add(key);

    const article = articles.get(
      articleVersionKey(citation.articleId, citation.articleVersionId),
    );
    if (article === undefined) {
      pushSentenceIssue(issues, "unknown-article-version", citationPath, sentence, {
        articleId: citation.articleId,
        articleVersionId: citation.articleVersionId,
      });
    } else if (article.state !== "active") {
      pushSentenceIssue(issues, "disabled-article-version", citationPath, sentence, {
        articleId: citation.articleId,
        articleVersionId: citation.articleVersionId,
      });
    }

    for (const [claimIndex, claimId] of citation.claimIds.entries()) {
      const claimPath = `${citationPath}.claimIds[${claimIndex}]`;
      if (citedClaimIds.has(claimId)) {
        pushSentenceIssue(issues, "duplicate-claim-reference", claimPath, sentence, {
          claimId,
        });
      }
      citedClaimIds.add(claimId);

      const claim = claims.get(claimId);
      if (claim === undefined) {
        pushSentenceIssue(issues, "unknown-claim", claimPath, sentence, { claimId });
        continue;
      }
      citedClaims.push(claim);
      if (claim.state !== "active") {
        pushSentenceIssue(issues, "disabled-claim", claimPath, sentence, { claimId });
      }
      if (
        claim.articleId !== citation.articleId ||
        claim.articleVersionId !== citation.articleVersionId
      ) {
        pushSentenceIssue(issues, "claim-provenance-mismatch", claimPath, sentence, {
          articleId: citation.articleId,
          articleVersionId: citation.articleVersionId,
          claimId,
        });
      }
    }
  }

  if (!sameStringSet(sentence.claimIds, [...citedClaimIds])) {
    pushSentenceIssue(issues, "claim-set-mismatch", `${path}.claimIds`, sentence);
  }
  if (citedClaims.length === 0) return;

  const propositionIds = new Set(citedClaims.map((claim) => claim.propositionId));
  if (propositionIds.size !== 1) {
    pushSentenceIssue(issues, "mixed-proposition", `${path}.assertion`, sentence);
  }
  if (
    propositionIds.size !== 1 ||
    !propositionIds.has(sentence.assertion.propositionId)
  ) {
    pushSentenceIssue(
      issues,
      "proposition-mismatch",
      `${path}.assertion.propositionId`,
      sentence,
    );
  }

  if (
    citedClaims.some(
      (claim) =>
        !STATUS_DOWNGRADE_POLICY[claim.epistemicStatus].has(
          sentence.assertion.epistemicStatus,
        ),
    )
  ) {
    pushSentenceIssue(
      issues,
      "epistemic-upgrade",
      `${path}.assertion.epistemicStatus`,
      sentence,
    );
  }

  const polarities = new Set(citedClaims.map((claim) => claim.polarity));
  if (polarities.size !== 1) {
    pushSentenceIssue(issues, "mixed-polarity", `${path}.assertion.polarity`, sentence);
  }
  if (polarities.size !== 1 || !polarities.has(sentence.assertion.polarity)) {
    pushSentenceIssue(
      issues,
      "polarity-mismatch",
      `${path}.assertion.polarity`,
      sentence,
    );
  }

  for (const [entityIndex, entity] of sentence.assertion.entities.entries()) {
    if (citedClaims.some((claim) => !claim.entities.includes(entity))) {
      pushSentenceIssue(
        issues,
        "unsupported-entity",
        `${path}.assertion.entities[${entityIndex}]`,
        sentence,
      );
    }
  }

  for (const [numberIndex, number] of sentence.assertion.numbers.entries()) {
    const expected = numberKey(number);
    if (
      citedClaims.some(
        (claim) => !claim.numbers.some((candidate) => numberKey(candidate) === expected),
      )
    ) {
      pushSentenceIssue(
        issues,
        "unsupported-number",
        `${path}.assertion.numbers[${numberIndex}]`,
        sentence,
      );
    }
  }

  for (const [timeIndex, time] of sentence.assertion.times.entries()) {
    const expected = timeKey(time);
    if (
      citedClaims.some(
        (claim) => !claim.times.some((candidate) => timeKey(candidate) === expected),
      )
    ) {
      pushSentenceIssue(
        issues,
        "unsupported-time",
        `${path}.assertion.times[${timeIndex}]`,
        sentence,
      );
    }
  }
}

export function validateProposedSummary(
  value: unknown,
  snapshot: EventSnapshot,
): SummaryValidationResult {
  const snapshotIssues = validateSnapshot(snapshot);
  if (snapshotIssues.length > 0) return { valid: false, issues: snapshotIssues };

  const parsed = parseProposedSummary(value);
  if (!parsed.valid) return parsed;

  const { summary } = parsed;
  const issues: SummaryValidationIssue[] = [];
  if (summary.snapshotId !== snapshot.snapshotId) {
    issues.push({ code: "snapshot-id-mismatch", path: "$.snapshotId" });
  }
  if (summary.snapshotVersion !== snapshot.snapshotVersion) {
    issues.push({ code: "snapshot-version-mismatch", path: "$.snapshotVersion" });
  }

  const sentenceIds = new Set<string>();
  let oneLineCount = 0;
  for (const [index, sentence] of summary.sentences.entries()) {
    if (sentenceIds.has(sentence.id)) {
      pushSentenceIssue(
        issues,
        "duplicate-sentence-id",
        `$.sentences[${index}].id`,
        sentence,
      );
    }
    sentenceIds.add(sentence.id);
    if (sentence.kind === "one-line") oneLineCount += 1;
    validateSentence(sentence, index, snapshot, issues);
  }
  if (oneLineCount > 1) {
    issues.push({
      code: "multiple-one-line-sentences",
      path: "$.sentences",
    });
  }

  return issues.length === 0
    ? { valid: true, summary, issues: [] }
    : { valid: false, issues };
}
