import type {
  ArticleInspectionResult,
  ArticleQualityDecision,
} from "./article-normalized.ts";

export type AcquisitionRoute =
  | "direct"
  | "browser-markdown"
  | "hold-for-review"
  | "failed";

export interface BrowserFallbackPolicy {
  enabledSourceIds: ReadonlySet<string>;
  browserRunConfigured: boolean;
}

export interface AcquisitionRouteDecision {
  route: AcquisitionRoute;
  reason:
    | "direct-quality-ready"
    | "direct-review-required"
    | "browser-fallback-enabled"
    | "browser-fallback-unavailable"
    | "direct-fetch-failed";
}

function routeFromQuality(
  qualityDecision: ArticleQualityDecision,
): Exclude<AcquisitionRoute, "browser-markdown"> {
  if (qualityDecision === "ready") return "direct";
  if (qualityDecision === "failed") return "failed";
  return "hold-for-review";
}

export function decideAcquisitionRoute(
  sourceId: string,
  directResult: Pick<ArticleInspectionResult, "ok" | "qualityDecision">,
  policy: BrowserFallbackPolicy,
): AcquisitionRouteDecision {
  if (!directResult.ok || directResult.qualityDecision === "failed") {
    return { route: "failed", reason: "direct-fetch-failed" };
  }

  if (directResult.qualityDecision === "ready") {
    return { route: "direct", reason: "direct-quality-ready" };
  }

  if (directResult.qualityDecision === "review") {
    return {
      route: routeFromQuality(directResult.qualityDecision),
      reason: "direct-review-required",
    };
  }

  if (
    directResult.qualityDecision === "fallback-required" &&
    policy.browserRunConfigured &&
    policy.enabledSourceIds.has(sourceId)
  ) {
    return {
      route: "browser-markdown",
      reason: "browser-fallback-enabled",
    };
  }

  return {
    route: "hold-for-review",
    reason: "browser-fallback-unavailable",
  };
}
