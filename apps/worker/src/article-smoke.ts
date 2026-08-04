import process from "node:process";

import {
  fetchAndInspectArticle,
  type ArticleInspectionResult,
  type ArticleTarget,
} from "../../../packages/ingestion/src/article-normalized.ts";

const PHASE_0_ARTICLE_TARGETS = [
  {
    id: "vne-google-earth-ai",
    publisher: "VnExpress",
    category: "technology",
    url: "https://vnexpress.net/ai-cua-google-earth-vua-ra-da-bi-rut-vi-tran-ngap-deepfake-5104049.html",
  },
  {
    id: "tto-google-earth-ai",
    publisher: "Tuổi Trẻ",
    category: "technology",
    url: "https://tuoitre.vn/google-tam-dung-ai-tao-anh-tren-google-earth-vi-lo-anh-ve-tinh-gia-100260801212001232.htm",
  },
  {
    id: "tn-galaxy-s27-battery",
    publisher: "Thanh Niên",
    category: "technology",
    url: "https://thanhnien.vn/galaxy-s27-ultra-co-buoc-ngoat-lon-ve-dung-luong-pin-sau-7-nam-185260803085046704.htm",
  },
] as const satisfies readonly ArticleTarget[];

interface CliOptions {
  json: boolean;
  targetId?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { json: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--target") {
      const targetId = args[index + 1];
      if (!targetId) {
        throw new Error("--target requires a target ID");
      }
      options.targetId = targetId;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function selectTargets(targetId: string | undefined): readonly ArticleTarget[] {
  if (!targetId) {
    return PHASE_0_ARTICLE_TARGETS;
  }

  const target = PHASE_0_ARTICLE_TARGETS.find(
    (candidate) => candidate.id === targetId,
  );

  if (!target) {
    throw new Error(`Unknown article smoke target: ${targetId}`);
  }

  return [target];
}

async function inspectTargets(
  targets: readonly ArticleTarget[],
): Promise<ArticleInspectionResult[]> {
  const results: ArticleInspectionResult[] = [];

  for (const target of targets) {
    results.push(await fetchAndInspectArticle(target));
  }

  return results;
}

function printHuman(results: readonly ArticleInspectionResult[]): void {
  console.table(
    results.map((result) => ({
      target: result.targetId,
      publisher: result.publisher,
      status: result.ok ? "OK" : "FAIL",
      http: result.httpStatus ?? "-",
      strategy: result.extractionStrategy ?? "-",
      textLength: result.textLength ?? "-",
      paragraphs: result.paragraphCount ?? "-",
      warnings: result.qualityWarnings?.join(", ") ?? "",
      durationMs: result.durationMs,
      error: result.error ?? "",
    })),
  );

  const passed = results.filter((result) => result.ok).length;
  console.log(`\nArticle smoke result: ${passed}/${results.length} targets passed.`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const targets = selectTargets(options.targetId);
  const results = await inspectTargets(targets);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          contentPolicy: "metrics-only-no-full-article-text",
          results,
        },
        null,
        2,
      ),
    );
  } else {
    printHuman(results);
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
