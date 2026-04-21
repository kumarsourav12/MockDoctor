import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { CliOptions, GuardConfigFile, ResolvedConfig } from "./types.js";

const DEFAULT_CONFIG_FILES = [
  "mockdoctor.config.json",
  "mockdoctor.config.yaml",
  "mockdoctor.config.yml"
];

export async function resolveConfig(options: CliOptions): Promise<ResolvedConfig> {
  const explicitConfigPath = options.config ? path.resolve(options.config) : undefined;
  const configPath = explicitConfigPath ?? (await findDefaultConfigFile());
  const configFile = configPath ? await loadConfigFile(configPath) : {};
  const configDir = configPath ? path.dirname(configPath) : process.cwd();

  const readyApiPath = options.readyapi ?? configFile.readyapi?.path;
  const requestedServices = options.service ?? toArray(configFile.readyapi?.service);
  const openApiPath = options.openapi ?? configFile.contract?.openapi;
  const jsonContractPath = options.contract ?? configFile.contract?.json;
  const htmlReportPath = options.htmlReport ?? configFile.report?.html;

  if (!readyApiPath) {
    throw new Error(
      "No ReadyAPI input provided. Pass --readyapi or add readyapi.path to mockdoctor.config.json."
    );
  }

  if (!openApiPath && !jsonContractPath) {
    throw new Error(
      "No contract input provided. Pass --openapi or --contract, or add contract.openapi / contract.json to the config file."
    );
  }

  if (openApiPath && jsonContractPath) {
    throw new Error("Choose either an OpenAPI spec or a JSON contract, not both.");
  }

  return {
    contract: openApiPath
      ? {
          kind: "openapi",
          path: resolveFrom(configDir, openApiPath)
        }
      : {
          kind: "json-contract",
          path: resolveFrom(configDir, jsonContractPath as string)
        },
    cwd: configDir,
    format: options.format ?? configFile.format ?? "text",
    htmlReportPath: htmlReportPath ? resolveFrom(configDir, htmlReportPath) : undefined,
    readyApiPath: resolveFrom(configDir, readyApiPath),
    requestedServices
  };
}

async function findDefaultConfigFile(): Promise<string | undefined> {
  for (const candidate of DEFAULT_CONFIG_FILES) {
    const fullPath = path.resolve(candidate);

    try {
      await access(fullPath);
      return fullPath;
    } catch {
      continue;
    }
  }

  return undefined;
}

async function loadConfigFile(configPath: string): Promise<GuardConfigFile> {
  const raw = await readFile(configPath, "utf8");
  const extension = path.extname(configPath).toLowerCase();

  if (extension === ".yaml" || extension === ".yml") {
    return (parseYaml(raw) as GuardConfigFile) ?? {};
  }

  return JSON.parse(raw) as GuardConfigFile;
}

function resolveFrom(baseDir: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.resolve(baseDir, targetPath);
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
