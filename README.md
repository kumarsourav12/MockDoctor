# MockDoctor

MockDoctor compares ReadyAPI REST virtual-service files with an OpenAPI spec or a JSON contract and flags drift before stale mocks leak into tests or CI.

Start here:

- Demo site: [kumarsourav12.github.io/MockDoctor](https://kumarsourav12.github.io/MockDoctor/)
- Latest release: [v0.1.0](https://github.com/kumarsourav12/MockDoctor/releases/tag/v0.1.0)

`v0.1.0` is intentionally narrow:

- ReadyAPI REST inputs only
- OpenAPI or JSON contract inputs
- comparison by `METHOD + path`, with path parameter names normalized
- response status, media type, and JSON body validation

It does not execute ReadyAPI dispatch scripts or simulate runtime behavior. It reads the files you commit, normalizes them, and reports where they no longer match the contract you expect.

## Quick Start

From this repository:

```bash
npm install
npm run build
node ./dist/cli.js compare --config ./examples/openapi/mockdoctor.config.json
```

You can also run the TypeScript entrypoint during development:

```bash
npm run dev -- compare --config ./examples/openapi/mockdoctor.config.json
```

After you publish the package, the public CLI name is `mockdoctor`:

```bash
npx mockdoctor compare --readyapi ./readyapi-project.xml --openapi ./openapi.yaml
```

## What MockDoctor Checks

- operation missing in the contract
- operation missing in ReadyAPI
- response status missing in the contract
- response status missing in ReadyAPI
- content-type mismatches
- invalid JSON response bodies when the contract expects JSON schema validation
- JSON schema mismatches from OpenAPI schemas or JSON contract examples

## Supported Inputs

ReadyAPI input:

- a full ReadyAPI project XML file
- an extracted REST virtual-service directory that contains a `settings.xml`-style service file plus sibling `restMockAction` XML files
- a directory that contains one or more ReadyAPI project XML files

Contract input:

- OpenAPI 3.x documents
- JSON contracts with an `operations[]` array
- JSON contracts with a `services[]` array that contains nested `operations[]`

Current limits:

- REST virtual services only in `v0.1.0`
- non-JSON response bodies are compared by status code and media type only
- `{id}` and `{orderId}` are treated as the same path parameter, but `:id` is still a different route shape
- if the input only contains SOAP mock services, MockDoctor fails with a REST-only message

## CLI

```bash
mockdoctor compare --readyapi <path> --openapi <path>
mockdoctor compare --readyapi <path> --contract <path>
```

## GitHub Action

MockDoctor also ships as a GitHub Action:

```yaml
- uses: kumarsourav12/MockDoctor@main
  with:
    readyapi: ./readyapi-project.xml
    openapi: ./openapi.yaml
```

If you want to collect drift without failing the workflow, set `fail-on-drift: false`.

If you write an HTML report, you can upload it as an artifact in a later step.

Flags:

| Flag | Meaning |
| --- | --- |
| `-c, --config <path>` | Read config from a JSON or YAML file |
| `-r, --readyapi <path>` | ReadyAPI project XML or extracted REST service directory |
| `-s, --service <names...>` | Restrict comparison to named ReadyAPI REST services |
| `-o, --openapi <path>` | OpenAPI file to compare against |
| `-j, --contract <path>` | JSON contract file to compare against |
| `--format <text\|json>` | Terminal output format. Defaults to `text` |
| `--html-report <path>` | Write a styled HTML report when drift is found |

Exit codes:

- `0` when no drift is found
- `1` when drift is found or the run fails

## Config File

MockDoctor looks for these filenames in the current working directory when `--config` is omitted:

- `mockdoctor.config.json`
- `mockdoctor.config.yaml`
- `mockdoctor.config.yml`

Example:

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

Path rules:

- relative paths are resolved from the config file directory
- choose either `contract.openapi` or `contract.json`
- `report.html` is optional
- if `report.html` is set, MockDoctor writes the HTML file only when issues are found

## Example Drift Run

This repo includes a real schema-drift fixture. The contract requires `amount` to be an integer, while the ReadyAPI response returns it as a string.

```bash
npm run dev -- compare \
  --readyapi ./test/fixtures/readyapi/orders-project-schema-drift.xml \
  --openapi ./test/fixtures/contracts/orders-openapi.yaml \
  --html-report ./artifacts/mockdoctor-drift.html
```

Expected terminal output:

```text
MockDoctor
ReadyAPI: /workspace/orders-project-schema-drift.xml
Contract: /workspace/orders-openapi.yaml (openapi)
Services checked: 1
Operations checked: 3
Responses checked: 4
Issues found: 1

GET /api/orders/{id} | service=OrdersService | orders-project-schema-drift.xml
  - [response-body-schema-mismatch] ReadyAPI response OK Response for GET /api/orders/{id} does not match the contract schema.
      $.amount: must be integer
```

## Example Commands In This Repo

OpenAPI-backed example:

```bash
npm run dev -- compare --config ./examples/openapi/mockdoctor.config.json
```

JSON-contract example:

```bash
npm run dev -- compare --config ./examples/json-contract/mockdoctor.config.json
```

## Documentation

- [Configuration and CLI reference](./docs/configuration.md)
- [GitHub Action usage](./docs/github-action.md)
- [Cloudflare telemetry receiver](./telemetry/cloudflare-worker/README.md)
- [Reporting and HTML artifacts](./docs/reporting.md)
- [Architecture notes](./docs/architecture.md)
- [Contributing](./CONTRIBUTING.md)
- [Release steps](./docs/releasing.md)
- [Changelog](./CHANGELOG.md)

## Presentation Site

The repo now includes a standalone presentation site in [`/site`](./site).

GitHub Pages target URL:

- [kumarsourav12.github.io/MockDoctor](https://kumarsourav12.github.io/MockDoctor/)

Deployment notes:

- the Pages workflow lives in [`.github/workflows/pages.yml`](./.github/workflows/pages.yml)
- GitHub’s current Pages docs say a repo admin or maintainer needs to set the Pages source to `GitHub Actions` in repository settings before the workflow can publish the site

## Local Verification

```bash
npm run check
npm test
npm run build
npm run dev -- compare --config ./examples/openapi/mockdoctor.config.json
npm run dev -- compare --config ./examples/json-contract/mockdoctor.config.json
```

The GitHub Actions workflow runs the same checks on Node.js 18, 20, and 22.
