import { splitIntoBlocks } from './httpDocumentParser.ts';
import { parseRequestBlock } from './requestParser.ts';
import { parseExpectLine } from './expectParser.ts';
import { createResolver } from './variableResolver.ts';
import type { ParsedRequest, ParseDiagnostic } from '../types.ts';

export interface ParsedFile {
  fileVars: Record<string, string>;
  requests: ParsedRequest[];
  diagnostics: ParseDiagnostic[];
}

const CHAINING_RE = /\{\{\s*[A-Za-z_][\w-]*\.(?:response|request)\./;
const PROMPT_RE = /^(?:#|\/\/)\s*@prompt\b/;
const SETTING_RE = /^(?:#|\/\/)\s*@(?!name\b|prompt\b)[A-Za-z]+\b/;

export function parseHttpFile(rawText: string): ParsedFile {
  const { fileVars } = createResolver(rawText);
  const blocks = splitIntoBlocks(rawText);
  const requests: ParsedRequest[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  for (const block of blocks) {
    const lines = block.text.split('\n');

    lines.forEach((line, i) => {
      if (CHAINING_RE.test(line)) {
        diagnostics.push({
          line: block.startLine + i,
          message: 'chaining reference not supported in V1 — literal text will be sent',
          severity: 'warning'
        });
      }
      if (PROMPT_RE.test(line)) {
        diagnostics.push({
          line: block.startLine + i,
          message: '# @prompt is not supported in V1 — the variable will be unresolved',
          severity: 'warning'
        });
      }
      if (SETTING_RE.test(line)) {
        diagnostics.push({
          line: block.startLine + i,
          message: 'per-request settings (# @settingName) are not supported in V1 — ignored',
          severity: 'warning'
        });
      }
    });

    const inter = parseRequestBlock(block);
    if (!inter) continue;

    const expects = [];
    for (const raw of inter._rawExpects) {
      const pred = parseExpectLine(raw.text);
      if (pred) expects.push(pred);
      else
        diagnostics.push({
          line: raw.line,
          message: `unrecognized "# expect" line: ${raw.text}`,
          severity: 'warning'
        });
    }

    requests.push({
      startLine: inter.startLine,
      endLine: inter.endLine,
      name: inter.name,
      method: inter.method,
      url: inter.url,
      headers: inter.headers,
      body: inter.body,
      expects,
      diagnostics: inter.diagnostics
    });
  }

  return { fileVars, requests, diagnostics };
}
