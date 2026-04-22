import { mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGitHubAction } from "../src/action-runner.js";

const repoRoot = path.resolve(".");
const openApiPath = "./test/fixtures/contracts/orders-openapi.yaml";
const readyApiPath = "./test/fixtures/readyapi/orders-project.xml";
const schemaDriftProject = "./test/fixtures/readyapi/orders-project-schema-drift.xml";

function createTestContext() {
  const outputs = new Map<string, string>();
  const summaries: string[] = [];
  let stderr = "";
  let stdout = "";
  let currentCwd = process.cwd();

  return {
    context: {
      async appendSummary(markdown: string) {
        summaries.push(markdown);
      },
      chdir(targetPath: string) {
        currentCwd = targetPath;
      },
      cwd() {
        return currentCwd;
      },
      async setOutput(name: string, value: string) {
        outputs.set(name, value);
      },
      stderr(message: string) {
        stderr += message;
      },
      stdout(message: string) {
        stdout += message;
      },
      warn(message: string) {
        stderr += `${message}\n`;
      }
    },
    getOutputs() {
      return outputs;
    },
    getStderr() {
      return stderr;
    },
    getStdout() {
      return stdout;
    },
    getSummaries() {
      return summaries;
    }
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((directory) => rm(directory, { force: true, recursive: true })));
  tempDirs.length = 0;
});

describe("MockDoctor GitHub Action runner", () => {
  it("succeeds on a matching comparison and writes outputs", async () => {
    const testContext = createTestContext();
    const exitCode = await runGitHubAction(
      {
        GITHUB_WORKSPACE: repoRoot,
        MOCKDOCTOR_OPENAPI: openApiPath,
        MOCKDOCTOR_READYAPI: readyApiPath
      },
      testContext.context
    );

    expect(exitCode).toBe(0);
    expect(testContext.getStdout()).toContain("No contract drift detected.");
    expect(testContext.getOutputs().get("drift-detected")).toBe("false");
    expect(testContext.getOutputs().get("issues-count")).toBe("0");
    expect(testContext.getOutputs().get("contract-type")).toBe("openapi");
    expect(testContext.getSummaries()[0]).toContain("No contract drift detected.");
  });

  it("can keep the workflow green while still reporting drift and writing HTML", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mockdoctor-action-"));
    tempDirs.push(tempDir);
    const reportPath = path.join(tempDir, "artifacts", "drift.html");
    const testContext = createTestContext();

    const exitCode = await runGitHubAction(
      {
        GITHUB_WORKSPACE: repoRoot,
        MOCKDOCTOR_FAIL_ON_DRIFT: "false",
        MOCKDOCTOR_HTML_REPORT: reportPath,
        MOCKDOCTOR_OPENAPI: openApiPath,
        MOCKDOCTOR_READYAPI: schemaDriftProject
      },
      testContext.context
    );

    expect(exitCode).toBe(0);
    expect(testContext.getOutputs().get("drift-detected")).toBe("true");
    expect(testContext.getOutputs().get("issues-count")).toBe("1");
    expect(testContext.getOutputs().get("html-report-path")).toBe(reportPath);
    expect(testContext.getStderr()).toContain(`MockDoctor wrote HTML report to ${reportPath}`);

    const html = await readFile(reportPath, "utf8");
    expect(html).toContain("MockDoctor Drift Report");
    expect(testContext.getSummaries()[0]).toContain("response-body-schema-mismatch");
  });

  it("sends one telemetry event when an endpoint is configured", async () => {
    const events: string[] = [];
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      request.on("end", () => {
        events.push(Buffer.concat(chunks).toString("utf8"));
        response.writeHead(202, { "content-type": "application/json" });
        response.end("{}");
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not read test telemetry server address.");
    }

    try {
      const testContext = createTestContext();
      const exitCode = await runGitHubAction(
        {
          GITHUB_ACTION_REPOSITORY: "kumarsourav12/MockDoctor",
          GITHUB_REF: "refs/heads/main",
          GITHUB_REPOSITORY: "kumarsourav12/consumer-repo",
          GITHUB_RUN_ID: "42",
          GITHUB_WORKSPACE: repoRoot,
          MOCKDOCTOR_OPENAPI: openApiPath,
          MOCKDOCTOR_READYAPI: readyApiPath,
          MOCKDOCTOR_TELEMETRY_ENDPOINT: `http://127.0.0.1:${address.port}/telemetry`,
          RUNNER_OS: "Linux"
        },
        testContext.context
      );

      expect(exitCode).toBe(0);
      expect(events).toHaveLength(1);

      const payload = JSON.parse(events[0]) as Record<string, unknown>;
      expect(payload.tool).toBe("mockdoctor");
      expect(payload.source).toBe("github-action");
      expect(payload.repository).toBe("kumarsourav12/consumer-repo");
      expect(payload.event).toBe("compare.completed");
      expect(payload.driftDetected).toBe(false);
      expect(payload.issuesCount).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
