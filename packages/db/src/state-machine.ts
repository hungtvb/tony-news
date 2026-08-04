export type IngestionRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "cancelled";

const ALLOWED_TRANSITIONS: Readonly<
  Record<IngestionRunStatus, readonly IngestionRunStatus[]>
> = {
  queued: ["running", "cancelled"],
  running: ["succeeded", "partial", "failed", "cancelled"],
  succeeded: [],
  partial: ["queued"],
  failed: ["queued"],
  cancelled: [],
};

export function canTransitionIngestionRun(
  current: IngestionRunStatus,
  next: IngestionRunStatus,
): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}

export function assertIngestionRunTransition(
  current: IngestionRunStatus,
  next: IngestionRunStatus,
): void {
  if (!canTransitionIngestionRun(current, next)) {
    throw new Error(`Invalid ingestion run transition: ${current} -> ${next}`);
  }
}

export interface ProcessingFailureInput {
  category:
    | "network"
    | "timeout"
    | "rate-limit"
    | "invalid-feed"
    | "invalid-html"
    | "extraction"
    | "validation"
    | "persistence"
    | "provider"
    | "unknown";
  retryable: boolean;
  message: string;
  attempt: number;
  maxAttempts: number;
  traceId: string;
  details?: Record<string, unknown>;
}

export interface ProcessingFailureDecision {
  terminalStatus: "failed";
  shouldRetry: boolean;
  nextAttempt?: number;
}

export function decideProcessingFailure(
  failure: ProcessingFailureInput,
): ProcessingFailureDecision {
  if (failure.attempt < 1 || failure.maxAttempts < failure.attempt) {
    throw new Error("Invalid processing failure attempt counters");
  }

  const shouldRetry = failure.retryable && failure.attempt < failure.maxAttempts;
  return shouldRetry
    ? {
        terminalStatus: "failed",
        shouldRetry: true,
        nextAttempt: failure.attempt + 1,
      }
    : {
        terminalStatus: "failed",
        shouldRetry: false,
      };
}
