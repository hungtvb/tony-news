import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadBenchmarkManifest } from "../../../packages/benchmarks/src/manifest.ts";
import { evaluateEventRelations } from "../../../packages/clustering/src/evaluation.ts";

interface CliOptions {
  json: boolean;
  failOnProvisionalMismatch: boolean;
  manifestPath: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    failOnProvisionalMismatch: false,
    manifestPath: fileURLToPath(
      new URL(
        "../../../docs/benchmarks/benchmark-contract.v2.json",
        import.meta.url,
      ),
    ),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--fail-on-provisional-mismatch") {
      options.failOnProvisionalMismatch = true;
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
  const report = evaluateEventRelations(manifest);
  const result = {
    checkedAt: new Date().toISOString(),
    manifestPath: options.manifestPath,
    ...report,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `Event relation policy ${report.policyVersion} evaluated ${report.summary.evaluatedCases} relational cases from ${report.datasetVersion}.`,
    );
    console.table(
      report.cases.map((item) => ({
        caseId: item.caseId,
        labelStatus: item.labelStatus,
        expected: item.expectedRelation,
        predicted: item.predictedRelation,
        matches: item.matchesExpected,
      })),
    );
    console.log("Accepted-label counts:", report.summary.accepted);
    console.log("Provisional review counts:", report.summary.provisionalReview);
    console.log(
      "Provisional labels are review evidence and are excluded from accepted-label metrics.",
    );
  }

  const strictProvisionalFailure =
    options.failOnProvisionalMismatch &&
    report.strictProvisionalFailureCaseIds.length > 0;
  if (report.blockingFailureCaseIds.length > 0 || strictProvisionalFailure) {
    const failures = new Set([
      ...report.blockingFailureCaseIds,
      ...(strictProvisionalFailure
        ? report.strictProvisionalFailureCaseIds
        : []),
    ]);
    throw new Error(
      `Event relation evaluation failed for: ${[...failures].join(", ")}`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
