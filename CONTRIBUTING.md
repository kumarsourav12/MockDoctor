# Contributing

MockDoctor is small on purpose. Keep changes narrow, document the real behavior, and add fixtures for every comparison rule you change.

## Local Setup

```bash
npm install
npm run check
npm test
```

For a full local pass, also run:

```bash
npm run build
npm run dev -- compare --config ./examples/openapi/mockdoctor.config.json
npm run dev -- compare --config ./examples/json-contract/mockdoctor.config.json
```

Node.js 18 or newer is required. CI currently runs Node.js 18, 20, and 22.

## Repository Layout

- `src/readyapi.ts`: parses ReadyAPI REST project XML files and extracted service directories
- `src/openapi.ts`: loads and normalizes OpenAPI contracts
- `src/json-contract.ts`: loads the JSON contract format
- `src/compare.ts`: compares normalized operations and responses
- `src/report.ts`: formats text, JSON, and HTML reports
- `src/schema.ts`: normalizes OpenAPI schema fragments and runs Ajv validation
- `examples/`: checked-in smoke examples that should keep working
- `test/fixtures/`: contract and ReadyAPI fixtures used by the test suite
- `test/`: unit and CLI coverage

Do not edit `dist/` by hand. It is build output.

## Making Changes

When you add or change behavior:

1. Update the smallest module that owns the behavior.
2. Add or update a fixture under `test/fixtures/`.
3. Add or update a test in `test/mockdoctor.test.ts` or `test/cli.test.ts`.
4. Update the docs if the user-facing behavior changed.

Good changes usually include both a passing fixture and a failing fixture. That keeps the comparison rule obvious and makes regressions easier to spot.

## Fixture Guidelines

Use fixtures that show one thing clearly.

- Keep ReadyAPI examples short. One service with a few actions is enough.
- Keep contract examples focused on the rule being tested.
- Prefer real-looking paths, status codes, and JSON bodies.
- If a fixture exists only to trigger one error, make that error the only surprising thing in the file.

## Documentation Style

Write docs the same way the CLI behaves:

- lead with the command or constraint that matters
- use the real filenames and flags
- name current limits directly
- avoid padding, sales copy, and vague claims

If a behavior is version-specific, say that in the docs instead of implying broader support than the code actually has.

## Before Opening a Release PR

Run all of these from the repo root:

```bash
npm run check
npm test
npm run build
npm run dev -- compare --config ./examples/openapi/mockdoctor.config.json
npm run dev -- compare --config ./examples/json-contract/mockdoctor.config.json
npm pack --dry-run
```

If any of those fail, fix the code or the docs before calling the release ready.
