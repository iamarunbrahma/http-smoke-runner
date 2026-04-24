# Changelog

## [0.1.0] - 2026-04-25

### Added
- Parse `.http` / `.rest` files with REST Client-compatible subset
- Run requests via native VS Code Testing API with pass/fail + latency
- `# expect` assertions: status, header (contains/equals/exists), body contains, body path (equals/exists/matches), time budget
- File variables, `{{var}}` interpolation
- System variables: `$guid`, `$uuid`, `$randomInt`, `$timestamp`, `$datetime`, `$localDatetime`, `$processEnv`, `$dotenv`
- CodeLens "▶ Run File" / "▶ Run Request"
- Diagnostics for unsupported constructs (chaining, `# @prompt`, per-request settings)
- Status bar summary after each run
- One-time workspace consent prompt for `.env` loading
- Secret redaction in Test Output for Authorization / Cookie / API-key headers
- Zero external runtime; zero telemetry

## [0.0.1] - 2026-04-25

- Initial name-reservation release.
