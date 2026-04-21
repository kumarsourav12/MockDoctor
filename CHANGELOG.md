# Changelog

## 0.1.0 - 2026-04-21

Initial public release.

- Added a CLI that compares ReadyAPI REST virtual-service files against OpenAPI or JSON contracts.
- Added support for two ReadyAPI input shapes: full project XML files and extracted REST service directories.
- Added drift detection for missing operations, missing responses, content-type mismatches, invalid JSON bodies, and JSON schema mismatches.
- Added text and JSON terminal output plus optional HTML drift reports.
- Added checked-in OpenAPI and JSON contract examples.
- Added CI coverage for Node.js 18, 20, and 22.

Current release scope:

- ReadyAPI REST inputs only
- OpenAPI and JSON contract inputs only
- non-JSON responses are compared by status code and media type only
- SOAP/WSDL comparison is not included in `v0.1.0`
