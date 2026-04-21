import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(".");
const cliPath = path.join(repoRoot, "src/cli.ts");
const tsxPath = path.join(repoRoot, "node_modules/.bin/tsx");
const configDir = path.join(repoRoot, "test/fixtures/config");
const openApiPath = path.join(repoRoot, "test/fixtures/contracts/orders-openapi.yaml");
const schemaDriftProject = path.join(
  repoRoot,
  "test/fixtures/readyapi/orders-project-schema-drift.xml"
);

type CliResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

async function runCli(args: string[], cwd = repoRoot): Promise<CliResult> {
  try {
    const { stderr, stdout } = await execFileAsync(tsxPath, [cliPath, "compare", ...args], {
      cwd
    });

    return {
      exitCode: 0,
      stderr,
      stdout
    };
  } catch (error) {
    const execError = error as Error & {
      code?: number | string;
      stderr?: string;
      stdout?: string;
    };

    return {
      exitCode: typeof execError.code === "number" ? execError.code : 1,
      stderr: execError.stderr ?? "",
      stdout: execError.stdout ?? ""
    };
  }
}

describe("mockdoctor CLI", () => {
  it("discovers the default config file from the working directory", async () => {
    const result = await runCli([], configDir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("MockDoctor");
    expect(result.stdout).toContain("Services checked: 1");
    expect(result.stdout).toContain("No contract drift detected.");
  });

  it("emits JSON and exits non-zero when drift is found", async () => {
    const result = await runCli([
      "--readyapi",
      schemaDriftProject,
      "--openapi",
      openApiPath,
      "--format",
      "json"
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");

    const parsed = JSON.parse(result.stdout) as {
      contractPath: string;
      issues: Array<{ code: string; operationKey?: string }>;
      readyApiPath: string;
    };

    expect(parsed.readyApiPath).toBe(schemaDriftProject);
    expect(parsed.contractPath).toBe(openApiPath);
    expect(parsed.issues.map((issue) => issue.code)).toContain("response-body-schema-mismatch");
    expect(parsed.issues.some((issue) => issue.operationKey === "GET /api/orders/{id}")).toBe(true);
  });

  it("writes an HTML report artifact when drift is found", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mockdoctor-html-"));
    const reportPath = path.join(tempDir, "reports", "drift-report.html");

    try {
      const result = await runCli([
        "--readyapi",
        schemaDriftProject,
        "--openapi",
        openApiPath,
        "--html-report",
        reportPath
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`MockDoctor wrote HTML report to ${reportPath}`);

      const html = await readFile(reportPath, "utf8");
      expect(html).toContain("<title>MockDoctor Drift Report</title>");
      expect(html).toContain("Contract drift needs attention");
      expect(html).toContain("response-body-schema-mismatch");
      expect(html).toContain("GET /api/orders/{id}");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("respects html report and output format from config", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mockdoctor-config-"));

    try {
      const configPath = path.join(tempDir, "mockdoctor.config.json");
      await writeFile(
        configPath,
        JSON.stringify(
          {
            readyapi: {
              path: path.relative(tempDir, schemaDriftProject)
            },
            contract: {
              openapi: path.relative(tempDir, openApiPath)
            },
            format: "json",
            report: {
              html: "./artifacts/drift.html"
            }
          },
          null,
          2
        ),
        "utf8"
      );

      const result = await runCli(["--config", configPath], tempDir);
      const reportPath = path.join(tempDir, "artifacts", "drift.html");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`MockDoctor wrote HTML report to ${reportPath}`);

      const parsed = JSON.parse(result.stdout) as { issues: Array<{ code: string }> };
      expect(parsed.issues.map((issue) => issue.code)).toContain("response-body-schema-mismatch");

      await expect(access(reportPath)).resolves.toBeUndefined();
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
