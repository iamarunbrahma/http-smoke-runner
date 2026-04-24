# Manual QA — HTTP Smoke Runner 0.1.0

Run all of these before `vsce publish`. Each must pass.

- [ ] Install the `.vsix` into a clean VS Code profile and open a workspace containing `test/fixtures/example.http`.
- [ ] Open the file; the Testing panel shows the file and its 4 requests.
- [ ] Run the whole file — 3 pass, 1 intentional failure shows red X with expected-vs-actual (diff view).
- [ ] Click the failing test — editor jumps to the exact request block.
- [ ] Cancel a running suite mid-way — in-flight request aborts, run ends cleanly.
- [ ] File using `{{login.response.body.$.token}}` chaining shows a yellow Diagnostic warning and doesn't crash.
- [ ] File referencing `{{$dotenv API_KEY}}` prompts once on first run, remembers choice per workspace.
- [ ] Very large (~10 MB) response — transcript truncated, no memory blowup.
- [ ] Binary response body + `body path` assertion — fails with "body is not JSON", no crash.
- [ ] Non-JSON 500 response — extension surfaces `expected status 200, got 500` cleanly.
- [ ] Status bar shows `HTTP Smoke: Np Nf · Nms` after a run; clicking it opens the Testing view.
- [ ] Publish a `0.1.1` patch, install the update, verify no broken state or stale tests.
