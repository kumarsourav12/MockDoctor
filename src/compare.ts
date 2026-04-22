import { buildComparisonKey } from "./openapi.js";
import { validateSchemaValue } from "./schema.js";
import type {
  ComparisonIssue,
  ComparisonResult,
  ContractBundle,
  ContractOperation,
  ContractResponse,
  ReadyApiBundle,
  ReadyApiOperation,
  ReadyApiResponse,
  ReadyApiService
} from "./types.js";

type ReadyOperationContext = {
  operation: ReadyApiOperation;
  service: ReadyApiService;
};

export function compareBundles(
  readyApi: ReadyApiBundle,
  contract: ContractBundle
): ComparisonResult {
  const issues: ComparisonIssue[] = [];
  const readyOperations = readyApi.services.flatMap((service) =>
    service.operations.map((operation) => ({ operation, service }))
  );
  const contractOperationMap = new Map(
    contract.operations.map((operation) => [
      buildComparisonKey(operation.method, operation.path),
      operation
    ] as const)
  );
  const matchedOperationKeys = new Set<string>();

  for (const readyContext of readyOperations) {
    const comparisonKey = buildComparisonKey(
      readyContext.operation.method,
      readyContext.operation.path
    );
    const contractOperation = contractOperationMap.get(comparisonKey);

    if (!contractOperation) {
      issues.push({
        code: "operation-missing-in-contract",
        contractSource: contract.sourcePath,
        message: `ReadyAPI operation ${readyContext.operation.key} is not present in the contract.`,
        operationKey: readyContext.operation.key,
        readyApiOperation: readyContext.operation.name,
        readyApiService: readyContext.service.name,
        readyApiSource: readyContext.operation.sourcePath,
        severity: "error"
      });
      continue;
    }

    matchedOperationKeys.add(comparisonKey);
    compareOperationResponses(readyContext, contractOperation, contract.sourcePath, issues);
  }

  for (const contractOperation of contract.operations) {
    if (matchedOperationKeys.has(buildComparisonKey(contractOperation.method, contractOperation.path))) {
      continue;
    }

    issues.push({
      code: "operation-missing-in-readyapi",
      contractSource: contractOperation.sourcePath,
      message: `Contract operation ${contractOperation.key} is missing from the ReadyAPI virtual services.`,
      operationKey: contractOperation.key,
      severity: "error"
    });
  }

  return {
    contractPath: contract.sourcePath,
    contractType: contract.sourceType,
    issues,
    operationsChecked: readyOperations.length,
    readyApiPath: readyApi.sourcePath,
    responsesChecked: readyOperations.reduce(
      (total, readyContext) => total + readyContext.operation.responses.length,
      0
    ),
    servicesChecked: readyApi.services.length
  };
}

function compareOperationResponses(
  readyContext: ReadyOperationContext,
  contractOperation: ContractOperation,
  contractSource: string,
  issues: ComparisonIssue[]
): void {
  const matchedContractResponses = new Set<number>();

  readyContext.operation.responses.forEach((response) => {
    const candidates = contractOperation.responses
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => statusMatches(response.statusCode, candidate.statusCode));

    if (candidates.length === 0) {
      issues.push({
        code: "response-missing-in-contract",
        contractSource,
        message: `ReadyAPI response ${response.statusCode} for ${readyContext.operation.key} is not present in the contract.`,
        operationKey: readyContext.operation.key,
        readyApiOperation: readyContext.operation.name,
        readyApiResponse: response.name,
        readyApiService: readyContext.service.name,
        readyApiSource: response.sourcePath,
        severity: "error",
        statusCode: response.statusCode
      });
      return;
    }

    const chosen = chooseContractResponse(response, candidates.map(({ candidate }) => candidate));
    const chosenIndex = candidates.find(({ candidate }) => candidate === chosen)?.index;

    if (chosenIndex !== undefined) {
      matchedContractResponses.add(chosenIndex);
    }

    compareResponseContentType(readyContext, response, chosen, contractSource, issues);
    compareResponseBody(readyContext, response, chosen, contractSource, issues);
  });

  contractOperation.responses.forEach((response, index) => {
    if (matchedContractResponses.has(index) || !expectsExplicitReadyApiResponse(response.statusCode)) {
      return;
    }

    issues.push({
      code: "response-missing-in-readyapi",
      contractSource: response.sourcePath,
      message: `Contract response ${response.statusCode} for ${contractOperation.key} is missing from the ReadyAPI virtual service.`,
      operationKey: contractOperation.key,
      severity: "error",
      statusCode: response.statusCode
    });
  });
}

function compareResponseContentType(
  readyContext: ReadyOperationContext,
  readyResponse: ReadyApiResponse,
  contractResponse: ContractResponse,
  contractSource: string,
  issues: ComparisonIssue[]
): void {
  if (!contractResponse.contentType) {
    return;
  }

  if (!readyResponse.contentType) {
    issues.push({
      code: "content-type-mismatch",
      contractSource,
      message: `ReadyAPI response ${readyResponse.name} for ${readyContext.operation.key} is missing a media type, but the contract expects ${contractResponse.contentType}.`,
      operationKey: readyContext.operation.key,
      readyApiOperation: readyContext.operation.name,
      readyApiResponse: readyResponse.name,
      readyApiService: readyContext.service.name,
      readyApiSource: readyResponse.sourcePath,
      severity: "error",
      statusCode: readyResponse.statusCode
    });
    return;
  }

  if (mediaTypesMatch(readyResponse.contentType, contractResponse.contentType)) {
    return;
  }

  issues.push({
    code: "content-type-mismatch",
    contractSource,
    message: `ReadyAPI response ${readyResponse.name} for ${readyContext.operation.key} uses ${readyResponse.contentType}, but the contract expects ${contractResponse.contentType}.`,
    operationKey: readyContext.operation.key,
    readyApiOperation: readyContext.operation.name,
    readyApiResponse: readyResponse.name,
    readyApiService: readyContext.service.name,
    readyApiSource: readyResponse.sourcePath,
    severity: "error",
    statusCode: readyResponse.statusCode
  });
}

function compareResponseBody(
  readyContext: ReadyOperationContext,
  readyResponse: ReadyApiResponse,
  contractResponse: ContractResponse,
  contractSource: string,
  issues: ComparisonIssue[]
): void {
  if (!contractResponse.bodySchema) {
    return;
  }

  if (readyResponse.parseError) {
    issues.push({
      code: "response-body-invalid-json",
      contractSource,
      details: [readyResponse.parseError],
      message: `ReadyAPI response ${readyResponse.name} for ${readyContext.operation.key} could not be parsed as JSON.`,
      operationKey: readyContext.operation.key,
      readyApiOperation: readyContext.operation.name,
      readyApiResponse: readyResponse.name,
      readyApiService: readyContext.service.name,
      readyApiSource: readyResponse.sourcePath,
      severity: "error",
      statusCode: readyResponse.statusCode
    });
    return;
  }

  if (readyResponse.parsedBody === undefined) {
    return;
  }

  const schemaErrors = validateSchemaValue(readyResponse.parsedBody, contractResponse.bodySchema);
  if (schemaErrors.length === 0) {
    return;
  }

  issues.push({
    code: "response-body-schema-mismatch",
    contractSource,
    details: schemaErrors,
    message: `ReadyAPI response ${readyResponse.name} for ${readyContext.operation.key} does not match the contract schema.`,
    operationKey: readyContext.operation.key,
    readyApiOperation: readyContext.operation.name,
    readyApiResponse: readyResponse.name,
    readyApiService: readyContext.service.name,
    readyApiSource: readyResponse.sourcePath,
    severity: "error",
    statusCode: readyResponse.statusCode
  });
}

function chooseContractResponse(
  readyResponse: ReadyApiResponse,
  candidates: ContractResponse[]
): ContractResponse {
  if (readyResponse.contentType) {
    const exact = candidates.find((candidate) =>
      candidate.contentType ? mediaTypesMatch(readyResponse.contentType as string, candidate.contentType) : false
    );

    if (exact) {
      return exact;
    }
  }

  const jsonCandidate = candidates.find((candidate) => isJsonMediaType(candidate.contentType));
  return jsonCandidate ?? candidates[0];
}

function statusMatches(readyStatusCode: string, contractStatusCode: string): boolean {
  if (contractStatusCode === "default") {
    return true;
  }

  if (/^[1-5]XX$/.test(contractStatusCode)) {
    return readyStatusCode.length > 0 && readyStatusCode[0] === contractStatusCode[0];
  }

  return readyStatusCode === contractStatusCode;
}

function expectsExplicitReadyApiResponse(contractStatusCode: string): boolean {
  return contractStatusCode !== "default" && !/^[1-5]XX$/.test(contractStatusCode);
}

function mediaTypesMatch(left: string, right: string): boolean {
  const leftNormalized = left.split(";")[0].trim().toLowerCase();
  const rightNormalized = right.split(";")[0].trim().toLowerCase();

  if (leftNormalized === rightNormalized) {
    return true;
  }

  return isJsonMediaType(leftNormalized) && isJsonMediaType(rightNormalized);
}

function isJsonMediaType(value: string | undefined): boolean {
  return typeof value === "string" && value.toLowerCase().includes("json");
}
