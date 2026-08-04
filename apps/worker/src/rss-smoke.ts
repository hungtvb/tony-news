import process from "node:process";

import {
  PHASE_0_SOURCES,
  getSourceById,
  validateSourceRegistry,
  type SourceDefinition,
} from "../../../packages/ingestion/src/source-registry.ts";
import {
  fetchAndInspectFeed,
  type FeedInspectionResult,
} from "../../../packages/ingestion/src/rss.ts";

interface CliOptions {
  json: boolean;
  sourceId?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { json: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--source") {
      const sourceId = args[index + 1];
      if (!sourceId) {
        throw new Error("--source requires a source ID");
      }
      options.sourceId = sourceId;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function inspectSources(
  sources: readonly SourceDefinition[],
): Promise<FeedInspectionResult[]> {
  const results: FeedInspectionResult[] = [];

  for (const source of sources) {
    results.push(await fetchAndInspectFeed(source));
  }

  return results;
}

function printHuman(results: readonly FeedInspectionResult[]): void {
  const rows = results.map((result) => ({
    source: result.sourceId,
    publisher: result.publisher,
    category: result.category,
    status: result.ok ? "OK" : "FAIL",
    http: result.httpStatus ?? "-",
    items: result.itemCount ?? "-",
    latest: result.latestPublishedAt ?? "-",
    durationMs: result.durationMs,
    error: result.error ?? "",
  }));

  console.table(rows);

  const passed = results.filter((result) => result.ok).length;
  console.log(`\nRSS smoke result: ${passed}/${results.length} feeds passed.`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const registryIssues = validateSourceRegistry(PHASE_0_SOURCES);

  if (registryIssues.length > 0) {
    throw new Error(`Invalid source registry:\n- ${registryIssues.join("\n- ")}`);
  }

  const sources = options.sourceId
    ? [getSourceById(options.sourceId)]
    : PHASE_0_SOURCES;

  const results = await inspectSources(sources);

  if (options.json) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
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
