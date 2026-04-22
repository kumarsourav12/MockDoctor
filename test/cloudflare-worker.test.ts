import { describe, expect, it } from "vitest";
import {
  BLOB_FIELDS,
  DOUBLE_FIELDS,
  handleTelemetryRequest
} from "../telemetry/cloudflare-worker/src/index.js";

describe("Cloudflare telemetry worker", () => {
  it("accepts valid telemetry and writes one Analytics Engine data point", async () => {
    const writes: Array<{
      blobs: string[];
      doubles: number[];
      indexes: string[];
    }> = [];

    const response = await handleTelemetryRequest(
      new Request("https://example.com/ingest", {
        body: JSON.stringify({
          actionRepository: "kumarsourav12/MockDoctor",
          contractType: "openapi",
          driftDetected: true,
          event: "compare.completed",
          issuesCount: 2,
          operationsChecked: 5,
          ref: "refs/pull/123/head",
          repository: "org/consumer-repo",
          responsesChecked: 8,
          runId: "42",
          runnerOs: "Linux",
          servicesChecked: 2,
          source: "github-action",
          timestamp: "2026-04-22T06:00:00.000Z",
          tool: "mockdoctor",
          version: "0.1.0"
        }),
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json"
        },
        method: "POST"
      }),
      {
        MOCKDOCTOR_INGEST_TOKEN: "secret-token",
        MOCKDOCTOR_USAGE: {
          writeDataPoint(dataPoint) {
            writes.push(dataPoint);
          }
        }
      }
    );

    expect(response.status).toBe(202);
    expect(writes).toHaveLength(1);
    expect(writes[0].blobs).toHaveLength(BLOB_FIELDS.length);
    expect(writes[0].doubles).toHaveLength(DOUBLE_FIELDS.length);
    expect(writes[0].blobs[0]).toBe("mockdoctor");
    expect(writes[0].blobs[3]).toBe("org/consumer-repo");
    expect(writes[0].blobs[9]).toBe("true");
    expect(writes[0].doubles[0]).toBe(2);
    expect(writes[0].indexes[0]).toBe("org/consumer-repo#42");
  });

  it("rejects requests when the bearer token is missing or wrong", async () => {
    const response = await handleTelemetryRequest(
      new Request("https://example.com/ingest", {
        body: JSON.stringify({
          event: "compare.completed",
          source: "github-action",
          timestamp: "2026-04-22T06:00:00.000Z",
          tool: "mockdoctor"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      {
        MOCKDOCTOR_INGEST_TOKEN: "secret-token",
        MOCKDOCTOR_USAGE: {
          writeDataPoint() {
            throw new Error("should not write");
          }
        }
      }
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid payloads clearly", async () => {
    const response = await handleTelemetryRequest(
      new Request("https://example.com/ingest", {
        body: JSON.stringify({
          source: "github-action",
          tool: "mockdoctor"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      {
        MOCKDOCTOR_USAGE: {
          writeDataPoint() {
            throw new Error("should not write");
          }
        }
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Telemetry payload must include a non-empty event name"
    });
  });

  it("returns a health check response", async () => {
    const response = await handleTelemetryRequest(
      new Request("https://example.com/health"),
      {}
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "mockdoctor-telemetry"
    });
  });
});
