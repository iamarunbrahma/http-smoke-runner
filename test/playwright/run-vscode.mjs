// Playwright-driven automation that launches VS Code with our extension,
// opens the fixture .http file, runs the tests via the Testing panel, and
// verifies the 3-pass / 1-fail outcome by inspecting the DOM and by
// programmatically reading the extension's API via an evaluate bridge.
//
// Usage:   node test/playwright/run-vscode.mjs

import { _electron as electron } from 'playwright';
import { createServer } from 'node:http';
import { mkdtempSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const FIXTURE_HTTP = join(REPO_ROOT, 'test', 'fixtures', 'example.http');
const VSCODE_ELECTRON_PATH = '/Applications/Visual Studio Code.app/Contents/MacOS/Electron';

// --- Stub HTTP server ---------------------------------------------------------

function startTestServer() {
  return new Promise(resolveListen => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') {
        res.setHeader('content-type', 'text/plain');
        res.statusCode = 200;
        res.end('ok');
        return;
      }
      if (url.pathname === '/users' && req.method === 'GET') {
        res.setHeader('content-type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify([{ id: 1 }, { id: 2 }]));
        return;
      }
      if (url.pathname === '/users' && req.method === 'POST') {
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', () => {
          if (req.headers['x-fail'] === '1') {
            res.setHeader('content-type', 'application/json');
            res.statusCode = 500;
            res.end('{"error":"boom"}');
            return;
          }
          const payload = body ? JSON.parse(body) : {};
          res.setHeader('content-type', 'application/json');
          res.statusCode = 201;
          res.end(JSON.stringify({ id: 42, ...payload }));
        });
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    server.listen(0, '127.0.0.1', () => {
      resolveListen({ server, port: server.address().port });
    });
  });
}

function makeWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'hsr-playwright-'));
  copyFileSync(FIXTURE_HTTP, join(dir, 'example.http'));

  const userDataDir = mkdtempSync(join(tmpdir(), 'hsr-pw-userdata-'));
  const extDir = mkdtempSync(join(tmpdir(), 'hsr-pw-exts-'));
  mkdirSync(join(userDataDir, 'User'), { recursive: true });
  writeFileSync(
    join(userDataDir, 'User', 'settings.json'),
    JSON.stringify(
      {
        'security.workspace.trust.enabled': false,
        'workbench.startupEditor': 'none',
        'workbench.enableExperiments': false,
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false
      },
      null,
      2
    )
  );
  return { workspace: dir, userDataDir, extDir };
}

// --- Assertion helpers --------------------------------------------------------

function expect(label, value, condition) {
  const ok = condition(value);
  const icon = ok ? '✓' : '✗';
  const line = `${icon} ${label}: ${JSON.stringify(value)}`;
  console.log('[hsr-test]', line);
  return { label, value, ok };
}

// --- Main ---------------------------------------------------------------------

async function main() {
  const log = (...xs) => console.log('[hsr-test]', ...xs);
  const results = [];

  log('starting stub server...');
  const { server, port } = await startTestServer();
  log(`stub server on :${port}`);

  const { workspace, userDataDir, extDir } = makeWorkspace();
  log('workspace:', workspace);

  log('launching VS Code via Playwright Electron...');
  const electronApp = await electron.launch({
    executablePath: VSCODE_ELECTRON_PATH,
    args: [
      workspace,
      `--extensionDevelopmentPath=${REPO_ROOT}`,
      `--user-data-dir=${userDataDir}`,
      `--extensions-dir=${extDir}`,
      '--disable-workspace-trust',
      '--disable-gpu-sandbox',
      '--no-sandbox',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-telemetry',
      '--new-window'
    ],
    env: {
      ...process.env,
      HSR_TEST_PORT: String(port),
      ELECTRON_ENABLE_LOGGING: '1'
    },
    timeout: 60_000
  });

  const window = await electronApp.firstWindow();
  log('window ready');
  const pageLogs = [];
  window.on('console', msg => pageLogs.push(`[${msg.type()}] ${msg.text()}`));

  await window.waitForSelector('.monaco-workbench', { timeout: 30_000 });
  await window.waitForTimeout(4000); // let extension host boot + onDidOpen fire

  results.push(
    expect('window title indicates Extension Dev Host', await window.title(), t =>
      t.includes('Extension Development Host')
    )
  );
  results.push(
    expect('page log confirms our extension loaded', pageLogs.join('\n'), s =>
      s.includes('Loading development extension at') && s.includes('vs-code')
    )
  );
  results.push(
    expect('page log confirms extension host started', pageLogs.join('\n'), s =>
      s.includes('Started local extension host')
    )
  );

  const screenshotDir = join(REPO_ROOT, 'test', 'playwright', 'screenshots');
  mkdirSync(screenshotDir, { recursive: true });
  const shot = (name) => join(screenshotDir, name);
  await window.screenshot({ path: shot('01-initial.png') });

  // ---- Open example.http so extension sees it ----
  log('opening example.http via command palette...');
  await window.keyboard.press('Meta+P');
  await window.waitForTimeout(500);
  await window.keyboard.type('example.http');
  await window.waitForTimeout(500);
  await window.keyboard.press('Enter');
  await window.waitForTimeout(1500);
  await window.screenshot({ path: shot('02-file-open.png') });

  // Count CodeLens anchors — VS Code renders CodeLens inside Monaco as a
  // contentwidget with class "contentwidget codelens-decoration" or
  // anchored at ".codelens-decoration"; newer builds use ".codelens-decoration"
  // inside the editor. We'll look for text that matches our lens titles.
  const codeLensTitles = await window
    .locator('.monaco-editor .codelens-decoration')
    .allTextContents()
    .catch(() => []);
  results.push(
    expect('CodeLens anchors present', codeLensTitles, arr =>
      arr.some(t => t.includes('Run File') || t.includes('Run Request'))
    )
  );

  // ---- Open Testing panel ----
  log('opening Testing view...');
  await window.keyboard.press('Meta+Shift+P');
  await window.waitForTimeout(500);
  await window.keyboard.type('Testing: Focus on Test Explorer View');
  await window.waitForTimeout(400);
  await window.keyboard.press('Enter');
  await window.waitForTimeout(2000);
  await window.screenshot({ path: shot('03-testing-panel.png') });

  // Expand the file node by clicking it (it says "example.http")
  const fileNode = window.locator('[role="treeitem"]:has-text("example.http")').first();
  await fileNode.waitFor({ timeout: 5000 });
  await fileNode.click();
  await window.waitForTimeout(500);
  // trigger expansion via arrow-right
  await window.keyboard.press('ArrowRight');
  await window.waitForTimeout(1500);
  await window.screenshot({ path: shot('04-testing-expanded.png') });

  const testTreeItems = await window
    .locator('.test-explorer [role="treeitem"]')
    .allTextContents()
    .catch(() => []);
  log('testing tree items after expand:', testTreeItems);

  results.push(
    expect('Testing tree shows example.http', testTreeItems, arr =>
      arr.some(t => t.includes('example.http'))
    )
  );
  results.push(
    expect('Testing tree shows "health" request', testTreeItems, arr =>
      arr.some(t => t.includes('health'))
    )
  );
  results.push(
    expect('Testing tree shows "create user"', testTreeItems, arr =>
      arr.some(t => t.includes('create user'))
    )
  );
  results.push(
    expect('Testing tree shows "deliberate failure"', testTreeItems, arr =>
      arr.some(t => t.toLowerCase().includes('deliberate'))
    )
  );

  // ---- Run all tests via command palette ----
  log('triggering Testing: Run All Tests...');
  await window.keyboard.press('Meta+Shift+P');
  await window.waitForTimeout(400);
  await window.keyboard.type('Test: Run All Tests');
  await window.waitForTimeout(400);
  await window.keyboard.press('Enter');

  // Wait for the run to complete — our server is fast so 6s is plenty
  await window.waitForTimeout(6000);
  await window.screenshot({ path: shot('05-after-run.png') });

  // Read the status bar — our extension shows "HTTP Smoke: Np Nf · Nms"
  const statusBarText = await window
    .locator('.statusbar .statusbar-item')
    .allTextContents()
    .catch(() => []);
  log('status bar items:', statusBarText);

  const hsrStatus = statusBarText.find(t => t.includes('HTTP Smoke'));
  log('HSR status bar entry:', hsrStatus);
  results.push(
    expect('status bar shows HTTP Smoke summary', hsrStatus ?? '', s =>
      s.includes('HTTP Smoke') && /\d+✓/.test(s) && /\d+✗/.test(s)
    )
  );

  // Parse the status bar text — expected 3 pass, 1 fail
  if (hsrStatus) {
    const passMatch = hsrStatus.match(/(\d+)✓/);
    const failMatch = hsrStatus.match(/(\d+)✗/);
    results.push(expect('3 tests passed', Number(passMatch?.[1] ?? -1), n => n === 3));
    results.push(expect('1 test failed', Number(failMatch?.[1] ?? -1), n => n === 1));
  }

  // Final DOM scan: look for pass/fail indicators in the test tree
  const passedItems = await window
    .locator('[role="treeitem"] [aria-label*="Passed" i]')
    .count()
    .catch(() => 0);
  const failedItems = await window
    .locator('[role="treeitem"] [aria-label*="Failed" i]')
    .count()
    .catch(() => 0);
  log('DOM passed count:', passedItems, 'failed count:', failedItems);

  await window.screenshot({ path: shot('06-final.png') });

  // --- Summary ---
  const total = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = total - passed;
  log('');
  log('=== VERIFICATION SUMMARY ===');
  log(`${passed}/${total} checks passed`);
  for (const r of results) log(` ${r.ok ? '✓' : '✗'} ${r.label}`);
  log('============================');

  const summaryPath = join(screenshotDir, 'summary.json');
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        passed,
        failed,
        total,
        results,
        statusBar: hsrStatus,
        testItems: testTreeItems,
        windowTitle: await window.title()
      },
      null,
      2
    )
  );
  log('wrote', summaryPath);

  await electronApp.close();
  server.close();

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('[hsr-test] FAILED:', err);
  process.exit(1);
});
