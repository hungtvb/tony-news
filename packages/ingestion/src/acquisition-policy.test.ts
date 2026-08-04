import assert from "node:assert/strict";
import test from "node:test";

import { decideAcquisitionRoute } from "./acquisition-policy.ts";

const enabledPolicy = {
  enabledSourceIds: new Set(["tto-tech"]),
  browserRunConfigured: true,
};

test("keeps quality-ready content on direct acquisition", () => {
  assert.deepEqual(
    decideAcquisitionRoute(
      "tto-tech",
      { ok: true, qualityDecision: "ready" },
      enabledPolicy,
    ),
    { route: "direct", reason: "direct-quality-ready" },
  );
});

test("routes fallback-required content only for enabled sources", () => {
  assert.deepEqual(
    decideAcquisitionRoute(
      "tto-tech",
      { ok: true, qualityDecision: "fallback-required" },
      enabledPolicy,
    ),
    { route: "browser-markdown", reason: "browser-fallback-enabled" },
  );

  assert.deepEqual(
    decideAcquisitionRoute(
      "vne-tech",
      { ok: true, qualityDecision: "fallback-required" },
      enabledPolicy,
    ),
    { route: "hold-for-review", reason: "browser-fallback-unavailable" },
  );
});

test("holds fallback-required content when Browser Run is not configured", () => {
  assert.deepEqual(
    decideAcquisitionRoute(
      "tto-tech",
      { ok: true, qualityDecision: "fallback-required" },
      { ...enabledPolicy, browserRunConfigured: false },
    ),
    { route: "hold-for-review", reason: "browser-fallback-unavailable" },
  );
});

test("never sends review or failed content directly to AI", () => {
  assert.equal(
    decideAcquisitionRoute(
      "tto-tech",
      { ok: true, qualityDecision: "review" },
      enabledPolicy,
    ).route,
    "hold-for-review",
  );

  assert.equal(
    decideAcquisitionRoute(
      "tto-tech",
      { ok: false, qualityDecision: "failed" },
      enabledPolicy,
    ).route,
    "failed",
  );
});
