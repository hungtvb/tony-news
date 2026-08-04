import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildBenchmarkInventory,
  loadBenchmarkManifest,
} from "../../../packages/benchmarks/src/manifest.ts";

interface CliOptions {
  json: boolean;
  manifestPath: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    manifestPath: fileURLToPath(
      new URL("../../../docs/benchmarks/benchmark-contract.v2.json", import.meta.url),
    ),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--manifest") {
      const manifestPath = args[index + 1];
      if (!manifestPath) {
        throw new Error("--manifest requires a file path");
      }
      options.manifestPath = manifestPath;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await loadBenchmarkManifest(options.manifestPath);
  const inventory = buildBenchmarkInventory(manifest);
  const result = {
    checkedAt: new Date().toISOString(),
    manifestPath: options.manifestPath,
    schemaVersion: manifest.schemaVersion,
    datasetVersion: manifest.datasetVersion,
    inventory,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Benchmark ${manifest.datasetVersion} is valid.`);
  console.table({
    articles: inventory.articleCount,
    cases: inventory.caseCount,
    multiSourceSameEventCases: inventory.multiSourceSameEventCases,
    hardNegativeCases: inventory.hardNegativeCases,
    uncertaintyCases: inventory.uncertaintyCases,
  });
  console.log("Categories:", inventory.categories);
  console.log("Case kinds:", inventory.caseKinds);
  console.log("Label statuses:", inventory.labelStatuses);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
