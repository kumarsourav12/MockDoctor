import { readFile } from "node:fs/promises";
import { formatJsonReport, formatTextReport, writeHtmlReport } from "./report.js";
import { runCompareWithConfig } from "./run.js";
import { DEFAULT_TELEMETRY_ENDPOINT } from "./telemetry-config.js";
import { sendCliTelemetry } from "./usage-telemetry.js";
import type { CliOptions } from "./types.js";

type CliContext = {
  stderr(message: string): void;
  stdout(message: string): void;
};

type CliDependencies = {
  getVersion(): Promise<string>;
  runCompareWithConfig: typeof runCompareWithConfig;
  sendCliTelemetry: typeof sendCliTelemetry;
  writeHtmlReport: typeof writeHtmlReport;
};

const defaultContext: CliContext = {
  stderr(message) {
    process.stderr.write(message);
  },
  stdout(message) {
    process.stdout.write(message);
  }
};

const defaultDependencies: CliDependencies = {
  async getVersion() {
    const packageJsonPath = new URL("../package.json", import.meta.url);
    const raw = await readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "unknown";
  },
  runCompareWithConfig,
  sendCliTelemetry,
  writeHtmlReport
};

export async function runCliCommand(
  options: CliOptions,
  env: Record<string, string | undefined> = process.env,
  context: CliContext = defaultContext,
  dependencies: CliDependencies = defaultDependencies
): Promise<number> {
  const version = await dependencies.getVersion();

  try {
    const { config, result } = await dependencies.runCompareWithConfig(options);
    const report = config.format === "json" ? formatJsonReport(result) : formatTextReport(result);

    context.stdout(`${report}\n`);

    if (config.htmlReportPath && result.issues.length > 0) {
      await dependencies.writeHtmlReport(result, config.htmlReportPath);
      context.stderr(`MockDoctor wrote HTML report to ${config.htmlReportPath}\n`);
    }

    await trySendCliTelemetry(dependencies, context, {
      configProvided: Boolean(options.config),
      defaultEndpoint: DEFAULT_TELEMETRY_ENDPOINT,
      env,
      event: "compare.completed",
      htmlReportRequested: Boolean(config.htmlReportPath),
      result,
      serviceFilterCount: config.requestedServices.length,
      version
    });

    return result.issues.length > 0 ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.stderr(`MockDoctor failed: ${message}\n`);

    await trySendCliTelemetry(dependencies, context, {
      configProvided: Boolean(options.config),
      defaultEndpoint: DEFAULT_TELEMETRY_ENDPOINT,
      env,
      errorMessage: message,
      event: "compare.failed",
      htmlReportRequested: Boolean(options.htmlReport),
      serviceFilterCount: options.service?.length ?? 0,
      version
    });

    return 1;
  }
}

async function trySendCliTelemetry(
  dependencies: CliDependencies,
  context: CliContext,
  options: {
    configProvided: boolean;
    defaultEndpoint?: string;
    env: Record<string, string | undefined>;
    errorMessage?: string;
    event: "compare.completed" | "compare.failed";
    htmlReportRequested: boolean;
    result?: Awaited<ReturnType<typeof runCompareWithConfig>>["result"];
    serviceFilterCount: number;
    version: string;
  }
): Promise<void> {
  try {
    await dependencies.sendCliTelemetry({
      config: {
        configProvided: options.configProvided,
        htmlReportRequested: options.htmlReportRequested,
        serviceFilterCount: options.serviceFilterCount
      },
      defaultEndpoint: options.defaultEndpoint,
      env: options.env,
      errorMessage: options.errorMessage,
      event: options.event,
      result: options.result,
      version: options.version
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.stderr(`MockDoctor telemetry warning: ${message}\n`);
  }
}
