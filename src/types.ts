export type OutputFormat = "json" | "text";

export interface CliOptions {
  config?: string;
  contract?: string;
  format?: OutputFormat;
  htmlReport?: string;
  openapi?: string;
  readyapi?: string;
  service?: string[];
}

export interface GuardConfigFile {
  contract?: {
    json?: string;
    openapi?: string;
  };
  format?: OutputFormat;
  readyapi?: {
    path?: string;
    service?: string | string[];
  };
  report?: {
    html?: string;
  };
}

export interface ResolvedConfig {
  contract:
    | {
        kind: "json-contract";
        path: string;
      }
    | {
        kind: "openapi";
        path: string;
      };
  cwd: string;
  format: OutputFormat;
  htmlReportPath?: string;
  readyApiPath: string;
  requestedServices: string[];
}

export interface ReadyApiBundle {
  services: ReadyApiService[];
  sourcePath: string;
}

export interface ReadyApiService {
  basePath: string;
  host?: string;
  name: string;
  operations: ReadyApiOperation[];
  port?: string;
  sourcePath: string;
}

export interface ReadyApiOperation {
  defaultResponseName?: string;
  key: string;
  method: string;
  name: string;
  path: string;
  resourcePath: string;
  responses: ReadyApiResponse[];
  sourcePath: string;
}

export interface ReadyApiResponse {
  contentType?: string;
  name: string;
  parseError?: string;
  parsedBody?: unknown;
  rawBody?: string;
  sourcePath: string;
  statusCode: string;
}

export interface ContractBundle {
  operations: ContractOperation[];
  sourcePath: string;
  sourceType: "json-contract" | "openapi";
}

export interface ContractOperation {
  key: string;
  method: string;
  operationId?: string;
  path: string;
  responses: ContractResponse[];
  sourcePath: string;
}

export interface ContractResponse {
  bodySchema?: Record<string, unknown>;
  contentType?: string;
  sourcePath: string;
  statusCode: string;
}

export type IssueCode =
  | "content-type-mismatch"
  | "operation-missing-in-contract"
  | "operation-missing-in-readyapi"
  | "response-body-invalid-json"
  | "response-body-schema-mismatch"
  | "response-missing-in-contract"
  | "response-missing-in-readyapi";

export interface ComparisonIssue {
  code: IssueCode;
  contractSource?: string;
  details?: string[];
  message: string;
  operationKey?: string;
  readyApiOperation?: string;
  readyApiResponse?: string;
  readyApiService?: string;
  readyApiSource?: string;
  severity: "error" | "warning";
  statusCode?: string;
}

export interface ComparisonResult {
  contractPath: string;
  contractType: "json-contract" | "openapi";
  issues: ComparisonIssue[];
  operationsChecked: number;
  readyApiPath: string;
  responsesChecked: number;
  servicesChecked: number;
}
