# Cloudflare telemetry endpoint

This folder contains a small Cloudflare Worker that accepts MockDoctor action telemetry and writes it to Workers Analytics Engine.

Use it when you want a lightweight endpoint you control instead of sending data to a third-party analytics product.

## What it does

The worker exposes two routes:

- `GET /health` returns a small health check response
- `POST /ingest` accepts one MockDoctor telemetry event and writes it to Workers Analytics Engine

The worker expects a bearer token if you set the `MOCKDOCTOR_INGEST_TOKEN` secret.

## What MockDoctor sends

The GitHub Action only sends telemetry when you set `telemetry-endpoint`.

Each event includes:

- tool name
- source
- event name
- repository
- ref
- runner operating system
- contract type
- action repository
- MockDoctor version
- whether drift was found
- issue count
- service, operation, and response counts
- run id
- timestamp
- optional error message

It does not send contract files, ReadyAPI files, response bodies, or HTML report contents.

## Deploy the worker

From this folder:

```bash
npm install -g wrangler
wrangler login
wrangler secret put MOCKDOCTOR_INGEST_TOKEN
wrangler deploy
```

Workers Analytics Engine creates the `mockdoctor_usage` dataset automatically the first time the worker writes data to it.

Cloudflare's current docs say you do not need to create the dataset manually. The binding in `wrangler.jsonc` is enough.

## Connect it to the GitHub Action

Add a secret in the repository that runs MockDoctor:

- `MOCKDOCTOR_TELEMETRY_TOKEN`

Then configure the action like this:

```yaml
- name: Run MockDoctor
  uses: kumarsourav12/MockDoctor@main
  with:
    readyapi: ./readyapi-project.xml
    openapi: ./openapi.yaml
    telemetry-endpoint: https://mockdoctor-telemetry.<your-subdomain>.workers.dev/ingest
    telemetry-token: ${{ secrets.MOCKDOCTOR_TELEMETRY_TOKEN }}
```

If you leave `telemetry-endpoint` unset, MockDoctor does not send anything.

## Stored field order

Workers Analytics Engine stores event values as ordered arrays. The field order in this worker is fixed.

Blob fields:

1. `tool`
2. `source`
3. `event`
4. `repository`
5. `ref`
6. `runnerOs`
7. `contractType`
8. `actionRepository`
9. `version`
10. `driftDetected`
11. `errorMessage`

Double fields:

1. `issuesCount`
2. `servicesChecked`
3. `operationsChecked`
4. `responsesChecked`
5. `timestampMs`

Index field:

1. `repository#runId` when a run id exists, otherwise `repository`

## Query the data

Cloudflare's SQL API lets you query Workers Analytics Engine data over HTTP.

You need:

- your Cloudflare account id
- an API token with `Account Analytics Read`

Cloudflare's current SQL API endpoint is:

```text
https://api.cloudflare.com/client/v4/accounts/<account_id>/analytics_engine/sql
```

### Daily usage

```sql
SELECT
  DATE_TRUNC('day', TO_TIMESTAMP(double5 / 1000)) AS day,
  COUNT() AS runs,
  SUM(_sample_interval * double1) / SUM(_sample_interval) AS weighted_issues
FROM mockdoctor_usage
GROUP BY day
ORDER BY day DESC
LIMIT 30
```

### Repositories using the action

```sql
SELECT
  blob4 AS repository,
  COUNT() AS runs
FROM mockdoctor_usage
GROUP BY repository
ORDER BY runs DESC
LIMIT 20
```

### Drift rate

```sql
SELECT
  blob10 AS drift_detected,
  COUNT() AS runs
FROM mockdoctor_usage
GROUP BY drift_detected
ORDER BY runs DESC
```

## Current limits that matter here

Cloudflare's current Workers Analytics Engine docs say:

- one `writeDataPoint()` call can include up to 20 blobs, 20 doubles, and 1 index
- data retention is three months

This worker stays well inside those limits.

## Notes

- The worker returns `202` when it accepts an event.
- If the token is wrong or missing, it returns `401`.
- If the payload is not valid MockDoctor telemetry, it returns `400`.
- If Analytics Engine is not bound, it returns `500`.
