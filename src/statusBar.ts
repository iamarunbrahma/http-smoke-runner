import * as vscode from 'vscode';

export class HttpSmokeStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

  constructor() {
    this.item.command = 'workbench.view.testing.focus';
    this.item.tooltip = 'HTTP Smoke Runner — last run';
  }

  update(passed: number, failed: number, totalMs: number): void {
    const icon = failed === 0 ? '$(check)' : '$(error)';
    this.item.text = `${icon} HTTP Smoke: ${passed}✓ ${failed}✗ · ${totalMs} ms`;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}

export const statusBar = new HttpSmokeStatusBar();
