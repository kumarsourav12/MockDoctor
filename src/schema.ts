import { Ajv, type ErrorObject } from "ajv";

const ajv = new Ajv({
  allErrors: true,
  allowUnionTypes: true,
  strict: false
});

const NESTED_SCHEMA_KEYS = [
  "additionalProperties",
  "allOf",
  "anyOf",
  "contains",
  "else",
  "if",
  "items",
  "not",
  "oneOf",
  "patternProperties",
  "prefixItems",
  "properties",
  "then"
] as const;

export function validateSchemaValue(
  value: unknown,
  schema: Record<string, unknown>
): string[] {
  const validate = ajv.compile(schema);
  const valid = validate(value);

  if (valid) {
    return [];
  }

  return (validate.errors ?? []).map((error: ErrorObject) => formatAjvError(error));
}

export function normalizeOpenApiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeSchemaNode(schema);
  return isRecord(normalized) ? normalized : {};
}

export function inferSchemaFromExample(value: unknown): Record<string, unknown> {
  if (value === null) {
    return {
      type: "null"
    };
  }

  if (Array.isArray(value)) {
    return {
      items:
        value.length === 0
          ? {}
          : mergeSchemas(value.map((entry) => inferSchemaFromExample(entry))),
      type: "array"
    };
  }

  if (isRecord(value)) {
    const properties: Record<string, unknown> = {};

    for (const [key, propertyValue] of Object.entries(value)) {
      properties[key] = inferSchemaFromExample(propertyValue);
    }

    return {
      additionalProperties: false,
      properties,
      required: Object.keys(value),
      type: "object"
    };
  }

  switch (typeof value) {
    case "boolean":
      return { type: "boolean" };
    case "number":
      return { type: Number.isInteger(value) ? "integer" : "number" };
    case "string":
      return { type: "string" };
    default:
      return {};
  }
}

function normalizeSchemaNode(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSchemaNode(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const clone: Record<string, unknown> = { ...value };

  if (clone.nullable === true) {
    const typeValue = clone.type;

    if (typeof typeValue === "string") {
      clone.type = typeValue === "null" ? "null" : [typeValue, "null"];
    } else if (Array.isArray(typeValue)) {
      clone.type = typeValue.includes("null") ? typeValue : [...typeValue, "null"];
    } else {
      clone.anyOf = [...toSchemaArray(clone.anyOf), { type: "null" }];
    }
  }

  delete clone.nullable;

  for (const key of NESTED_SCHEMA_KEYS) {
    if (!(key in clone)) {
      continue;
    }

    if (key === "properties" || key === "patternProperties") {
      const nested = clone[key];
      if (isRecord(nested)) {
        const next: Record<string, unknown> = {};

        for (const [propertyName, propertySchema] of Object.entries(nested)) {
          next[propertyName] = normalizeSchemaNode(propertySchema);
        }

        clone[key] = next;
      }

      continue;
    }

    clone[key] = normalizeSchemaNode(clone[key]);
  }

  return clone;
}

function mergeSchemas(schemas: Array<Record<string, unknown>>): Record<string, unknown> {
  const unique = new Map<string, Record<string, unknown>>();

  for (const schema of schemas) {
    unique.set(JSON.stringify(schema), schema);
  }

  const deduped = [...unique.values()];

  if (deduped.length === 1) {
    return deduped[0];
  }

  return {
    anyOf: deduped
  };
}

function formatAjvError(error: ErrorObject): string {
  const location = toDollarPath(error.instancePath);
  return `${location}: ${error.message ?? "schema validation failed"}`;
}

function toDollarPath(instancePath: string): string {
  if (!instancePath || instancePath === "/") {
    return "$";
  }

  const segments = instancePath
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  return segments.reduce((path, segment) => {
    return /^\d+$/.test(segment) ? `${path}[${segment}]` : `${path}.${segment}`;
  }, "$");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSchemaArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => isRecord(entry));
}
