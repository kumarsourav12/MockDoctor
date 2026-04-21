import { compareBundles } from "./compare.js";
import { resolveConfig } from "./config.js";
import { loadJsonContract } from "./json-contract.js";
import { loadOpenApiContract } from "./openapi.js";
import { loadReadyApiBundle } from "./readyapi.js";
import type { CliOptions, ComparisonResult, ResolvedConfig } from "./types.js";

export async function runCompareWithConfig(
  options: CliOptions
): Promise<{ config: ResolvedConfig; result: ComparisonResult }> {
  const config = await resolveConfig(options);
  const result = await runCompareFromConfig(config);
  return { config, result };
}

export async function runCompare(options: CliOptions): Promise<ComparisonResult> {
  const config = await resolveConfig(options);
  return runCompareFromConfig(config);
}

async function runCompareFromConfig(config: ResolvedConfig): Promise<ComparisonResult> {
  const readyApi = await loadReadyApiBundle(config.readyApiPath, config.requestedServices);
  const contract =
    config.contract.kind === "openapi"
      ? await loadOpenApiContract(config.contract.path)
      : await loadJsonContract(config.contract.path);

  return compareBundles(readyApi, contract);
}
