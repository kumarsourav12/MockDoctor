import { readFile } from "node:fs/promises";
import { buildOperationKey, normalizePath } from "./openapi.js";
import { inferSchemaFromExample } from "./schema.js";
import type { ContractBundle, ContractOperation, ContractResponse } from "./types.js";

export async function loadJsonContract(contractPath: string): Promise<ContractBundle> {
  const raw = await readFile(contractPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const operations = extractOperations(parsed, contractPath);

  if (operations.length === 0) {
    throw new Error("The JSON contract did not contain any operations.");
  }

  return {
    operations,
    sourcePath: contractPath,
    sourceType: "json-contract"
  };
}

function extractOperations(value: unknown, sourcePath: string): ContractOperation[] {
  if (!isRecord(value)) {
    throw new Error("The JSON contract root must be an object.");
  }

  if (Array.isArray(value.operations)) {
    return value.operations.map((operation, index) => mapOperation(operation, sourcePath, index));
  }

  if (Array.isArray(value.services)) {
    const operations: ContractOperation[] = [];

    value.services.forEach((service, serviceIndex) => {
      if (!isRecord(service) || !Array.isArray(service.operations)) {
        throw new Error(`services[${serviceIndex}] must contain an operations array.`);
      }

      service.operations.forEach((operation, operationIndex) => {
        operations.push(mapOperation(operation, sourcePath, operationIndex));
      });
    });

    return operations;
  }

  throw new Error("The JSON contract must contain either an operations array or a services array.");
}

function mapOperation(
  value: unknown,
  sourcePath: string,
  index: number
): ContractOperation {
  if (!isRecord(value)) {
    throw new Error(`operations[${index}] must be an object.`);
  }

  const method = readRequiredString(value.method, `operations[${index}].method`).toUpperCase();
  const path = normalizePath(readRequiredString(value.path, `operations[${index}].path`));

  return {
    key: buildOperationKey(method, path),
    method,
    operationId: asOptionalString(value.operationId),
    path,
    responses: mapResponses(value.responses, sourcePath, `operations[${index}].responses`),
    sourcePath
  };
}

function mapResponses(
  value: unknown,
  sourcePath: string,
  location: string
): ContractResponse[] {
  if (!isRecord(value)) {
    throw new Error(`${location} must be an object keyed by status code.`);
  }

  const responses: ContractResponse[] = [];

  for (const [statusCode, rawDefinition] of Object.entries(value)) {
    const definitions = Array.isArray(rawDefinition) ? rawDefinition : [rawDefinition];

    for (const definition of definitions) {
      if (!isRecord(definition)) {
        throw new Error(`${location}.${statusCode} must be an object or array of objects.`);
      }

      const bodySchema = isRecord(definition.bodySchema)
        ? definition.bodySchema
        : "bodyExample" in definition
          ? inferSchemaFromExample(definition.bodyExample)
          : undefined;

      responses.push({
        bodySchema,
        contentType: asOptionalString(definition.contentType),
        sourcePath,
        statusCode
      });
    }
  }

  return responses;
}

function readRequiredString(value: unknown, location: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${location} must be a non-empty string.`);
  }

  return value;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
