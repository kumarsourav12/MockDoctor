import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { formatJsonReport, formatTextReport, writeHtmlReport } from "./report.js";
import { runCompareWithConfig } from "./run.js";
import { postTelemetry } from "./telemetry.js";
import type { CliOptions, ComparisonIssue, ComparisonResult } from "./types.js";

type ActionEnv = Record<string, string | undefined>;

type ActionContext = {
  appendSummary(markdown: string): Promise<void>;
  chdir(targetPath: string): void;
  cwd(): string;
  setOutput(name: string, value: string): Promise<void>;
  stderr(message: string): void;
  stdout(message: string): void;
  warn(message: string): void;
};

type ActionDependencies = {
  getVersion(): Promise<string>;
  postTelemetry: typeof postTelemetry;
  runCompareWithConfig: typeof runCompareWithConfig;
  writeHtmlReport: typeof writeHtmlReport;
};

type ParsedActionInput = {
  failOnDrift: boolean;
  options: CliOptions;
  telemetryEndpoint?: string;
  telemetryToken?: string;
  workingDirectory: string;
};

const defaultContext: ActionContext = {
  async appendSummary(markdown) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) {
      return;
    }

    await appendFile(summaryPath, markdown);
  },
  chdir(targetPath) {
    process.chdir(targetPath);
  },
  cwd() {
    return process.cwd();
  },
  async setOutput(name, value) {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) {
      return;
    }

    await appendFile(outputPath, `${name}=${value}\n`);
  },
  stderr(message) {
    process.stderr.write(message);
  },
  stdout(message) {
    process.stdout.write(message);
  },
  warn(message) {
    process.stderr.write(`${message}\n`);
  }
};

const defaultDependencies: ActionDependencies = {
  async getVersion() {
    const packageJsonPath = new URL("../package.json", import.meta.url);
    const raw = await readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "unknown";
  },
  postTelemetry,
  runCompareWithConfig,
  writeHtmlReport
};

export async function runGitHubAction(
  env: ActionEnv,
  context: ActionContext = defaultContext,
  dependencies: ActionDependencies = defaultDependencies
): Promise<number> {
  const originalCwd = context.cwd();
  const input = parseActionInput(env, originalCwd);
  const version = await dependencies.getVersion();

  try {
    context.chdir(input.workingDirectory);

    const { config, result } = await dependencies.runCompareWithConfig(input.options);
    const report = config.format === "json" ? formatJsonReport(result) : formatTextReport(result);
    let htmlReportPath = "";

    context.stdout(`${report}\n`);

    if (config.htmlReportPath && result.issues.length > 0) {
      await dependencies.writeHtmlReport(result, config.htmlReportPath);
      context.stderr(`MockDoctor wrote HTML report to ${config.htmlReportPath}\n`);
      htmlReportPath = config.htmlReportPath;
    }

    await writeOutputs(context, result, htmlReportPath);
    await context.appendSummary(buildSummary(result, htmlReportPath));

    await sendActionTelemetry(dependencies, context, {
      endpoint: input.telemetryEndpoint,
      env,
      event: "compare.completed",
      result,
      token: input.telemetryToken,
      version
    });

    return result.issues.length > 0 && input.failOnDrift ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    context.stderr(`MockDoctor action failed: ${message}\n`);
    await context.appendSummary(`## MockDoctor failed\n\n${message}\n`);

    await sendActionTelemetry(dependencies, context, {
      endpoint: input.telemetryEndpoint,
      env,
      errorMessage: message,
      event: "compare.failed",
      token: input.telemetryToken,
      version
    });

    return 1;
  } finally {
    context.chdir(originalCwd);
  }
}

function parseActionInput(env: ActionEnv, fallbackCwd: string): ParsedActionInput {
  const workspace = env.GITHUB_WORKSPACE
    ? path.resolve(env.GITHUB_WORKSPACE)
    : path.resolve(fallbackCwd);
  const workingDirectoryInput = env.MOCKDOCTOR_WORKING_DIRECTORY?.trim();
  const workingDirectory =
    workingDirectoryInput && workingDirectoryInput.length > 0
      ? resolveFrom(workspace, workingDirectoryInput)
      : workspace;

  return {
    failOnDrift: parseBoolean(env.MOCKDOCTOR_FAIL_ON_DRIFT, true),
    options: {
      config: readOptional(env.MOCKDOCTOR_CONFIG),
      contract: readOptional(env.MOCKDOCTOR_CONTRACT),
      format: readOutputFormat(env.MOCKDOCTOR_FORMAT),
      htmlReport: readOptional(env.MOCKDOCTOR_HTML_REPORT),
      openapi: readOptional(env.MOCKDOCTOR_OPENAPI),
      readyapi: readOptional(env.MOCKDOCTOR_READYAPI),
      service: parseServices(env.MOCKDOCTOR_SERVICE)
    },
    telemetryEndpoint: readOptional(env.MOCKDOCTOR_TELEMETRY_ENDPOINT),
    telemetryToken: readOptional(env.MOCKDOCTOR_TELEMETRY_TOKEN),
    workingDirectory
  };
}

function parseServices(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const services = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return services.length > 0 ? services : undefined;
}

function readOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function readOutputFormat(value: string | undefined): "json" | "text" | undefined {
  const normalized = readOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "json" || normalized === "text") {
    return normalized;
  }

  return undefined;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return defaultValue;
  }

  return !["0", "false", "no", "off"].includes(normalized);
}

function resolveFrom(baseDir: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.resolve(baseDir, targetPath);
}

async function writeOutputs(
  context: ActionContext,
  result: ComparisonResult,
  htmlReportPath: string
): Promise<void> {
  await context.setOutput("contract-path", result.contractPath);
  await context.setOutput("contract-type", result.contractType);
  await context.setOutput("drift-detected", String(result.issues.length > 0));
  await context.setOutput("html-report-path", htmlReportPath);
  await context.setOutput("issues-count", String(result.issues.length));
  await context.setOutput("operations-checked", String(result.operationsChecked));
  await context.setOutput("readyapi-path", result.readyApiPath);
  await context.setOutput("responses-checked", String(result.responsesChecked));
  await context.setOutput("services-checked", String(result.servicesChecked));
}

function buildSummary(result: ComparisonResult, htmlReportPath: string): string {
  const lines = [
    "## MockDoctor",
    "",
    `- ReadyAPI: \`${result.readyApiPath}\``,
    `- Contract: \`${result.contractPath}\` (${result.contractType})`,
    `- Services checked: ${result.servicesChecked}`,
    `- Operations checked: ${result.operationsChecked}`,
    `- Responses checked: ${result.responsesChecked}`,
    `- Issues found: ${result.issues.length}`
  ];

  if (htmlReportPath) {
    lines.push(`- HTML report: \`${htmlReportPath}\``);
  }

  if (result.issues.length === 0) {
    lines.push("", "No contract drift detected.", "");
    return `${lines.join("\n")}\n`;
  }

  lines.push("", "### Top issues", "");

  for (const issue of result.issues.slice(0, 10)) {
    lines.push(`- \`${issue.code}\` ${buildIssueSummary(issue)}`);
  }

  if (result.issues.length > 10) {
    lines.push(`- ...and ${result.issues.length - 10} more`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildIssueSummary(issue: ComparisonIssue): string {
  const labelParts = [issue.operationKey, issue.readyApiService].filter(
    (value): value is string => Boolean(value)
  );

  if (labelParts.length === 0) {
    return issue.message;
  }

  return `${labelParts.join(" | ")} — ${issue.message}`;
}

async function sendActionTelemetry(
  dependencies: ActionDependencies,
  context: ActionContext,
  options: {
    endpoint?: string;
    env: ActionEnv;
    errorMessage?: string;
    event: "compare.completed" | "compare.failed";
    result?: ComparisonResult;
    token?: string;
    version: string;
  }
): Promise<void> {
  if (!options.endpoint) {
    return;
  }

  try {
    await dependencies.postTelemetry(
      options.endpoint,
      {
        actionRepository: options.env.GITHUB_ACTION_REPOSITORY,
        contractType: options.result?.contractType,
        driftDetected: options.result ? options.result.issues.length > 0 : undefined,
        errorMessage: options.errorMessage,
        event: options.event,
        issuesCount: options.result?.issues.length,
        operationsChecked: options.result?.operationsChecked,
        readyApiPathProvided: Boolean(readOptional(options.env.MOCKDOCTOR_READYAPI)),
        ref: options.env.GITHUB_REF,
        repository: options.env.GITHUB_REPOSITORY,
        responsesChecked: options.result?.responsesChecked,
        runnerOs: options.env.RUNNER_OS,
        runId: options.env.GITHUB_RUN_ID,
        servicesChecked: options.result?.servicesChecked,
        source: "github-action",
        timestamp: new Date().toISOString(),
        tool: "mockdoctor",
        version: options.version
      },
      options.token
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.warn(`MockDoctor telemetry warning: ${message}`);
  }
}
