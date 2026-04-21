# Reporting

MockDoctor has three output paths:

- text output to stdout
- JSON output to stdout
- optional HTML output written to a file

The comparison logic is the same in all three cases. Only the presentation changes.

## Exit Codes

- `0`: no drift found
- `1`: drift found or the run failed

That means CI can treat any drift as a failing step without extra parsing.

## Text Output

Text output is the default.

```bash
mockdoctor compare --readyapi ./readyapi-project.xml --openapi ./openapi.yaml
```

Example:

```text
MockDoctor
ReadyAPI: /workspace/orders-project.xml
Contract: /workspace/openapi.yaml (openapi)
Services checked: 1
Operations checked: 3
Responses checked: 4
Issues found: 1

GET /api/orders/{id} | service=OrdersService | orders-project.xml
  - [response-body-schema-mismatch] ReadyAPI response OK Response for GET /api/orders/{id} does not match the contract schema.
      $.amount: must be integer
```

This format is meant for humans reading a terminal or a CI log.

## JSON Output

Use JSON when another tool needs the result.

```bash
mockdoctor compare \
  --readyapi ./readyapi-project.xml \
  --openapi ./openapi.yaml \
  --format json
```

The JSON payload includes:

- `readyApiPath`
- `contractPath`
- `contractType`
- `servicesChecked`
- `operationsChecked`
- `responsesChecked`
- `issues[]`

Each issue includes the code, message, severity, and any matching source fields or schema details.

## HTML Reports

Use `--html-report` when you want a file you can attach to CI artifacts or share with someone who does not want to read raw logs.

```bash
mockdoctor compare \
  --readyapi ./readyapi-project.xml \
  --openapi ./openapi.yaml \
  --html-report ./artifacts/mockdoctor-drift.html
```

You can also set the path in config:

```json
{
  "report": {
    "html": "./artifacts/mockdoctor-drift.html"
  }
}
```

Important behavior:

- MockDoctor writes the HTML file only when drift is found
- the directory is created automatically if it does not exist
- terminal output still prints as text or JSON
- the CLI writes the report path to stderr after the file is created

The HTML report includes:

- overall counts
- ReadyAPI and contract input paths
- issues grouped by operation and source
- issue code, severity, message, details, and source paths

## When Body Validation Runs

MockDoctor validates response bodies only when both of these are true:

- the contract includes a schema or an example that becomes a schema
- the ReadyAPI response body is JSON or the media type looks like JSON

If the contract has no body schema, MockDoctor does not validate the body.

If the response is not JSON, MockDoctor compares only:

- status code
- content type

## Issue Codes

Current issue codes:

- `operation-missing-in-contract`
- `operation-missing-in-readyapi`
- `response-missing-in-contract`
- `response-missing-in-readyapi`
- `content-type-mismatch`
- `response-body-invalid-json`
- `response-body-schema-mismatch`
