import * as vscode from 'vscode';
import { parseHttpFile } from '../parser/parseFile.ts';

export class HttpSmokeDiagnosticsProvider implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('httpSmokeRunner');

  refresh(doc: vscode.TextDocument): void {
    if (!isHttpLike(doc)) {
      this.collection.delete(doc.uri);
      return;
    }
    const { diagnostics } = parseHttpFile(doc.getText());
    const out: vscode.Diagnostic[] = diagnostics.map(d => {
      const line = Math.max(0, d.line - 1);
      const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
      const diag = new vscode.Diagnostic(
        range,
        d.message,
        d.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning
      );
      diag.source = 'http-smoke-runner';
      return diag;
    });
    this.collection.set(doc.uri, out);
  }

  dispose(): void {
    this.collection.dispose();
  }
}

function isHttpLike(doc: vscode.TextDocument): boolean {
  if (doc.languageId === 'http' || doc.languageId === 'rest') return true;
  const n = doc.fileName.toLowerCase();
  return n.endsWith('.http') || n.endsWith('.rest');
}
