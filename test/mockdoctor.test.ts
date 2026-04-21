import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadReadyApiBundle } from "../src/readyapi.js";
import { runCompare } from "../src/run.js";

const fixturesDir = path.resolve("test/fixtures");
const readyApiDir = path.join(fixturesDir, "readyapi");
const contractDir = path.join(fixturesDir, "contracts");

const ordersProject = path.join(readyApiDir, "orders-project.xml");
const multiServiceProject = path.join(readyApiDir, "multi-service-project.xml");
const schemaDriftProject = path.join(readyApiDir, "orders-project-schema-drift.xml");
const invalidJsonProject = path.join(readyApiDir, "orders-project-invalid-json.xml");
const soapOnlyProject = path.join(readyApiDir, "soap-only-project.xml");
const serviceDir = path.join(readyApiDir, "OrdersService");
const configPath = path.join(fixturesDir, "config", "mockdoctor.config.yaml");

const matchingOpenApi = path.join(contractDir, "orders-openapi.yaml");
const extraOperationOpenApi = path.join(contractDir, "orders-openapi-extra-operation.yaml");
const missingContractOperationOpenApi = path.join(contractDir, "orders-openapi-without-health.yaml");
const missingContractResponseOpenApi = path.join(contractDir, "orders-openapi-without-404.yaml");
const extraResponseOpenApi = path.join(contractDir, "orders-openapi-extra-response.yaml");
const contentTypeMismatchOpenApi = path.join(contractDir, "orders-openapi-health-json.yaml");
const jsonContractPath = path.join(contractDir, "orders-contract.json");
const invalidJsonContractPath = path.join(contractDir, "invalid-contract.json");

describe("MockDoctor", () => {
  it("parses a ReadyAPI project XML with one REST virtual service", async () => {
    const bundle = await loadReadyApiBundle(ordersProject, []);

    expect(bundle.services).toHaveLength(1);
    expect(bundle.services[0]).toMatchObject({
      basePath: "/api",
      name: "OrdersService"
    });
    expect(bundle.services[0].operations.map((operation) => operation.key)).toEqual([
      "GET /api/orders/{id}",
      "GET /api/orders",
      "GET /api/health"
    ]);
  });

  it("parses a service directory with sibling REST mock actions", async () => {
    const bundle = await loadReadyApiBundle(serviceDir, []);

    expect(bundle.services).toHaveLength(1);
    expect(bundle.services[0].operations).toHaveLength(3);
    expect(bundle.services[0].operations[0].responses.length).toBeGreaterThan(0);
  });

  it("filters services by explicit ReadyAPI service name", async () => {
    const bundle = await loadReadyApiBundle(multiServiceProject, ["BillingService"]);

    expect(bundle.services.map((service) => service.name)).toEqual(["BillingService"]);
    expect(bundle.services[0].operations.map((operation) => operation.key)).toEqual([
      "GET /billing/ping"
    ]);
  });

  it("fails clearly for SOAP-only projects", async () => {
    await expect(loadReadyApiBundle(soapOnlyProject, [])).rejects.toThrow(
      "supports REST virtual services only"
    );
  });

  it("passes matching ReadyAPI vs OpenAPI comparisons", async () => {
    const result = await runCompare({
      openapi: matchingOpenApi,
      readyapi: ordersProject
    });

    expect(result.issues).toEqual([]);
    expect(result.servicesChecked).toBe(1);
    expect(result.operationsChecked).toBe(3);
    expect(result.responsesChecked).toBe(4);
  });

  it("reports operations missing in ReadyAPI when the contract adds one", async () => {
    const result = await runCompare({
      openapi: extraOperationOpenApi,
      readyapi: ordersProject
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "operation-missing-in-readyapi",
        operationKey: "POST /api/orders"
      })
    ]);
  });

  it("reports extra ReadyAPI operations that are not present in the contract", async () => {
    const result = await runCompare({
      openapi: missingContractOperationOpenApi,
      readyapi: ordersProject
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "operation-missing-in-contract",
        operationKey: "GET /api/health"
      })
    ]);
  });

  it("reports responses missing in the contract", async () => {
    const result = await runCompare({
      openapi: missingContractResponseOpenApi,
      readyapi: ordersProject
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "response-missing-in-contract",
        operationKey: "GET /api/orders/{id}",
        statusCode: "404"
      })
    ]);
  });

  it("reports responses missing in ReadyAPI", async () => {
    const result = await runCompare({
      openapi: extraResponseOpenApi,
      readyapi: ordersProject
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "response-missing-in-readyapi",
        operationKey: "GET /api/orders",
        statusCode: "206"
      })
    ]);
  });

  it("reports content-type mismatches", async () => {
    const result = await runCompare({
      openapi: contentTypeMismatchOpenApi,
      readyapi: ordersProject
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "content-type-mismatch",
        operationKey: "GET /api/health",
        statusCode: "200"
      })
    ]);
  });

  it("reports JSON schema mismatches", async () => {
    const result = await runCompare({
      openapi: matchingOpenApi,
      readyapi: schemaDriftProject
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "response-body-schema-mismatch",
        operationKey: "GET /api/orders/{id}"
      })
    ]);
    expect(result.issues[0].details?.[0]).toContain("$.amount");
  });

  it("reports invalid JSON response bodies when schema validation is required", async () => {
    const result = await runCompare({
      openapi: matchingOpenApi,
      readyapi: invalidJsonProject
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "response-body-invalid-json",
        operationKey: "GET /api/orders/{id}"
      })
    ]);
  });

  it("passes matching ReadyAPI vs JSON contract comparisons and supports bodyExample", async () => {
    const result = await runCompare({
      contract: jsonContractPath,
      readyapi: serviceDir
    });

    expect(result.issues).toEqual([]);
  });

  it("rejects invalid JSON contract shapes clearly", async () => {
    await expect(
      runCompare({
        contract: invalidJsonContractPath,
        readyapi: ordersProject
      })
    ).rejects.toThrow("operations array");
  });

  it("resolves ReadyAPI and contract paths relative to the config file", async () => {
    const result = await runCompare({
      config: configPath
    });

    expect(result.issues).toEqual([]);
    expect(result.readyApiPath).toBe(path.join(fixturesDir, "readyapi", "OrdersService"));
    expect(result.contractPath).toBe(path.join(contractDir, "orders-openapi.yaml"));
  });
});
