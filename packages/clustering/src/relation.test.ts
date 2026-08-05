import assert from "node:assert/strict";
import test from "node:test";

import type { BenchmarkArticle } from "../../benchmarks/src/manifest.ts";
import { classifyEventRelation } from "./relation.ts";

function article(
  overrides: Partial<BenchmarkArticle> & Pick<BenchmarkArticle, "id" | "title">,
): BenchmarkArticle {
  return {
    id: overrides.id,
    title: overrides.title,
    category: overrides.category ?? "sports",
    sourceId: overrides.sourceId ?? `source-${overrides.id}`,
    canonicalUrl:
      overrides.canonicalUrl ?? `https://example.com/${overrides.id.toLowerCase()}`,
    observedDate: overrides.observedDate ?? "2026-08-03",
    verification: overrides.verification ?? "page-fetched",
    contentType: overrides.contentType ?? "match-result",
    entities: overrides.entities ?? [],
    uncertainty: overrides.uncertainty ?? "none",
  };
}

test("multiple shared event entities produce a conservative same-event candidate", () => {
  const left = article({
    id: "A",
    title: "Việt Nam thắng Indonesia tại ASEAN Cup",
    entities: ["Việt Nam", "Indonesia", "ASEAN Cup"],
  });
  const right = article({
    id: "B",
    title: "Đánh bại Indonesia, Việt Nam đi tiếp ở ASEAN Cup 2026",
    observedDate: "2026-08-04",
    contentType: "match-analysis",
    entities: ["Việt Nam", "Indonesia", "ASEAN Cup 2026"],
  });

  const decision = classifyEventRelation(left, right);

  assert.equal(decision.relation, "same-event-candidate");
  assert.equal(decision.confidence, "high");
  assert.deepEqual(decision.signals.sharedEntities, [
    "asean cup",
    "indonesia",
    "viet nam",
  ]);
});

test("one specific anchor plus the same content family remains a candidate, not an automatic merge", () => {
  const left = article({
    id: "A",
    category: "entertainment",
    title: "Spider-Man đối đầu The Odyssey",
    contentType: "box-office-report",
    entities: ["Spider-Man", "The Odyssey", "phòng vé"],
  });
  const right = article({
    id: "B",
    category: "entertainment",
    title: "Người Nhện càn quét phòng vé Việt Nam",
    contentType: "box-office-report",
    entities: ["Spider-Man", "Việt Nam", "90 tỉ đồng"],
  });

  const decision = classifyEventRelation(left, right);

  assert.equal(decision.relation, "same-event-candidate");
  assert.equal(decision.confidence, "medium");
  assert.deepEqual(decision.reasons, [
    "single-shared-entity-same-family",
  ]);
});

test("one broad country anchor cannot create a same-event candidate", () => {
  const nationalTeam = article({
    id: "A",
    title: "Việt Nam thắng Indonesia tại ASEAN Cup",
    entities: ["Việt Nam", "Indonesia", "ASEAN Cup"],
  });
  const youthTeam = article({
    id: "B",
    title: "U19 Việt Nam chuẩn bị đấu Thái Lan",
    entities: ["Việt Nam", "Thái Lan", "U19"],
  });

  const decision = classifyEventRelation(nationalTeam, youthTeam);

  assert.equal(decision.relation, "uncertain");
  assert.deepEqual(decision.reasons, [
    "broad-single-entity",
    "insufficient-evidence",
  ]);
});

test("post-match reaction remains related but is protected from merging with the result", () => {
  const result = article({
    id: "A",
    title: "Việt Nam thắng Indonesia",
    entities: ["Việt Nam", "Indonesia", "ASEAN Cup"],
  });
  const reaction = article({
    id: "B",
    title: "HLV Indonesia xin lỗi sau trận thua Việt Nam",
    contentType: "post-match-reaction",
    entities: ["HLV Indonesia", "Việt Nam", "Indonesia"],
  });

  const decision = classifyEventRelation(result, reaction);

  assert.equal(decision.relation, "related-not-merge");
  assert.deepEqual(decision.reasons, ["protected-content-boundary"]);
});

test("player milestone remains a separate story even when team identity overlaps", () => {
  const result = article({
    id: "A",
    title: "Việt Nam thắng Indonesia",
    entities: ["Việt Nam", "Indonesia", "ASEAN Cup"],
  });
  const milestone = article({
    id: "B",
    title: "Quang Hải cân bằng kỷ lục đội tuyển Việt Nam",
    contentType: "player-milestone",
    entities: ["Quang Hải", "đội tuyển Việt Nam", "kỷ lục"],
  });

  assert.equal(
    classifyEventRelation(result, milestone).relation,
    "related-not-merge",
  );
});

test("same category and date without shared entities is a different-event kill test", () => {
  const international = article({
    id: "A",
    title: "Việt Nam thắng Indonesia tại ASEAN Cup",
    entities: ["Việt Nam", "Indonesia", "ASEAN Cup"],
  });
  const domestic = article({
    id: "B",
    title: "CLB TP.HCM I loại Hà Nội khỏi cuộc đua vô địch",
    entities: ["CLB TP.HCM I", "Hà Nội", "giải nữ VĐQG"],
  });

  const decision = classifyEventRelation(international, domestic);

  assert.equal(decision.relation, "different-event");
  assert.ok(decision.reasons.includes("no-shared-entity"));
});

test("cross-category articles are different events even when an entity string overlaps", () => {
  const technology = article({
    id: "A",
    category: "technology",
    title: "AI hỗ trợ tuyển Việt Nam",
    contentType: "analysis-report",
    entities: ["Việt Nam", "AI"],
  });
  const sports = article({
    id: "B",
    title: "Việt Nam thắng Indonesia",
    entities: ["Việt Nam", "Indonesia"],
  });

  const decision = classifyEventRelation(technology, sports);

  assert.equal(decision.relation, "different-event");
  assert.deepEqual(decision.reasons, ["category-mismatch"]);
});

test("classification is symmetric", () => {
  const left = article({
    id: "A",
    title: "Việt Nam thắng Indonesia",
    entities: ["Việt Nam", "Indonesia", "ASEAN Cup"],
  });
  const right = article({
    id: "B",
    title: "Indonesia thua Việt Nam tại ASEAN Cup",
    entities: ["Indonesia", "Việt Nam", "ASEAN Cup"],
  });

  assert.deepEqual(
    classifyEventRelation(left, right),
    classifyEventRelation(right, left),
  );
});
