import * as vscode from 'vscode';
import { requestById, reparseOne } from './testController.ts';
import { resolveRequest } from '../parser/resolveRequest.ts';
import { parseHttpFile } from '../parser/parseFile.ts';
import { runSmoke } from '../runner/smokeRunner.ts';
import { maybeLoadDotenv } from '../util/dotenvGate.ts';
import { statusBar } from '../statusBar.ts';

interface RunCounters {
  passed: number;
  failed: number;
  totalMs: number;
}

export function makeRunHandler(
  context: vscode.ExtensionContext,
  controller: vscode.TestController
) {
  return async function runHandler(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ): Promise<void> {
    const run = controller.createTestRun(request);
    const counters: RunCounters = { passed: 0, failed: 0, totalMs: 0 };

    const queue: vscode.TestItem[] = [];
    if (request.include) request.include.forEach(t => queue.push(t));
    else controller.items.forEach(t => queue.push(t));

    try {
      for (const item of queue) {
        if (request.exclude?.includes(item)) continue;
        await runItem(context, controller, run, item, token, counters);
      }
    } finally {
      run.end();
      statusBar.update(counters.passed, counters.failed, counters.totalMs);
    }
  };
}

async function runItem(
  context: vscode.ExtensionContext,
  controller: vscode.TestController,
  run: vscode.TestRun,
  item: vscode.TestItem,
  token: vscode.CancellationToken,
  counters: RunCounters
): Promise<void> {
  if (token.isCancellationRequested) return;

  // File-level item: reparse then recurse into children.
  const isRequest = requestById.has(item.id);
  if (!isRequest && item.uri) {
    await reparseOne(controller, item);
    for (const child of collectChildren(item)) {
      await runItem(context, controller, run, child, token, counters);
    }
    return;
  }

  const meta = requestById.get(item.id);
  if (!meta) return;

  const cfg = vscode.workspace.getConfiguration('httpSmokeRunner');
  const timeout = cfg.get<number>('requestTimeoutMs', 30000);
  const redacted = cfg.get<string[]>('redactedHeaders', []);

  run.started(item);

  const bytes = await vscode.workspace.fs.readFile(meta.uri);
  const text = new TextDecoder('utf-8').decode(bytes);
  const { requests, fileVars } = parseHttpFile(text);
  const req = requests.find(r => r.startLine === meta.request.startLine) ?? meta.request;

  const wsRoot = vscode.workspace.getWorkspaceFolder(meta.uri)?.uri.fsPath;
  const dotenv = wsRoot ? await maybeLoadDotenv(context, wsRoot) : {};

  const { resolved, unresolved } = resolveRequest(req, {
    fileVars,
    processEnv: process.env as Record<string, string | undefined>,
    dotenv
  });

  if (unresolved.length > 0) {
    run.appendOutput(`! unresolved variables: ${unresolved.join(', ')}\r\n`, undefined, item);
  }

  const ac = new AbortController();
  token.onCancellationRequested(() => ac.abort('cancelled'));

  const [result] = await runSmoke([resolved], {
    requestTimeoutMs: timeout,
    signal: ac.signal,
    redactedHeaders: redacted
  });

  counters.totalMs += result.durationMs;
  run.appendOutput(result.transcript.replace(/\r?\n/g, '\r\n'), undefined, item);

  if (result.errorMessage) {
    run.errored(item, new vscode.TestMessage(result.errorMessage), result.durationMs);
    counters.failed += 1;
    return;
  }

  if (!result.ok) {
    const messages: vscode.TestMessage[] = result.failures.map(f => {
      const msg =
        f.diffable && f.expected !== undefined && f.actual !== undefined
          ? vscode.TestMessage.diff(f.summary, f.expected, f.actual)
          : new vscode.TestMessage(f.summary);
      if (meta.uri && item.range) msg.location = new vscode.Location(meta.uri, item.range);
      return msg;
    });
    run.failed(item, messages, result.durationMs);
    counters.failed += 1;
    return;
  }

  run.passed(item, result.durationMs);
  counters.passed += 1;
}

function collectChildren(item: vscode.TestItem): vscode.TestItem[] {
  const out: vscode.TestItem[] = [];
  item.children.forEach(c => out.push(c));
  return out;
}
