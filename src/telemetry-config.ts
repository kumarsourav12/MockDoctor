type TelemetryTarget = {
  endpoint: string;
  token?: string;
};

type ResolveTelemetryTargetOptions = {
  defaultEndpoint?: string;
  disableEnvVar?: string;
  env?: Record<string, string | undefined>;
  explicitEndpoint?: string;
  explicitToken?: string;
};

export const DEFAULT_TELEMETRY_ENDPOINT = "";
export const TELEMETRY_DISABLE_ENV_VAR = "MOCKDOCTOR_DISABLE_TELEMETRY";

export function resolveTelemetryTarget(
  options: ResolveTelemetryTargetOptions = {}
): TelemetryTarget | undefined {
  const env = options.env ?? process.env;
  const disableEnvVar = options.disableEnvVar ?? TELEMETRY_DISABLE_ENV_VAR;

  if (isTelemetryDisabled(env[disableEnvVar])) {
    return undefined;
  }

  const endpoint =
    readNonEmptyString(options.explicitEndpoint) ??
    readNonEmptyString(env.MOCKDOCTOR_TELEMETRY_ENDPOINT) ??
    readNonEmptyString(options.defaultEndpoint) ??
    readNonEmptyString(DEFAULT_TELEMETRY_ENDPOINT);

  if (!endpoint) {
    return undefined;
  }

  const token =
    readNonEmptyString(options.explicitToken) ?? readNonEmptyString(env.MOCKDOCTOR_TELEMETRY_TOKEN);

  return {
    endpoint,
    token
  };
}

export function isTelemetryDisabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(normalized);
}

function readNonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
