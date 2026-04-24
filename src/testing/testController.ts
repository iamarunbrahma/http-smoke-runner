import * as vscode from 'vscode';
import { parseHttpFile } from '../parser/parseFile.ts';
import type { ParsedRequest } from '../types.ts';

/** Maps TestItem.id to the ParsedRequest it represents. */
export const requestById = new Map<string, { uri: vscode.Uri; request: ParsedRequest }>();

export function createHttpTestController(): vscode.TestController {
  const controller = vscode.tests.createTestController('httpSmokeRunner', 'HTTP Smoke Runner');

  controller.resolveHandler = async item => {
    if (!item) {
      await discoverAllFiles(controller);
      return;
    }
    if (item.uri) await reparseOne(controller, item);
  };

  return controller;
}

async function discoverAllFiles(controller: vscode.TestController): Promise<void> {
  const uris = await vscode.workspace.findFiles('**/*.{http,rest}', '**/node_modules/**');
  for (const uri of uris) getOrCreateFileItem(controller, uri);
}

export function getOrCreateFileItem(
  controller: vscode.TestController,
  uri: vscode.Uri
): vscode.TestItem {
  const id = uri.toString();
  const existing = controller.items.get(id);
  if (existing) return existing;
  const rel = vscode.workspace.asRelativePath(uri);
  const item = controller.createTestItem(id, rel, uri);
  item.canResolveChildren = true;
  controller.items.add(item);
  return item;
}

export async function reparseOne(
  controller: vscode.TestController,
  fileItem: vscode.TestItem
): Promise<void> {
  if (!fileItem.uri) return;
  const bytes = await vscode.workspace.fs.readFile(fileItem.uri);
  const text = new TextDecoder('utf-8').decode(bytes);
  const { requests } = parseHttpFile(text);
  fileItem.children.replace([]);
  for (const req of requests) {
    const id = `${fileItem.uri.toString()}#${req.startLine}`;
    const child = controller.createTestItem(id, req.name, fileItem.uri);
    child.range = new vscode.Range(req.startLine - 1, 0, req.endLine - 1, 0);
    fileItem.children.add(child);
    requestById.set(id, { uri: fileItem.uri, request: req });
  }
}
