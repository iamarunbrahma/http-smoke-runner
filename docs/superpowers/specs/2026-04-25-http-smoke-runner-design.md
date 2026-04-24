# HTTP Smoke Runner — Design Spec

- **Date**: 2026-04-25
- **Author**: arunbrahma
- **Status**: Approved for implementation planning
- **Source idea**: `/Users/arunbrahma/Desktop/AltGAN/codepad/vs_code_extension_ideas.md`

## 1. One-line thesis

A VS Code extension that turns the `.http` and `.rest` files already in a repo into a smoke-test suite — pass/fail, latency, and jump-to-failure, surfaced in the native Testing panel. Zero external runtime, REST Client–compatible for the common file-format subset.

## 2. Marketplace identity

| Field | Value |
|---|---|
| Publisher | `arunbrahma` |
| Extension name | `http-smoke-runner` |
| Full Marketplace ID | `arunbrahma.http-smoke-runner` |
| Display name | HTTP Smoke Runner |
| Description | Run `.http` and `.rest` files like smoke tests — pass/fail, latency, jump-to-failure, directly in VS Code. |
| License | MIT |
| Repo | GitHub (public, to be created under arunbrahma) |
| Icon | 128×128 PNG placeholder generated on Day 3, swappable later |
| Initial version | `0.1.0` |
| VS Code engine | `^1.90.0` |

## 3. Research validation summary

Claims from the idea doc were verified against live data in April 2026:

- **REST Client (`humao.rest-client`)**: 7,012,781 installs, GitHub issue #1394 (Sept 2025, "This is DEAD. Ask for new maintainers") confirmed; earlier issue #1280 (July 2024, "Unmaintained project – use httpyac instead!") also exists. Last release `v0.23.2` — project stagnant. Millions of installed users are stranded on an unmaintained tool.
- **Thunder Client**: Now paywalls Collections (public Feb 2026 Reddit thread documents a user building "LiteClient" specifically because of this). Import/Export paid. Free tier increasingly constrained.
- **`iyulab.http-test`**: 3,164 installs, 1 review. Requires the user to have Node.js installed separately — concrete friction point HTTP Smoke Runner avoids.
- **`httpYac`**: Powerful but large surface area; oddly, the REST Client maintainer's own recommendation for successor.
- **`dothttp-runner`**: Requires Python runtime on the user's system. Non-starter for most web devs.

Gap is real and larger than the idea doc describes. HTTP Smoke Runner's positioning: the smallest, fastest, zero-runtime way to run existing `.http` files as a smoke suite.

## 4. Success criteria (concrete, testable)

The MVP ships when all of the following work end-to-end against a sample Express app:

1. A repo containing `requests.http` is opened. The extension auto-discovers the file; tests appear in the native Testing panel as a file → request hierarchy.
2. Clicking "Run" on the file executes every request sequentially, respecting a 30,000 ms per-request timeout and honoring the Test Run's cancellation token.
3. Each test displays duration in ms on pass; on fail, the red X shows a clear human-readable reason (e.g., `expected status 201, got 500`).
4. Failed test gutter decoration appears on the exact request block line; clicking the failure in the Testing panel navigates to that line.
5. Response body + headers (with sensitive headers redacted) are available via the Test Output terminal pane.
6. Adding `# expect status 200` to a passing request, then breaking the endpoint, causes that specific request to fail deterministically with the expected-vs-actual message.
7. Reloading VS Code and opening the same workspace requires zero re-setup. No Node install prompts, no telemetry, no account.
8. `vsce package` produces `http-smoke-runner-0.1.0.vsix` which installs cleanly on VS Code 1.90+. `vsce publish` pushes to the Marketplace under `arunbrahma.http-smoke-runner`.

## 5. Supported file-format surface

Input files are `.http` or `.rest`, REST Client–compatible for the subset below.

### 5.1 Request blocks

```http
@baseUrl = http://localhost:3000
@apiToken = {{$dotenv API_TOKEN}}

### health                                  ← label form (optional)
GET {{baseUrl}}/health
# expect status 200
# expect body contains "ok"
# expect time < 500ms

###
# @name listUsers                           ← directive form (also optional)
GET {{baseUrl}}/users
Authorization: Bearer {{apiToken}}
# expect status 2xx
# expect header content-type contains json
# expect body path $.length exists

### create user
POST {{baseUrl}}/users
Content-Type: application/json
X-Request-Id: {{$guid}}

{
  "name": "Ada",
  "createdAt": "{{$datetime iso8601}}"
}
# expect status 201
# expect body path $.name equals "Ada"
# expect body path $.id exists
```

### 5.2 Supported tokens

| Token | Definition |
|---|---|
| Request separator | Line starting with `###` (three or more `#`), with optional trailing label |
| Name directive | Line `# @name X` or `// @name X` preceding the request line |
| Request line | `METHOD URL [HTTP-Version]` — HTTP version parsed but ignored |
| Headers | `Name: Value`, one per line, name case-insensitive |
| Body | Everything after the first blank line following headers, trimmed of trailing whitespace |
| Comments | Lines starting with `#` or `//` that aren't directives, name tags, or `# expect …` |
| File variables | `@name = value` (whitespace around `=` optional) |
| Interpolation | `{{name}}` (literal braces) |
| System variables | `{{$guid}}` / `{{$uuid}}`, `{{$randomInt [min] [max]}}`, `{{$timestamp [offsetN unit]}}` (units: `ms`, `s`, `m`, `h`, `d`, `w`, `M`, `y`), `{{$datetime rfc1123\|iso8601 [offsetN unit]}}`, `{{$localDatetime rfc1123\|iso8601}}`, `{{$processEnv VAR}}`, `{{$dotenv VAR}}` |
| Assertions | `# expect …` lines (grammar in §6) |

### 5.3 Deliberately not supported in V1

Surfaced as Diagnostics in the editor when detected, so users understand why:

- Request chaining: `{{requestName.response.body.$.x}}`, `{{requestName.response.headers.X-Auth}}`
- Prompt variables: `# @prompt varName`
- Per-request settings: `# @settingName value`
- Request Variables referencing other requests' responses: `@token = {{login.response.body.token}}`
- XML / XPath in body path assertions
- Settings-based environments (`rest-client.environmentVariables`, `$shared`, environment switcher)
- Authentication *helpers*: OAuth flows, AAD / Microsoft Identity Platform, AWS Sig v4, Digest challenge, SSL client certs, REST Client's `Basic user password` auth-block syntax. (Raw `Authorization: Bearer <token>` and similar headers are fully supported — they're just request headers.)
- Cookie jar / session persistence
- GraphQL, SOAP, gRPC, WebSocket, SSE protocol helpers
- Pre-request / response handler scripts (`< {% … %}`, `> {% … %}`)
- Code snippet generation (curl, Python, JS SDKs)
- Postman / Insomnia / Thunder Client collection import
- History of past runs beyond the current session
- CLI mode outside VS Code
- CI integration
- Telemetry (absent by design, permanently — not a scope defer)

## 6. Assertion grammar

All assertions are lines beginning with `# expect ` (note the trailing space). Multiple assertions per request are AND-ed. A request passes only if all its assertions pass.

```
# expect status <code>                        → 200, 404
# expect status <range>                       → 2xx, 4xx, 5xx
# expect header <name> equals <value>         → name case-insensitive, value exact
# expect header <name> contains <value>       → value is a substring of header value
# expect header <name> exists                 → any non-empty value
# expect body contains "<text>"               → substring on raw body string
# expect body path <jsonpath> equals <value>  → value = quoted string | number | true | false | null
# expect body path <jsonpath> exists          → path resolves to any defined value
# expect body path <jsonpath> matches /<re>/  → body field matches regex
# expect time < <N>ms                         → latency budget; accepts ms or s units (e.g., `< 1s`)
```

Evaluation notes:

- `body path` uses a minimal internal JSONPath (`$`, dot, `[n]`, recursive descent `..`). No external dep.
- If the response isn't JSON but a `body path` assertion is used, the test fails with `body is not JSON`.
- On a failure, `vscode.TestMessage.diff(summary, expected, actual)` is used where applicable (status, header, body path equality) so users get a native diff view in the Test peek. Plain `TestMessage` is used for non-diff-able failures (body contains, exists, matches, time).

## 7. Architecture

Extension host (Node) only. No webview, no language server, no worker thread. Single activation; all work runs inline in response to user commands or Test Run requests.

```
src/
├── extension.ts                  # activate/deactivate; wires everything
├── parser/
│   ├── httpDocumentParser.ts     # split file text into request blocks at ### delimiters
│   ├── requestParser.ts          # block → ParsedRequest (name, method, url, headers, body, expects, range)
│   ├── expectParser.ts           # "# expect ..." line → typed Predicate
│   └── variableResolver.ts       # file @vars, {{var}}, {{$system}}, $dotenv, $processEnv
├── runner/
│   ├── smokeRunner.ts            # orchestrates a run, drives fetch, threads AbortController
│   ├── assertionEngine.ts        # evaluates predicates against a Response
│   ├── jsonPath.ts               # minimal JSONPath: $, ., [n], ..
│   └── redactor.ts               # strips sensitive headers from strings rendered in output
├── testing/
│   ├── testController.ts         # creates the TestController, owns the TestItem tree
│   └── runHandler.ts             # TestRunProfile handler — iterates items, calls run.passed/failed
├── codeLens/
│   └── codeLensProvider.ts       # "Run Request" per ### block, "Run File" at file top
├── diagnostics/
│   └── diagnosticsProvider.ts    # warns on unresolved vars, chaining, @prompt, @settingName
└── util/
    ├── dotenv.ts                 # self-written 30-line .env parser, no dependency
    └── durations.ts              # "< 1s" / "< 500ms" parser → number (ms)

test/
├── parser.test.ts
├── expectParser.test.ts
├── assertions.test.ts
├── variableResolver.test.ts
├── jsonPath.test.ts
├── redactor.test.ts
└── integration/
    └── endToEnd.test.ts          # boots in-process HTTP server on random port,
                                  # runs a fixture .http against it,
                                  # asserts TestRun state transitions
```

### 7.1 Data flow for a run

1. User triggers a run (Test Explorer "Run" button on a file/item, CodeLens, or command palette `HTTP Smoke: Run File`/`Run Workspace`/`Run Request`).
2. `testController.ts` ensures the `TestItem` tree is in sync with the document via `controller.items.replace(...)` for that file.
3. `runHandler.ts` calls `controller.createTestRun(request)`, marks each queued item `run.started(item)`.
4. `httpDocumentParser` → `requestParser` → `ParsedRequest[]`.
5. `variableResolver` substitutes `{{…}}` against file vars, system vars, and (if the workspace-level `.env` gate is on) `$dotenv` values; unresolved references become `TestMessage`-able parse errors or Diagnostic warnings depending on kind.
6. `smokeRunner` iterates sequentially:
   - Creates a single `AbortController`; binds `run.token.onCancellationRequested(() => ac.abort())`.
   - Calls `fetch(url, { method, headers, body, signal: ac.signal })`.
   - Applies per-request timeout via `setTimeout(() => ac.abort('timeout'), cfg.requestTimeoutMs)`.
   - `assertionEngine.evaluate(response, expects)` → `{ ok: boolean, failures: FailureDetail[] }`.
   - On pass: `run.passed(item, durationMs)`.
   - On fail with diff-able kind: `run.failed(item, vscode.TestMessage.diff(summary, expected, actual), durationMs)`.
   - On fail with non-diff kind or parse error: `run.failed(item, new vscode.TestMessage(summary), durationMs)`; the message's `location` is set to the request block's `Location(uri, range)` for gutter-jump-to-source.
   - `run.appendOutput(formattedTranscript)` per request — CRLF-terminated, ANSI-colored, response headers + body (redacted).
7. On queue drain or cancel, `run.end()`.

### 7.2 Dependency choices

| Concern | Choice | Why |
|---|---|---|
| HTTP | Native global `fetch` (Node ≥ 20.15, bundled with VS Code ≥ 1.90) | No external dep; consistent with the "zero runtime" promise. |
| AbortController | Native | Ditto. |
| JSON path | Self-written (~80 LOC) | `jsonpath` has known CVEs + ~500 KB; `jsonpath-plus` is 150 KB. Our subset is tiny. |
| `.env` parsing | Self-written (~30 LOC) | `dotenv` adds a dep for one regex; we skip. |
| Bundler | esbuild (default from `yo code` 2026) | Fast, default, simpler config than webpack. |
| Language | TypeScript (default from `yo code`) | TS 6.x is current stable; TS 7 (Go-native) is still preview. |
| Test runner | Mocha via `@vscode/test-cli` + `@vscode/test-electron` | Official; sample-aligned. |
| Assertions in tests | `node:assert/strict` | Zero dep. |

## 8. `package.json` contribution points

```jsonc
{
  "name": "http-smoke-runner",
  "displayName": "HTTP Smoke Runner",
  "description": "Run .http and .rest files like smoke tests — pass/fail, latency, jump-to-failure, directly in VS Code.",
  "publisher": "arunbrahma",
  "version": "0.1.0",
  "engines": { "vscode": "^1.90.0" },
  "license": "MIT",
  "categories": ["Testing", "Other"],
  "keywords": ["http", "rest", "api", "test", "smoke", "rest-client", ".http", ".rest"],
  "main": "./dist/extension.js",
  "activationEvents": [
    "onLanguage:http",
    "onLanguage:rest",
    "workspaceContains:**/*.http",
    "workspaceContains:**/*.rest"
  ],
  "contributes": {
    "commands": [
      { "command": "httpSmokeRunner.runFile",      "title": "HTTP Smoke: Run File" },
      { "command": "httpSmokeRunner.runWorkspace", "title": "HTTP Smoke: Run Workspace" },
      { "command": "httpSmokeRunner.runRequest",   "title": "HTTP Smoke: Run Request" }
    ],
    "configuration": {
      "title": "HTTP Smoke Runner",
      "properties": {
        "httpSmokeRunner.requestTimeoutMs": {
          "type": "number",
          "default": 30000,
          "description": "Per-request timeout in milliseconds. The whole run is also cancellable from the Test Explorer."
        },
        "httpSmokeRunner.loadDotenv": {
          "type": "boolean",
          "default": true,
          "description": "Resolve {{$dotenv VAR}} from a .env file in the workspace root. Set false to disable entirely."
        },
        "httpSmokeRunner.redactedHeaders": {
          "type": "array",
          "default": [
            "authorization",
            "cookie",
            "set-cookie",
            "x-api-key",
            "api-key",
            "x-auth-token",
            "proxy-authorization"
          ],
          "description": "Header names (case-insensitive) whose values are redacted to `<first 4 chars>***` in Test Output."
        }
      }
    }
  }
}
```

Notes:
- `onCommand:*` activation events are implicit for declared commands since VS Code 1.75+ and are not listed.
- REST Client contributes the `http` and `rest` language IDs; if REST Client is not installed, our `workspaceContains` patterns still trigger activation.

## 9. User-visible behavior

### 9.1 Test Explorer tree

```
HTTP Smoke Runner
└─ requests.http
   ├─ ✓ health                    42 ms
   ├─ ✓ listUsers                 73 ms
   └─ ✗ create user               91 ms   expected status 201, got 500
```

### 9.2 CodeLens in an `.http` file

```
[Run File]                            ← at line 1
@baseUrl = http://localhost:3000

[Run Request]                         ← above each ### block
### create user
POST {{baseUrl}}/users
...
```

### 9.3 Status bar summary

Right-aligned item showing the last-run summary, e.g. `HTTP Smoke: 3✓ 1✗ · 248 ms`. Clicking it reveals the Testing view focused on the last run. Updates on every run completion and hides when no run has happened in the current session.

### 9.4 Settings UX for `.env`

First time a run would resolve `{{$dotenv X}}` and a `.env` exists in the workspace, show a one-time modal:

> HTTP Smoke Runner found a `.env` file. Load its values for `{{$dotenv …}}` substitution in `.http` files?
> **[Yes, load it]**  **[No, ignore]**  **[Never ask again]**

Choice is stored in `context.workspaceState` as `loadDotenvChoice` (`yes` | `no` | `never`). Global setting `httpSmokeRunner.loadDotenv` can force-disable regardless.

### 9.5 Diagnostics (warnings) in the editor

When the parser detects unsupported constructs, a yellow squiggle appears on the offending token with messages like:

- *"Chaining is not supported in V1. The literal text `{{login.response.body.$.token}}` will be sent as-is."*
- *"`# @prompt` is not supported in V1. This request will run with the prompt variable unresolved."*
- *"Unknown system variable `{{$jwt}}`. Will be sent as-is."*

Source: `httpSmokeRunner`. Severity: Warning.

## 10. Build plan — 3 days

### Day 1 — skeleton + happy path

- `yo code` with TypeScript + esbuild
- Fill in Marketplace identity fields in `package.json`
- Parser: `###` splitting, request-line / headers / body extraction
- CodeLens provider: "Run Request" above each `###` block, "Run File" at top
- Commands registered; `httpSmokeRunner.runRequest` fires `fetch` and logs to an Output Channel (no Test API yet)
- Reserve the Marketplace name by publishing `0.0.1` with just the README. This guards against a same-name collision during the 2–3 day build.

### Day 2 — assertions + Test API + variables

- Wire `vscode.tests.createTestController` and a `TestRunProfile`
- Run handler drives the smoke runner and calls `run.passed/failed` with `durationMs` and `TestMessage.diff(...)` where applicable
- `# expect` parser and assertion engine (status, status range, header contains/equals/exists, body contains, body path equals/exists/matches, time)
- File vars, `{{var}}` interpolation, system vars (`$guid`, `$timestamp`, `$datetime`, `$randomInt`), `{{$processEnv}}` (OS env, no prompt), and `{{$dotenv}}` with the one-time workspace-consent prompt
- Cancellation wired from `run.token` to a single `AbortController`
- Redactor applied to all output strings
- Unit tests: parser, expectParser, assertionEngine, variableResolver, jsonPath, redactor
- End-to-end integration test against an in-process HTTP server

### Day 3 — workspace scan, polish, publish

- `vscode.workspace.findFiles('**/*.{http,rest}', '**/node_modules/**')` to populate the tree when the Test Explorer is first opened in a workspace
- Diagnostics provider for unsupported constructs (chaining, `@prompt`, unknown `$system` vars, malformed `@var`, malformed `# expect`)
- Status bar summary after a run
- README with screenshots captured from running against a local Express stub app
- Icon (128×128 PNG) — placeholder generated; committed to `media/icon.png`
- `vsce package` → `http-smoke-runner-0.1.0.vsix`; install into a clean VS Code profile for a sanity pass against the fixture repo
- `vsce publish minor` (bumps `0.0.1` → `0.1.0`) with the approved PAT

## 11. Testing & QA

### 11.1 Unit tests (Mocha)

Pure functions, no VS Code host:

- `httpDocumentParser` — boundary cases: CRLF vs LF, `####`+ separators, trailing whitespace, empty file, single request, file with only comments, file with `@var` lines only, labels with special chars
- `expectParser` — every documented predicate in §6, plus malformed inputs that must fail cleanly with position info
- `assertionEngine` — matrix of (pass, fail, diff-able-fail) for each predicate
- `variableResolver` — nested vars, unresolved references, system vars, `$dotenv` gate on/off, precedence (request > file > system), circular reference guard
- `jsonPath` — positive + negative cases for `$`, `.prop`, `[n]`, `..prop`, missing paths
- `redactor` — case-insensitive header names, partial matching, Set-Cookie (multi-value), nothing leaks into output strings

### 11.2 Integration test (VS Code test harness)

One end-to-end test that:

1. Boots an in-process HTTP server on a random port (returns JSON for `/health`, `/users`, `/users` POST — including a deterministic 500 for a specific header trigger)
2. Writes a fixture `.http` file to a temp workspace
3. Activates the extension, waits for the TestController to populate
4. Invokes the run programmatically, waits for `run.end`
5. Asserts the expected `passed`/`failed` outcomes and their messages

### 11.3 Manual QA checklist

Committed to `docs/manual-qa.md`:

- [ ] Run against a local Express app (fixture provided in `test/fixtures/express-app/`)
- [ ] Run against `https://httpbin.org` using the public fixture
- [ ] File with deliberate failures — verify messages + gutter + jump-to-source
- [ ] File using chaining — verify it shows Diagnostic warnings and doesn't crash
- [ ] File with `.env` reference — verify one-time prompt, then remembers choice
- [ ] Cancel a run mid-way — verify in-flight request is aborted and run ends
- [ ] Very large response body (~10 MB) — verify it's truncated in output, not full-dumped
- [ ] Binary response body (image/png) — verify assertion engine fails gracefully, not crashes
- [ ] Self-signed HTTPS target — document behavior (fetch throws on invalid cert; surfaced as errored test)

## 12. Marketplace copy (README header and Marketplace description)

> **HTTP Smoke Runner** turns the `.http` files already in your repo into a smoke-test suite. Keep using REST Client syntax — this adds `# expect` lines and a Run button. Every request executes with pass/fail, latency, and clickable jump-to-failure, right in VS Code's Testing panel.
>
> - Works with REST Client files unchanged (the common subset) — no rewrite required
> - Results appear in the native Testing panel, not another sidebar
> - Zero external runtime (no Node install, no Python install)
> - Zero telemetry, zero account, fully local
> - MIT licensed; source on GitHub

## 13. Security & privacy principles (non-negotiable)

- No network traffic initiated by the extension itself — only the HTTP requests the user's file declares.
- No telemetry, ever.
- No auto-execution on file open; runs only in response to explicit user action (click, command, or Test Explorer button).
- `.env` loading is gated behind a one-time consent prompt; globally killable via setting.
- Sensitive headers (per §8 config) are redacted in every rendered output string. Raw response bodies are shown in the Test Output terminal only; never written to disk unless the user runs an explicit "Save Response" command (not in V1).
- Extension does not read files outside the workspace.

## 14. Risks + mitigations

| Risk | Mitigation |
|---|---|
| User opens a REST Client file using chaining → requests fail silently | Pre-run Diagnostics pass flags unresolved `{{name.response.…}}` references as warnings with explanation |
| `.env` auto-load feels invasive | One-time modal consent; workspace-scoped memory; global kill-switch in settings |
| Non-JSON response + `body path` assertion crashes | Assertion engine wraps JSON parse in try/catch → fails the test with a clear reason |
| Malformed `.http` file | Parser is permissive; unparseable blocks become `errored` tests with the parse error as the message; the rest of the file still runs |
| Marketplace name collision during build | Reserve the name on Day 1 by publishing `0.0.1` with just the README |
| Someone reports a rare REST Client syntax we missed | README clearly lists the supported subset; unknown constructs become Diagnostics, not crashes; GitHub issues triage drives follow-up versions |
| Binary response body exhausts memory | Assertion engine does not call `.text()` or `.json()` on responses with `Content-Length` > 10 MB by default; assertion on body content fails with "response too large" in that case |
| Self-signed HTTPS targets | Respect Node TLS behavior (reject-unauthorized by default). Document that users can opt into `NODE_TLS_REJECT_UNAUTHORIZED=0` for local dev — do not add a bypass flag in the extension itself |

## 15. Open questions deferred to implementation planning

- Exact minimum `engines.vscode` version — `^1.90.0` is the current pick; verify no API we depend on needs newer. Confirmed today: `createTestController`, `TestMessage.diff`, `registerCodeLensProvider`, `workspace.findFiles`, `createDiagnosticCollection`, global `fetch`/`AbortController` are all stable at 1.90.
- Whether to contribute our own `http` language grammar as a fallback when REST Client is not installed, or rely on `plaintext` + our parser. Recommended: document that REST Client is optional but recommended for syntax highlighting; do not ship a competing grammar.
- Whether to publish on Open VSX in addition to VS Code Marketplace. Recommended: yes, Day 3 after Marketplace publish succeeds — it's a single additional `ovsx publish` with the same `.vsix`.

## 16. Glossary

- **`.http` / `.rest` file**: Plain-text file containing one or more HTTP requests, separated by `###`, editable in any text editor; the de-facto format popularized by REST Client and JetBrains HTTP Client.
- **Smoke test**: A fast, coarse check that the basic "is my API alive and responding sensibly?" invariants hold. Not an integration test, not a contract test, not a load test.
- **TestController (VS Code)**: The first-class API (`vscode.tests.createTestController`) through which an extension contributes tests into the built-in Testing panel, with native run/debug/cancel/gutter support.
- **Publish-only controller**: A TestController pattern where results are created outside of a standard run profile; used here because test "runs" are user-triggered from commands and CodeLens, not only from the Testing panel's native buttons.

---

**End of spec.** Next step: invoke `writing-plans` to produce the implementation plan.
