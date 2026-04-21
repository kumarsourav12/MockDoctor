import SwaggerParser from "@apidevtools/swagger-parser";
import { normalizeOpenApiSchema } from "./schema.js";
import type { ContractBundle, ContractOperation, ContractResponse } from "./types.js";

const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options", "trace"] as const;

type DereferencedSpec = {
  paths?: Record<string, Record<string, Record<string, unknown>>>;
};

export async function loadOpenApiContract(openApiPath: string): Promise<ContractBundle> {
  const parser = new SwaggerParser();
  const spec = (await parser.dereference(openApiPath)) as DereferencedSpec;
  const operations: ContractOperation[] = [];

  for (const [pathName, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = asRecord(pathItem[method]);
      if (!operation) {
        continue;
      }

      operations.push({
        key: buildOperationKey(method.toUpperCase(), pathName),
        method: method.toUpperCase(),
        operationId: asOptionalString(operation.operationId),
        path: normalizePath(pathName),
        responses: extractResponses(openApiPath, operation.responses),
        sourcePath: openApiPath
      });
    }
  }

  return {
    operations,
    sourcePath: openApiPath,
    sourceType: "openapi"
  };
}

function extractResponses(sourcePath: string, rawResponses: unknown): ContractResponse[] {
  const responses = asRecord(rawResponses);
  if (!responses) {
    return [];
  }

  const extracted: ContractResponse[] = [];

  for (const [statusCode, responseValue] of Object.entries(responses)) {
    const response = asRecord(responseValue);
    if (!response) {
      continue;
    }

    const content = asRecord(response.content);
    if (content) {
      for (const [contentType, mediaValue] of Object.entries(content)) {
        const media = asRecord(mediaValue);
        const schema = asRecord(media?.schema);

        extracted.push({
          bodySchema: schema ? normalizeOpenApiSchema(schema) : undefined,
          contentType,
          sourcePath,
          statusCode: normalizeStatusCode(statusCode)
        });
      }
      continue;
    }

    const swaggerSchema = asRecord(response.schema);
    extracted.push({
      bodySchema: swaggerSchema ? normalizeOpenApiSchema(swaggerSchema) : undefined,
      sourcePath,
      statusCode: normalizeStatusCode(statusCode)
    });
  }

  return extracted;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function buildOperationKey(method: string, pathName: string): string {
  return `${method.toUpperCase()} ${normalizePath(pathName)}`;
}

export function normalizePath(pathName: string): string {
  if (pathName.length === 0) {
    return "/";
  }

  const withLeadingSlash = pathName.startsWith("/") ? pathName : `/${pathName}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

function normalizeStatusCode(statusCode: string): string {
  if (/^[1-5]xx$/i.test(statusCode)) {
    return `${statusCode[0]}XX`;
  }

  return statusCode === "default" ? "default" : statusCode;
}
