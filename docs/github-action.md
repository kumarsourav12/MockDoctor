# GitHub Action

MockDoctor can run directly inside a GitHub Actions workflow.

That is the easiest way to put it in CI without writing your own setup script around the CLI.

## Basic example

```yaml
name: MockDoctor

on:
  pull_request:
  workflow_dispatch:

jobs:
  mockdoctor:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Compare ReadyAPI with OpenAPI
        uses: kumarsourav12/MockDoctor@main
        with:
          readyapi: ./readyapi-project.xml
          openapi: ./openapi.yaml
```

If MockDoctor finds drift, the action fails the step by default.

## Common inputs

| Input | Required | Notes |
| --- | --- | --- |
| `config` | No | Path to a `mockdoctor.config.json` or YAML file in the caller repository |
| `readyapi` | Yes unless `config` provides it | ReadyAPI project XML or extracted REST service directory |
| `openapi` | Yes unless `config` or `contract` provides it | OpenAPI contract path |
| `contract` | Yes unless `config` or `openapi` provides it | JSON contract path |
| `service` | No | Comma-separated or newline-separated ReadyAPI service names |
| `format` | No | `text` or `json` for action log output. Default is `text` |
| `html-report` | No | Writes an HTML report when drift is found |
| `working-directory` | No | Directory in the caller repository where MockDoctor should run. Default is `.` |
| `fail-on-drift` | No | Set to `false` to keep the workflow green when drift is found |
| `telemetry-endpoint` | No | Optional HTTPS endpoint that receives one JSON usage event per action run |
| `telemetry-token` | No | Optional bearer token for the telemetry endpoint |

Choose either `openapi` or `contract`. Do not pass both unless `config` already narrows it down to one.

## Keep the workflow green while still reporting drift

```yaml
- name: Compare ReadyAPI with OpenAPI
  id: mockdoctor
  uses: kumarsourav12/MockDoctor@main
  with:
    readyapi: ./test/fixtures/readyapi/orders-project-schema-drift.xml
    openapi: ./test/fixtures/contracts/orders-openapi.yaml
    html-report: ./artifacts/mockdoctor-drift.html
    fail-on-drift: false
```

That step still reports the drift, writes the HTML report, and exposes outputs you can use later in the workflow.

## Action outputs

| Output | Meaning |
| --- | --- |
| `drift-detected` | `true` when MockDoctor found at least one issue |
| `issues-count` | Number of issues found |
| `services-checked` | Number of ReadyAPI services checked |
| `operations-checked` | Number of operations checked |
| `responses-checked` | Number of responses checked |
| `readyapi-path` | Resolved ReadyAPI path used by the run |
| `contract-path` | Resolved contract path used by the run |
| `contract-type` | `openapi` or `json-contract` |
| `html-report-path` | Absolute path to the generated HTML report when one was written |

## Upload the HTML report as an artifact

```yaml
- name: Compare ReadyAPI with OpenAPI
  id: mockdoctor
  uses: kumarsourav12/MockDoctor@main
  with:
    readyapi: ./test/fixtures/readyapi/orders-project-schema-drift.xml
    openapi: ./test/fixtures/contracts/orders-openapi.yaml
    html-report: ./artifacts/mockdoctor-drift.html
    fail-on-drift: false

- name: Upload MockDoctor report
  if: steps.mockdoctor.outputs.html-report-path != ''
  uses: actions/upload-artifact@v4
  with:
    name: mockdoctor-report
    path: ${{ steps.mockdoctor.outputs.html-report-path }}
```

## Opt-in telemetry

MockDoctor does not send usage data unless you set `telemetry-endpoint`.

If you do set it, the action sends one JSON `POST` per run. The payload includes:

- MockDoctor version
- event name
- repository name
- ref
- run id
- runner operating system
- contract type
- whether drift was found
- issue count
- service, operation, and response counts

It does not send contract files, mock response bodies, or HTML report contents.

If the telemetry call fails, MockDoctor writes a warning to the action log and continues.
