import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { XMLParser } from "fast-xml-parser";
import { buildOperationKey, normalizePath } from "./openapi.js";
import type {
  ReadyApiBundle,
  ReadyApiOperation,
  ReadyApiResponse,
  ReadyApiService
} from "./types.js";

type ParsedRoot = {
  rootName: string;
  rootNode: unknown;
};

type ScanState = {
  sawSoapMockService: boolean;
};

const xmlParser = new XMLParser({
  attributeNamePrefix: "",
  cdataPropName: "#cdata",
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  textNodeName: "#text",
  trimValues: false
});

export async function loadReadyApiBundle(
  readyApiPath: string,
  requestedServices: string[]
): Promise<ReadyApiBundle> {
  const targetStats = await stat(readyApiPath);
  const scanState: ScanState = {
    sawSoapMockService: false
  };

  const services = targetStats.isDirectory()
    ? await loadServicesFromDirectory(readyApiPath, scanState)
    : await loadServicesFromFile(readyApiPath, scanState);

  if (services.length === 0) {
    if (scanState.sawSoapMockService) {
      throw new Error(
        `MockDoctor v0.1 supports REST virtual services only. No REST virtual services were found in ${readyApiPath}.`
      );
    }

    throw new Error(`No REST virtual services were found in ${readyApiPath}.`);
  }

  const filteredServices =
    requestedServices.length === 0
      ? services
      : services.filter((service) => requestedServices.includes(service.name));

  if (requestedServices.length > 0 && filteredServices.length === 0) {
    throw new Error(
      `Could not find any of the requested ReadyAPI REST virtual services: ${requestedServices.join(", ")}.`
    );
  }

  return {
    services: filteredServices,
    sourcePath: readyApiPath
  };
}

async function loadServicesFromDirectory(
  directoryPath: string,
  scanState: ScanState
): Promise<ReadyApiService[]> {
  const xmlFiles = await fg(["**/*.xml"], {
    absolute: true,
    cwd: directoryPath,
    onlyFiles: true
  });

  const services: ReadyApiService[] = [];
  const serviceEntriesByDirectory = new Map<string, Array<{ filePath: string; rootNode: unknown }>>();
  const actionEntriesByDirectory = new Map<string, Array<{ filePath: string; rootNode: unknown }>>();

  for (const filePath of xmlFiles.sort((left, right) => left.localeCompare(right))) {
    const parsedRoot = await parseXmlRoot(filePath);
    const rootLocalName = localName(parsedRoot.rootName);

    if (rootLocalName === "soapui-project") {
      services.push(...extractRestMockServicesFromProject(filePath, parsedRoot.rootNode, scanState));
      continue;
    }

    if (rootLocalName === "restMockService") {
      const entries = serviceEntriesByDirectory.get(path.dirname(filePath)) ?? [];
      entries.push({
        filePath,
        rootNode: parsedRoot.rootNode
      });
      serviceEntriesByDirectory.set(path.dirname(filePath), entries);
      continue;
    }

    if (rootLocalName === "restMockAction") {
      const entries = actionEntriesByDirectory.get(path.dirname(filePath)) ?? [];
      entries.push({
        filePath,
        rootNode: parsedRoot.rootNode
      });
      actionEntriesByDirectory.set(path.dirname(filePath), entries);
      continue;
    }

    if (rootLocalName === "mockService") {
      scanState.sawSoapMockService = true;
    }
  }

  for (const [directory, serviceEntries] of serviceEntriesByDirectory.entries()) {
    const actionEntries = actionEntriesByDirectory.get(directory) ?? [];

    for (const serviceEntry of serviceEntries) {
      services.push(mapRestMockService(serviceEntry.rootNode, serviceEntry.filePath, actionEntries));
    }
  }

  return dedupeServices(services);
}

async function loadServicesFromFile(
  filePath: string,
  scanState: ScanState
): Promise<ReadyApiService[]> {
  const parsedRoot = await parseXmlRoot(filePath);
  const rootLocalName = localName(parsedRoot.rootName);

  if (rootLocalName === "soapui-project") {
    return extractRestMockServicesFromProject(filePath, parsedRoot.rootNode, scanState);
  }

  if (rootLocalName === "restMockService") {
    const siblingActions =
      path.basename(filePath).toLowerCase() === "settings.xml"
        ? await loadSiblingActions(filePath)
        : [];

    return [mapRestMockService(parsedRoot.rootNode, filePath, siblingActions)];
  }

  if (rootLocalName === "mockService") {
    scanState.sawSoapMockService = true;
    return [];
  }

  throw new Error(
    `Unsupported ReadyAPI XML root <${parsedRoot.rootName}>. Expected a soapui-project or restMockService document.`
  );
}

async function loadSiblingActions(
  settingsPath: string
): Promise<Array<{ filePath: string; rootNode: unknown }>> {
  const siblingXmlFiles = await fg(["*.xml"], {
    absolute: true,
    cwd: path.dirname(settingsPath),
    onlyFiles: true
  });

  const entries: Array<{ filePath: string; rootNode: unknown }> = [];

  for (const siblingFile of siblingXmlFiles.sort((left, right) => left.localeCompare(right))) {
    if (path.resolve(siblingFile) === path.resolve(settingsPath)) {
      continue;
    }

    const parsedRoot = await parseXmlRoot(siblingFile);
    if (localName(parsedRoot.rootName) === "restMockAction") {
      entries.push({
        filePath: siblingFile,
        rootNode: parsedRoot.rootNode
      });
    }
  }

  return entries;
}

function extractRestMockServicesFromProject(
  sourcePath: string,
  rootNode: unknown,
  scanState: ScanState
): ReadyApiService[] {
  const restServices = findNodesByLocalName(rootNode, "restMockService").map((serviceNode) =>
    mapRestMockService(serviceNode, sourcePath)
  );

  if (findNodesByLocalName(rootNode, "mockService").length > 0) {
    scanState.sawSoapMockService = true;
  }

  return restServices;
}

function mapRestMockService(
  serviceNode: unknown,
  sourcePath: string,
  actionEntries: Array<{ filePath: string; rootNode: unknown }> = []
): ReadyApiService {
  const node = asRecord(serviceNode);
  if (!node) {
    throw new Error(`ReadyAPI service in ${sourcePath} is not an XML object.`);
  }

  const basePath = normalizePath(readStringAttribute(node.path, "/"));
  const inlineActions = getDirectChildren(node, "restMockAction").map((actionNode) => ({
    filePath: sourcePath,
    rootNode: actionNode
  }));
  const rawActions = actionEntries.length > 0 ? actionEntries : inlineActions;

  return {
    basePath,
    host: readOptionalString(node.host),
    name: readStringAttribute(node.name, "Unnamed REST Virtual Service"),
    operations: rawActions.map((entry) =>
      mapRestMockAction(entry.rootNode, basePath, entry.filePath)
    ),
    port: readOptionalString(node.port),
    sourcePath
  };
}

function mapRestMockAction(
  actionNode: unknown,
  basePath: string,
  sourcePath: string
): ReadyApiOperation {
  const node = asRecord(actionNode);
  if (!node) {
    throw new Error(`ReadyAPI operation in ${sourcePath} is not an XML object.`);
  }

  const method = readStringAttribute(node.method, "GET").toUpperCase();
  const resourcePath = normalizePath(readStringAttribute(node.resourcePath, "/"));
  const fullPath = joinPaths(basePath, resourcePath);

  return {
    defaultResponseName: readOptionalChildText(node, "defaultResponse"),
    key: buildOperationKey(method, fullPath),
    method,
    name: readStringAttribute(node.name, `${method} ${resourcePath}`),
    path: fullPath,
    resourcePath,
    responses: getDirectChildren(node, "response").map((responseNode) =>
      mapRestMockResponse(responseNode, sourcePath)
    ),
    sourcePath
  };
}

function mapRestMockResponse(responseNode: unknown, sourcePath: string): ReadyApiResponse {
  const node = asRecord(responseNode);
  if (!node) {
    throw new Error(`ReadyAPI response in ${sourcePath} is not an XML object.`);
  }

  const rawBody = readOptionalChildText(node, "responseContent");
  const mediaType = readOptionalString(node.mediaType);
  const parsed = parseResponseBody(mediaType, rawBody);

  return {
    contentType: mediaType,
    name: readStringAttribute(node.name, "Unnamed Response"),
    parseError: parsed.parseError,
    parsedBody: parsed.parsedBody,
    rawBody,
    sourcePath,
    statusCode: readStringAttribute(node.httpResponseStatus, "200")
  };
}

function parseResponseBody(
  contentType: string | undefined,
  rawBody: string | undefined
): {
  parseError?: string;
  parsedBody?: unknown;
} {
  if (!rawBody || rawBody.trim().length === 0) {
    return {};
  }

  if (!isLikelyJson(contentType, rawBody)) {
    return {};
  }

  try {
    return {
      parsedBody: JSON.parse(rawBody)
    };
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

async function parseXmlRoot(filePath: string): Promise<ParsedRoot> {
  const raw = await readFile(filePath, "utf8");
  const parsed = xmlParser.parse(raw) as Record<string, unknown>;
  const rootEntry = Object.entries(parsed).find(([key]) => !key.startsWith("?"));

  if (!rootEntry) {
    throw new Error(`Could not find an XML root element in ${filePath}.`);
  }

  const [rootName, rootNode] = rootEntry;
  return {
    rootName,
    rootNode
  };
}

function findNodesByLocalName(value: unknown, targetLocalName: string): unknown[] {
  const matches: unknown[] = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      matches.push(...findNodesByLocalName(entry, targetLocalName));
    }

    return matches;
  }

  const record = asRecord(value);
  if (!record) {
    return matches;
  }

  for (const [key, child] of Object.entries(record)) {
    if (localName(key) === targetLocalName) {
      matches.push(...toArray(child));
    }

    matches.push(...findNodesByLocalName(child, targetLocalName));
  }

  return matches;
}

function getDirectChildren(
  node: Record<string, unknown>,
  targetLocalName: string
): Array<Record<string, unknown>> {
  const matches: Array<Record<string, unknown>> = [];

  for (const [key, child] of Object.entries(node)) {
    if (localName(key) !== targetLocalName) {
      continue;
    }

    for (const entry of toArray(child)) {
      const record = asRecord(entry);
      if (record) {
        matches.push(record);
      }
    }
  }

  return matches;
}

function readOptionalChildText(
  node: Record<string, unknown>,
  childLocalName: string
): string | undefined {
  for (const [key, child] of Object.entries(node)) {
    if (localName(key) !== childLocalName) {
      continue;
    }

    return readTextNode(child);
  }

  return undefined;
}

function readTextNode(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  if (typeof record["#text"] === "string") {
    return record["#text"];
  }

  if (typeof record["#cdata"] === "string") {
    return record["#cdata"];
  }

  return undefined;
}

function readStringAttribute(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function localName(tagName: string): string {
  const segments = tagName.split(":");
  return segments[segments.length - 1];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

function joinPaths(basePath: string, resourcePath: string): string {
  if (basePath === "/") {
    return normalizePath(resourcePath);
  }

  if (resourcePath === "/") {
    return normalizePath(basePath);
  }

  return normalizePath(`${normalizePath(basePath)}${normalizePath(resourcePath)}`);
}

function isLikelyJson(contentType: string | undefined, rawBody: string): boolean {
  if (contentType && contentType.toLowerCase().includes("json")) {
    return true;
  }

  const trimmed = rawBody.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function dedupeServices(services: ReadyApiService[]): ReadyApiService[] {
  const seen = new Set<string>();
  const deduped: ReadyApiService[] = [];

  for (const service of services) {
    const signature = [
      service.name,
      service.basePath,
      service.host ?? "",
      service.port ?? "",
      ...service.operations.map((operation) => `${operation.key}:${operation.responses.length}`)
    ].join("|");

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    deduped.push(service);
  }

  return deduped;
}
