import * as vscode from 'vscode';
import {
  createHttpTestController,
  forgetFile,
  getOrCreateFileItem,
  reparseOne
} from './testing/testController.ts';
import { makeRunHandler } from './testing/runHandler.ts';
import { HttpSmokeCodeLensProvider } from './codeLens/codeLensProvider.ts';
import { HttpSmokeDiagnosticsProvider } from './diagnostics/diagnosticsProvider.ts';
import { statusBar } from './statusBar.ts';

export interface HttpSmokeApi {
  controller: vscode.TestController;
}

export function activate(context: vscode.ExtensionContext): HttpSmokeApi {
  const controller = createHttpTestController();
  context.subscriptions.push(controller);

  const runHandler = makeRunHandler(context, controller);
  const runProfile = controller.createRunProfile(
    'Run',
    vscode.TestRunProfileKind.Run,
    runHandler,
    true
  );

  const startRun = async (include: vscode.TestItem[]): Promise<void> => {
    const request = new vscode.TestRunRequest(include, undefined, runProfile);
    const tokenSource = new vscode.CancellationTokenSource();
    try {
      await runHandler(request, tokenSource.token);
    } finally {
      tokenSource.dispose();
    }
  };

  // Re-parse file items on open / change / save.
  const reparseIfHttp = async (doc: vscode.TextDocument): Promise<void> => {
    if (!isHttpDoc(doc)) return;
    const item = getOrCreateFileItem(controller, doc.uri);
    await reparseOne(controller, item);
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(reparseIfHttp),
    vscode.workspace.onDidChangeTextDocument(e => reparseIfHttp(e.document)),
    vscode.workspace.onDidSaveTextDocument(reparseIfHttp),
    vscode.workspace.onDidDeleteFiles(e => {
      for (const uri of e.files) {
        forgetFile(uri);
        controller.items.delete(uri.toString());
      }
    })
  );

  // CodeLens
  const codeLens = new HttpSmokeCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { scheme: 'file', language: 'http' },
        { scheme: 'file', language: 'rest' },
        { scheme: 'file', pattern: '**/*.http' },
        { scheme: 'file', pattern: '**/*.rest' }
      ],
      codeLens
    ),
    vscode.workspace.onDidChangeTextDocument(() => codeLens.refresh())
  );

  // Diagnostics
  const diag = new HttpSmokeDiagnosticsProvider();
  context.subscriptions.push(
    diag,
    vscode.workspace.onDidOpenTextDocument(d => diag.refresh(d)),
    vscode.workspace.onDidChangeTextDocument(e => diag.refresh(e.document)),
    vscode.workspace.onDidSaveTextDocument(d => diag.refresh(d))
  );
  vscode.workspace.textDocuments.forEach(d => diag.refresh(d));

  // Status bar
  context.subscriptions.push(statusBar);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('httpSmokeRunner.runFile', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) return;
      const item = getOrCreateFileItem(controller, target);
      await reparseOne(controller, item);
      await startRun([item]);
    }),
    vscode.commands.registerCommand('httpSmokeRunner.runWorkspace', () => {
      return vscode.commands.executeCommand('testing.runAll');
    }),
    vscode.commands.registerCommand(
      'httpSmokeRunner.runRequest',
      async (uri: vscode.Uri, line: number) => {
        const item = getOrCreateFileItem(controller, uri);
        await reparseOne(controller, item);
        const children: vscode.TestItem[] = [];
        item.children.forEach(c => children.push(c));
        const child = children.find(c => c.range?.start.line === line);
        if (child) {
          await startRun([child]);
        }
      }
    )
  );

  return { controller };
}

export function deactivate(): void {}

function isHttpDoc(doc: vscode.TextDocument): boolean {
  if (doc.languageId === 'http' || doc.languageId === 'rest') return true;
  const n = doc.fileName.toLowerCase();
  return n.endsWith('.http') || n.endsWith('.rest');
}
