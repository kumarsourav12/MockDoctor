# Releasing MockDoctor

This project is ready for a GitHub release when the code, examples, docs, and package metadata all agree with each other.

## Before You Bump the Version

Check these files first:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `README.md`
- `.github/workflows/ci.yml`

If the release changes CLI flags, config shape, examples, or limits, update the docs in the same branch.

## Release Verification

Run these commands from the repo root:

```bash
npm install
npm run check
npm test
npm run build
npm run dev -- compare --config ./examples/openapi/mockdoctor.config.json
npm run dev -- compare --config ./examples/json-contract/mockdoctor.config.json
npm pack --dry-run
```

What each one proves:

- `npm run check`: TypeScript types are clean
- `npm test`: parser, comparator, and CLI behavior are covered
- `npm run build`: the published CLI can be compiled
- example smoke checks: the checked-in examples still work
- `npm pack --dry-run`: the npm tarball contains the expected files

## Version Bump

Update the version in `package.json`. Then run:

```bash
npm install
```

That refreshes `package-lock.json` so the package version stays in sync.

## Tag and Publish

If you are publishing to npm:

1. make sure you are logged in to the correct npm account
2. run the verification commands above
3. publish from the repo root

```bash
npm publish
```

`prepublishOnly` already runs `npm test` and `npm run build`, but do not rely on that as the only release check. The example smoke runs and `npm pack --dry-run` still matter.

## GitHub Release Notes

For a `v0.1.x` release, keep the notes short:

- what changed
- whether any flags or config fields changed
- whether the release affects the ReadyAPI input scope
- whether users need to update example config filenames or docs links

Use `CHANGELOG.md` as the source of truth, then trim it into GitHub release notes.
