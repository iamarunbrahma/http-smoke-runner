import type { ParseDiagnostic } from '../types.ts';
import type { Block } from './httpDocumentParser.ts';

export interface IntermediateRequest {
  startLine: number;
  endLine: number;
  name: string;
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body: string | undefined;
  _rawExpects: Array<{ line: number; text: string }>;
  diagnostics: ParseDiagnostic[];
}

const METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s+(\S+)(?:\s+HTTP\/[\d.]+)?\s*$/;
const SEPARATOR = /^#{3,}(\s+(.*))?$/;
const NAME_DIRECTIVE = /^(?:#|\/\/)\s*@name\s+(\S+)/;
const HEADER_RE = /^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/;
const EXPECT_RE = /^#\s*expect\s+.+$/i;
const COMMENT_RE = /^(?:#|\/\/)/;
const FILE_VAR_RE = /^\s*@[A-Za-z_][\w-]*\s*=/;

export function parseRequestBlock(block: Block): IntermediateRequest | null {
  const diagnostics: ParseDiagnostic[] = [];
  const lines = block.text.split('\n');

  let label: string | null = null;
  let nameDirective: string | null = null;
  let method: string | null = null;
  let url: string | null = null;
  let requestLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sep = line.match(SEPARATOR);
    if (sep) {
      if (sep[2]) label = sep[2].trim();
      continue;
    }
    const name = line.match(NAME_DIRECTIVE);
    if (name) {
      nameDirective = name[1];
      continue;
    }
    if (line.trim() === '' || COMMENT_RE.test(line)) continue;

    const m = line.trim().match(METHOD_RE);
    if (m) {
      method = m[1];
      url = m[2];
      requestLineIdx = i;
      break;
    }

    if (FILE_VAR_RE.test(line)) return null;

    diagnostics.push({
      line: block.startLine + i,
      message: `expected METHOD URL, got "${line.trim()}"`,
      severity: 'error'
    });
    return null;
  }

  if (requestLineIdx < 0 || !method || !url) return null;

  const headers: Array<[string, string]> = [];
  const rawExpects: Array<{ line: number; text: string }> = [];
  let bodyStartIdx = -1;

  for (let i = requestLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      bodyStartIdx = i + 1;
      break;
    }
    if (EXPECT_RE.test(line)) {
      rawExpects.push({ line: block.startLine + i, text: line.trim() });
      continue;
    }
    if (COMMENT_RE.test(line)) continue;
    const h = line.match(HEADER_RE);
    if (h) {
      headers.push([h[1], h[2]]);
      continue;
    }
    bodyStartIdx = i;
    break;
  }

  let body: string | undefined;
  if (bodyStartIdx >= 0 && bodyStartIdx < lines.length) {
    const bodyLines: string[] = [];
    for (let i = bodyStartIdx; i < lines.length; i++) {
      const line = lines[i];
      if (EXPECT_RE.test(line)) {
        rawExpects.push({ line: block.startLine + i, text: line.trim() });
        continue;
      }
      bodyLines.push(line);
    }
    const joined = bodyLines.join('\n').trim();
    if (joined.length > 0) body = joined;
  }

  const name =
    nameDirective ?? (label && label.length > 0 ? label : `${method} ${urlPath(url)}`);

  return {
    startLine: block.startLine,
    endLine: block.endLine,
    name,
    method,
    url,
    headers,
    body,
    _rawExpects: rawExpects,
    diagnostics
  };
}

function urlPath(rawUrl: string): string {
  const m = rawUrl.match(/^[a-z][\w+.-]*:\/\/[^/]+(\/[^?#\s]*)?/i);
  return m?.[1] ?? rawUrl;
}
