import * as vscode from 'vscode';
import { parseHttpFile } from '../parser/parseFile.ts';

export class HttpSmokeCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onChange.event;

  refresh(): void {
    this._onChange.fire();
  }

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    if (!isHttpLike(doc)) return [];

    const lenses: vscode.CodeLens[] = [];
    lenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: '▶ Run File',
        command: 'httpSmokeRunner.runFile',
        arguments: [doc.uri]
      })
    );

    const { requests } = parseHttpFile(doc.getText());
    for (const r of requests) {
      const line = r.startLine - 1;
      lenses.push(
        new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
          title: `▶ Run Request${r.name ? ' — ' + r.name : ''}`,
          command: 'httpSmokeRunner.runRequest',
          arguments: [doc.uri, line]
        })
      );
    }
    return lenses;
  }
}

function isHttpLike(doc: vscode.TextDocument): boolean {
  if (doc.languageId === 'http' || doc.languageId === 'rest') return true;
  const name = doc.fileName.toLowerCase();
  return name.endsWith('.http') || name.endsWith('.rest');
}
