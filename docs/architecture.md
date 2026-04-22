# Architecture

MockDoctor has a small pipeline:

1. load ReadyAPI input
2. load the contract
3. normalize both sides into the same internal shape
4. compare operations and responses
5. render text, JSON, or HTML output

That separation is the reason the codebase stays readable. Contract loading is not mixed into drift detection, and output formatting is not mixed into parsing.

## Core Modules

- `src/readyapi.ts`: reads ReadyAPI REST project XML files and extracted service directories
- `src/openapi.ts`: dereferences OpenAPI files and flattens them into normalized operations
- `src/json-contract.ts`: reads the repo-friendly JSON contract format
- `src/compare.ts`: matches operations and responses and emits issue objects
- `src/schema.ts`: normalizes OpenAPI schema fragments and validates JSON bodies with Ajv
- `src/report.ts`: turns the comparison result into text, JSON, or HTML
- `src/config.ts`: resolves flags, config files, and relative paths

## Normalized Model

Both the ReadyAPI side and the contract side end up as operations keyed by:

```text
METHOD /normalized/path
```

That is the display shape used in reports. For matching, MockDoctor also builds a comparison key that normalizes brace-style path parameter names by position. That lets `/orders/{id}` match `/orders/{orderId}` without rewriting the original path shown to the user.

Each normalized operation contains:

- method
- normalized path
- response list
- source path

Each normalized response contains:

- status code
- content type
- optional body schema
- optional parsed JSON body
- source path

The comparator only needs that shape. It does not care whether the contract came from OpenAPI or a JSON file once normalization is done.

## Response Matching

ReadyAPI responses are compared against contract responses in this order:

- exact matching status codes
- wildcard statuses like `2XX`
- `default`

If multiple contract responses are possible, MockDoctor prefers a matching content type. If that still does not narrow it down, it prefers a JSON candidate when the ReadyAPI response is JSON.

## Schema Validation

Schema validation is intentionally narrow.

- OpenAPI schemas are normalized before validation
- `nullable` is converted into a JSON Schema shape Ajv can validate
- JSON contract `bodyExample` values are converted into inferred schemas
- body validation only runs for JSON-compatible responses

This is enough to catch the drift most teams care about without pretending to simulate a full API runtime.

## Why the HTML Renderer Lives in `src/report.ts`

The HTML report is a different view of the same `ComparisonResult` object. Keeping it in the reporting layer means:

- comparison logic stays testable without HTML concerns
- JSON output and HTML output cannot drift semantically
- new output formats can reuse the same result object

## Current Boundaries

`v0.1.0` does not try to cover every ReadyAPI feature.

Not included:

- SOAP/WSDL mock services
- dispatch scripts
- data sources
- behavioral simulation
- non-brace route syntaxes such as `:id`

Those limits are part of the design, not an omission in the docs. MockDoctor reads committed files and checks them against a contract. That is the job.
