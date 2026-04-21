# Why ReadyAPI mocks drift and how to catch it before CI lies to you

Mock services are useful right up until they stop matching the system they are supposed to stand in for.

That sounds obvious, but in practice it is easy to miss. A backend team changes a field name, response type, or status code. The OpenAPI file gets updated. The application code moves on. The ReadyAPI virtual service does not. The test suite still passes because the tests are now running against a mock that represents an older version of reality.

That is not a flaky test problem. It is a false-confidence problem.

## The failure mode

A simple example is enough.

The contract says:

```yaml
amount:
  type: integer
```

But the stored ReadyAPI response still returns:

```json
{ "amount": "99" }
```

Nothing about that mismatch is dramatic when you look at the file in isolation. It is exactly the kind of small drift that survives code review and then sits quietly in the repo while other work continues.

By the time somebody notices, one of two things has usually happened:

1. the frontend or automation suite has adapted itself around the wrong response
2. production behavior diverges from the mock and the failing layer is no longer obvious

That is why this class of bug is annoying. The real cost is not the diff itself. The real cost is all the trust you lose after the test suite told the team everything was fine.

## Why this happens with ReadyAPI virtual services

ReadyAPI makes it easy to build useful virtual services quickly. That is part of why teams keep using it.

The trouble starts when those virtual services are treated as long-lived project assets instead of temporary local scaffolding.

Once they are checked into git, they need the same kind of maintenance pressure as any other artifact:

- contracts evolve
- schemas change
- response branches get added
- content types shift
- example payloads age badly

Most teams already have some process for keeping application code close to the contract. Fewer teams have an equally clear process for keeping committed virtual-service files honest.

## What MockDoctor checks

MockDoctor was built for that gap.

It reads ReadyAPI REST virtual-service files, loads either an OpenAPI spec or a JSON contract, normalizes both sides into the same operation model, and compares:

- missing operations
- missing responses
- content-type mismatches
- invalid JSON bodies
- JSON schema mismatches

The important part is that it works on the committed files themselves. It is not trying to simulate runtime behavior or replace ReadyAPI. It is checking whether the files in version control still match the contract you expect them to represent.

## A concrete drift example

One checked-in fixture in the MockDoctor repo intentionally returns a string for `amount` where the contract requires an integer.

Running the comparison produces:

```text
GET /api/orders/{id} | service=OrdersService
  - [response-body-schema-mismatch] ReadyAPI response OK Response for GET /api/orders/{id} does not match the contract schema.
      $.amount: must be integer
```

That is the level of output I wanted from the start: no vague “drift detected” message, no giant abstract report, just the operation, the issue code, and the exact failing path.

## Why not use an LLM prompt for this?

Because this job is mostly about deterministic comparison, not generation.

You can absolutely paste files into ChatGPT and ask whether they differ. That is useful for one-off investigation. It is not the same as a repeatable check that:

- runs the same way every time
- works in CI
- produces stable issue codes
- reads checked-in fixtures and contracts directly
- fails the build when the drift is real

The more boring and repeatable the task is, the more it should be a tool and not a prompt ritual.

## Current scope

MockDoctor is narrow on purpose in `v0.1.0`.

It supports:

- ReadyAPI REST project XML files
- extracted ReadyAPI REST service directories
- OpenAPI contracts
- JSON contracts
- text, JSON, and HTML reporting

It does not try to cover:

- SOAP/WSDL comparison
- dispatch-script execution
- non-JSON body-schema validation
- full virtualization runtime behavior

That narrower scope is part of the point. A small tool that does one neglected job well is more useful than a bigger tool that claims to cover everything and becomes vague fast.

## If this problem looks familiar

You can try MockDoctor from the repo today:

```bash
npm install
npm run build
node ./dist/cli.js compare --config ./examples/openapi/mockdoctor.config.json
```

Repository:

https://github.com/kumarsourav12/MockDoctor

Presentation site:

https://kumarsourav12.github.io/MockDoctor/
