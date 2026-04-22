import { describe, expect, it } from "vitest";
import {
  isTelemetryDisabled,
  resolveTelemetryTarget,
  TELEMETRY_DISABLE_ENV_VAR
} from "../src/telemetry-config.js";

describe("telemetry configuration", () => {
  it("resolves an explicit endpoint ahead of environment values", () => {
    const target = resolveTelemetryTarget({
      env: {
        MOCKDOCTOR_TELEMETRY_ENDPOINT: "https://env.example/ingest",
        MOCKDOCTOR_TELEMETRY_TOKEN: "env-token"
      },
      explicitEndpoint: "https://explicit.example/ingest",
      explicitToken: "explicit-token"
    });

    expect(target).toEqual({
      endpoint: "https://explicit.example/ingest",
      token: "explicit-token"
    });
  });

  it("respects the shared disable flag even when an endpoint is provided", () => {
    const target = resolveTelemetryTarget({
      env: {
        [TELEMETRY_DISABLE_ENV_VAR]: "true",
        MOCKDOCTOR_TELEMETRY_ENDPOINT: "https://env.example/ingest"
      }
    });

    expect(target).toBeUndefined();
  });

  it("recognizes common truthy disable values", () => {
    expect(isTelemetryDisabled("1")).toBe(true);
    expect(isTelemetryDisabled("true")).toBe(true);
    expect(isTelemetryDisabled("yes")).toBe(true);
    expect(isTelemetryDisabled("on")).toBe(true);
    expect(isTelemetryDisabled("false")).toBe(false);
    expect(isTelemetryDisabled(undefined)).toBe(false);
  });
});
