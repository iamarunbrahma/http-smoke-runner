# HTTP Smoke Runner

Run `.http` and `.rest` files like smoke tests — pass/fail, latency, and jump-to-failure — directly in VS Code's Testing panel.

## Why

Developers already keep API requests in `.http` files alongside source code (popularized by the REST Client extension). That workflow is great for sending *one* request, but awkward for running the *whole file* as a smoke check. HTTP Smoke Runner adds a thin test-runner layer:

- Works with REST Client's common file syntax (`###`, `@var`, `{{var}}`, `# @name`, `{{$guid}}`, `{{$dotenv}}`)
- Assertions are inline comments: `# expect status 200`
- Results appear in VS Code's native Testing panel — not another sidebar
- Zero external runtime (no Node install, no Python install)
- Zero telemetry, zero account, fully local

## Install

Search "HTTP Smoke Runner" in VS Code, or run:

```
ext install arunbrahma.http-smoke-runner
```

## Quick start

Create `requests.http`:

```http
@baseUrl = http://localhost:3000

### health
GET {{baseUrl}}/health
# expect status 200
# expect body contains "ok"
# expect time < 500ms

### create user
POST {{baseUrl}}/users
Content-Type: application/json

{ "name": "Ada" }
# expect status 201
# expect body path $.id exists
# expect body path $.name equals "Ada"
```

Open VS Code's Testing view — the file appears, each request is a test. Click the ▶ button next to a request, or use the CodeLens "▶ Run Request" above each `###` block.

## Assertion syntax

```
# expect status 200
# expect status 2xx
# expect header content-type contains json
# expect header x-request-id exists
# expect body contains "ok"
# expect body path $.id exists
# expect body path $.name equals "Ada"
# expect body path $.email matches /@example\.com$/
# expect time < 500ms
```

All assertions are ordinary `#` comment lines, so the file stays drop-in compatible with REST Client.

## Variables

- **File:** `@baseUrl = http://localhost:3000`, used as `{{baseUrl}}`
- **System:** `{{$guid}}`, `{{$randomInt 1 100}}`, `{{$timestamp}}`, `{{$datetime iso8601}}`
- **Process env:** `{{$processEnv MY_VAR}}`
- **Dotenv:** `{{$dotenv API_KEY}}` — first use in a workspace shows a one-time consent prompt

## Not supported in V1

Surfaced as yellow warnings in the editor so nothing fails silently:

- Request chaining (`{{login.response.body.$.token}}`)
- Prompt variables (`# @prompt`)
- Auth helpers (OAuth, AAD, AWS Sig v4, Digest, SSL client certs)
- Cookie jar / settings-based environments / run history / CI / CLI

See the [design spec](docs/superpowers/specs/2026-04-25-http-smoke-runner-design.md) for the complete V1 scope and rationale.

## License

MIT © 2026 Arun Brahma
