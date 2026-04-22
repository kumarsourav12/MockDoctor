import { describe, expect, it, vi } from "vitest";
import { runCliCommand } from "../src/cli-runner.js";
import type { CliOptions, ComparisonResult } from "../src/types.js";

function createResult(): ComparisonResult {
  return {
    contractPath: "/tmp/openapi.yaml",
    contractType: "openapi",
    issues: [],
    operationsChecked: 3,
    readyApiPath: "/tmp/readyapi.xml",
    responsesChecked: 4,
    servicesChecked: 1
  };
}

describe("cli runner telemetry", () => {
  it("sends CLI telemetry when an endpoint is configured", async () => {
    const sendCliTelemetry = vi.fn(async () => undefined);
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = await runCliCommand(
      {
        openapi: "./openapi.yaml",
        readyapi: "./readyapi.xml"
      } satisfies CliOptions,
      {
        MOCKDOCTOR_TELEMETRY_ENDPOINT: "https://example.com/ingest"
      },
      {
        stderr,
        stdout
      },
      {
        async getVersion() {
          return "0.1.0";
        },
        async runCompareWithConfig() {
          return {
            config: {
              contract: {
                kind: "openapi",
                path: "/tmp/openapi.yaml"
              },
              cwd: process.cwd(),
              format: "text",
              readyApiPath: "/tmp/readyapi.xml",
              requestedServices: []
            },
            result: createResult()
          };
        },
        sendCliTelemetry,
        async writeHtmlReport() {
          throw new Error("should not write html");
        }
      }
    );

    expect(exitCode).toBe(0);
    expect(sendCliTelemetry).toHaveBeenCalledTimes(1);
    expect(sendCliTelemetry.mock.calls[0][0]).toMatchObject({
      event: "compare.completed",
      result: expect.objectContaining({
        contractType: "openapi"
      }),
      version: "0.1.0"
    });
  });

  it("still passes the disable flag through to telemetry resolution", async () => {
    const sendCliTelemetry = vi.fn(async () => undefined);

    await runCliCommand(
      {
        openapi: "./openapi.yaml",
        readyapi: "./readyapi.xml"
      },
      {
        MOCKDOCTOR_DISABLE_TELEMETRY: "1",
        MOCKDOCTOR_TELEMETRY_ENDPOINT: "https://example.com/ingest"
      },
      {
        stderr() {},
        stdout() {}
      },
      {
        async getVersion() {
          return "0.1.0";
        },
        async runCompareWithConfig() {
          return {
            config: {
              contract: {
                kind: "openapi",
                path: "/tmp/openapi.yaml"
              },
              cwd: process.cwd(),
              format: "text",
              readyApiPath: "/tmp/readyapi.xml",
              requestedServices: []
            },
            result: createResult()
          };
        },
        sendCliTelemetry,
        async writeHtmlReport() {
          throw new Error("should not write html");
        }
      }
    );

    expect(sendCliTelemetry).toHaveBeenCalledTimes(1);
    expect(sendCliTelemetry.mock.calls[0][0].env?.MOCKDOCTOR_DISABLE_TELEMETRY).toBe("1");
  });
});
