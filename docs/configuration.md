# Configuration

MockDoctor has one public command:

```bash
mockdoctor compare
```

You can pass everything on the command line, put it in a config file, or mix the two. Command-line flags override the config file.

## Command-Line Flags

```bash
mockdoctor compare --readyapi <path> --openapi <path>
mockdoctor compare --readyapi <path> --contract <path>
```

Available flags:

| Flag | Required | Notes |
| --- | --- | --- |
| `-c, --config <path>` | No | JSON or YAML config file |
| `-r, --readyapi <path>` | Yes unless config provides it | ReadyAPI project XML or extracted REST service directory |
| `-o, --openapi <path>` | Yes unless config provides it | OpenAPI contract |
| `-j, --contract <path>` | Yes unless config provides it | JSON contract |
| `-s, --service <names...>` | No | Restrict comparison to named ReadyAPI REST services |
| `--format <text\|json>` | No | Terminal output format. Default is `text` |
| `--html-report <path>` | No | Writes an HTML report when drift is found |

Choose either `--openapi` or `--contract`. Do not pass both.

## Default Config Filenames

If you do not pass `--config`, MockDoctor looks for these files in the current working directory:

- `mockdoctor.config.json`
- `mockdoctor.config.yaml`
- `mockdoctor.config.yml`

## Config Shape

JSON example:

```json
{
  "readyapi": {
    "path": "./readyapi-project.xml",
    "service": ["OrdersService"]
  },
  "contract": {
    "openapi": "./openapi.yaml"
  },
  "report": {
    "html": "./artifacts/mockdoctor-drift.html"
  },
  "format": "text"
}
```

YAML example:

```yaml
readyapi:
  path: ./readyapi-project.xml
  service:
    - OrdersService
contract:
  json: ./contract.json
report:
  html: ./artifacts/mockdoctor-drift.html
format: json
```

Rules:

- `readyapi.path` is required unless you pass `--readyapi`
- choose either `contract.openapi` or `contract.json`
- `readyapi.service` can be a string or an array of strings
- `report.html` is optional
- all relative paths are resolved from the config file directory

## ReadyAPI Inputs

`v0.1.0` supports ReadyAPI REST inputs in these forms:

- a full ReadyAPI project XML file
- a `restMockService` XML file such as `settings.xml` plus sibling `restMockAction` XML files
- a directory that contains one or more ReadyAPI project XML files

If the input only contains SOAP mock services, MockDoctor fails with a REST-only message.

## OpenAPI Contracts

OpenAPI contracts are dereferenced before comparison. MockDoctor then normalizes operations to `METHOD + path` and compares response definitions.

Status code matching rules:

- exact status codes like `200` and `404` match directly
- wildcard responses like `2XX` match any response in that class
- `default` matches any ReadyAPI response that does not have a more specific contract match

For JSON media types, MockDoctor treats `application/json` and vendor JSON types like `application/problem+json` as JSON-compatible for body validation.

## JSON Contract Format

The simplest supported shape is `operations[]`:

```json
{
  "operations": [
    {
      "method": "GET",
      "path": "/api/orders/{id}",
      "operationId": "getOrder",
      "responses": {
        "200": {
          "contentType": "application/json",
          "bodyExample": {
            "id": "ord_123",
            "status": "captured",
            "amount": 99
          }
        },
        "404": {
          "contentType": "application/json",
          "bodySchema": {
            "type": "object",
            "required": ["error"],
            "properties": {
              "error": { "type": "string" }
            },
            "additionalProperties": false
          }
        }
      }
    }
  ]
}
```

MockDoctor also accepts a grouped `services[]` wrapper if that fits your repo better:

```json
{
  "services": [
    {
      "name": "OrdersService",
      "operations": [
        {
          "method": "GET",
          "path": "/api/orders",
          "responses": {
            "200": {
              "contentType": "application/json",
              "bodyExample": {
                "items": []
              }
            }
          }
        }
      ]
    }
  ]
}
```

Response definition rules:

- each response can define `contentType`
- each response can define `bodySchema`
- or each response can define `bodyExample`
- if `bodyExample` is present, MockDoctor infers a JSON schema from it
- a status code can map to one object or an array of objects

## Path Matching

Operation matching is template-aware for brace-style path parameters:

- missing leading slashes are added
- trailing slashes are removed unless the path is `/`
- brace-style path parameters are normalized by position, not by name

That means `GET /orders/{id}` and `GET /orders/{orderId}` match.

`GET /orders/{id}` and `GET /orders/:id` are still different paths to MockDoctor.

## Common Errors

`No ReadyAPI input provided`
: Pass `--readyapi` or set `readyapi.path` in the config file.

`No contract input provided`
: Pass `--openapi` or `--contract`, or set `contract.openapi` / `contract.json` in the config file.

`Choose either an OpenAPI spec or a JSON contract, not both`
: Remove one of the contract inputs.

`Could not find any of the requested ReadyAPI REST virtual services`
: Check the `--service` names or the `readyapi.service` entries.
