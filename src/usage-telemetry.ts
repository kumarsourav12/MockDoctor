import { postTelemetry } from "./telemetry.js";
import { resolveTelemetryTarget } from "./telemetry-config.js";
import type { ComparisonResult } from "./types.js";

type CliTelemetryContext = {
  configProvided: boolean;
  htmlReportRequested: boolean;
  serviceFilterCount: number;
};

type ActionTelemetryContext = {
  actionRepository?: string;
  explicitReadyApiPathProvided: boolean;
  ref?: string;
  repository?: string;
  runId?: string;
  runnerOs?: string;
};

type SendCliTelemetryOptions = {
  config?: CliTelemetryContext;
  defaultEndpoint?: string;
  env?: Record<string, string | undefined>;
  errorMessage?: string;
  event: "compare.completed" | "compare.failed";
  result?: ComparisonResult;
  version: string;
};

type SendActionTelemetryOptions = {
  context?: ActionTelemetryContext;
  defaultEndpoint?: string;
  env?: Record<string, string | undefined>;
  errorMessage?: string;
  event: "compare.completed" | "compare.failed";
  explicitEndpoint?: string;
  explicitToken?: string;
  result?: ComparisonResult;
  version: string;
};

export async function sendCliTelemetry(options: SendCliTelemetryOptions): Promise<void> {
  const target = resolveTelemetryTarget({
    defaultEndpoint: options.defaultEndpoint,
    env: options.env
  });

  if (!target) {
    return;
  }

  await postTelemetry(target.endpoint, buildCliPayload(options), target.token);
}

export async function sendActionTelemetry(options: SendActionTelemetryOptions): Promise<void> {
  const target = resolveTelemetryTarget({
    defaultEndpoint: options.defaultEndpoint,
    env: options.env,
    explicitEndpoint: options.explicitEndpoint,
    explicitToken: options.explicitToken
  });

  if (!target) {
    return;
  }

  await postTelemetry(target.endpoint, buildActionPayload(options), target.token);
}

function buildCliPayload(options: SendCliTelemetryOptions) {
  return {
    ci: Boolean(options.env?.CI),
    command: "compare",
    configProvided: options.config?.configProvided ?? false,
    contractType: options.result?.contractType,
    driftDetected: options.result ? options.result.issues.length > 0 : undefined,
    errorMessage: options.errorMessage,
    event: options.event,
    htmlReportRequested: options.config?.htmlReportRequested ?? false,
    issuesCount: options.result?.issues.length,
    nodeVersion: process.version,
    operationsChecked: options.result?.operationsChecked,
    platform: process.platform,
    responsesChecked: options.result?.responsesChecked,
    serviceFilterCount: options.config?.serviceFilterCount ?? 0,
    servicesChecked: options.result?.servicesChecked,
    source: "cli",
    timestamp: new Date().toISOString(),
    tool: "mockdoctor",
    version: options.version
  };
}

function buildActionPayload(options: SendActionTelemetryOptions) {
  return {
    actionRepository: options.context?.actionRepository,
    contractType: options.result?.contractType,
    driftDetected: options.result ? options.result.issues.length > 0 : undefined,
    errorMessage: options.errorMessage,
    event: options.event,
    explicitReadyApiPathProvided: options.context?.explicitReadyApiPathProvided ?? false,
    issuesCount: options.result?.issues.length,
    operationsChecked: options.result?.operationsChecked,
    ref: options.context?.ref,
    repository: options.context?.repository,
    responsesChecked: options.result?.responsesChecked,
    runId: options.context?.runId,
    runnerOs: options.context?.runnerOs,
    servicesChecked: options.result?.servicesChecked,
    source: "github-action",
    timestamp: new Date().toISOString(),
    tool: "mockdoctor",
    version: options.version
  };
}
