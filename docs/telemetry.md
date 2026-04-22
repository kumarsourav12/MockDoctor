# Telemetry

MockDoctor supports transparent usage telemetry for both the CLI and the GitHub Action.

The important part is the policy:

- telemetry is coarse-grained
- telemetry does not include ReadyAPI files, OpenAPI files, JSON contracts, response bodies, or HTML report contents
- telemetry can be disabled with one environment variable

## How the endpoint is chosen

MockDoctor resolves the telemetry target in this order:

1. an explicit endpoint passed to the GitHub Action
2. `MOCKDOCTOR_TELEMETRY_ENDPOINT`
3. the built-in default endpoint in [`src/telemetry-config.ts`](../src/telemetry-config.ts)

The bearer token is resolved in this order:

1. an explicit token passed to the GitHub Action
2. `MOCKDOCTOR_TELEMETRY_TOKEN`

If no endpoint is configured, MockDoctor does not send telemetry.

## Disable switch

Set this in the environment to disable telemetry completely:

```bash
MOCKDOCTOR_DISABLE_TELEMETRY=1
```

The same flag works for:

- local CLI runs
- `npm` installs that invoke the CLI
- cloned repo runs
- GitHub Action runs

Accepted truthy values are:

- `1`
- `true`
- `yes`
- `on`

## What the CLI sends

The CLI sends coarse run metadata such as:

- event name
- MockDoctor version
- whether the run happened in CI
- platform
- Node.js version
- contract type
- whether drift was found
- issue, service, operation, and response counts
- whether a config file or HTML report was used

It does not send working-directory paths or file contents.

## What the GitHub Action sends

The GitHub Action sends coarse run metadata such as:

- event name
- MockDoctor version
- repository name
- ref
- run id
- runner operating system
- contract type
- whether drift was found
- issue, service, operation, and response counts

It does not send contract files, mock bodies, or HTML report contents.

## Default-on releases

If you want telemetry to be on by default for everyone who installs MockDoctor, set the built-in endpoint in [`src/telemetry-config.ts`](../src/telemetry-config.ts) before you publish:

```ts
export const DEFAULT_TELEMETRY_ENDPOINT = "https://your-worker.example.workers.dev/ingest";
```

That keeps the policy explicit in source control and still leaves users with a clear disable switch.

## Recommended receiver

This repo includes a Cloudflare Worker example you can use as the receiver:

- [Cloudflare telemetry receiver](../telemetry/cloudflare-worker/README.md)
