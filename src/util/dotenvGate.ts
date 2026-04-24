import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseDotenv } from './dotenv.ts';

type Choice = 'yes' | 'no' | 'never';
const STATE_KEY = 'httpSmokeRunner.loadDotenvChoice';

export async function maybeLoadDotenv(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): Promise<Record<string, string>> {
  const globalEnabled = vscode.workspace
    .getConfiguration('httpSmokeRunner')
    .get<boolean>('loadDotenv', true);
  if (!globalEnabled) return {};

  const envPath = path.join(workspaceRoot, '.env');
  try {
    await fs.access(envPath);
  } catch {
    return {};
  }

  let choice = context.workspaceState.get<Choice>(STATE_KEY);
  if (!choice) {
    const pick = await vscode.window.showInformationMessage(
      'HTTP Smoke Runner found a `.env` file. Load its values for `{{$dotenv ...}}` substitution in .http files?',
      { modal: true },
      'Yes, load it',
      'No, ignore',
      'Never ask again'
    );
    choice = pick === 'Yes, load it' ? 'yes' : pick === 'Never ask again' ? 'never' : 'no';
    await context.workspaceState.update(STATE_KEY, choice);
  }

  if (choice !== 'yes') return {};

  const text = await fs.readFile(envPath, 'utf-8');
  return parseDotenv(text);
}
