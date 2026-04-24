import { randomUUID } from 'node:crypto';

export interface ResolveContext {
  fileVars: Record<string, string>;
  processEnv?: Record<string, string | undefined>;
  dotenv?: Record<string, string>;
}

export interface ResolveResult {
  text: string;
  unresolved: string[];
}

const TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function resolveVariables(input: string, ctx: ResolveContext): ResolveResult {
  const unresolved: string[] = [];
  const text = resolveLoop(input, ctx, unresolved, new Set(), 0);
  return { text, unresolved };
}

function resolveLoop(
  input: string,
  ctx: ResolveContext,
  unresolved: string[],
  seen: Set<string>,
  depth: number
): string {
  if (depth > 16) return input;
  return input.replace(TOKEN_RE, (match, raw: string) => {
    const token = raw.trim();
    const v = resolveOne(token, ctx);
    if (v === undefined) {
      if (!unresolved.includes(token)) unresolved.push(token);
      return match;
    }
    if (v.includes('{{')) {
      if (seen.has(token)) return match;
      seen.add(token);
      const nested = resolveLoop(v, ctx, unresolved, seen, depth + 1);
      seen.delete(token);
      return nested;
    }
    return v;
  });
}

function resolveOne(token: string, ctx: ResolveContext): string | undefined {
  if (!token.startsWith('$')) {
    return ctx.fileVars[token];
  }
  const parts = token.split(/\s+/);
  const head = parts[0];
  const rest = parts.slice(1);

  switch (head) {
    case '$guid':
    case '$uuid':
      return randomUUID();
    case '$randomInt': {
      const min = Number(rest[0] ?? 0);
      const max = Number(rest[1] ?? 1000);
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return '0';
      return String(min + Math.floor(Math.random() * (max - min)));
    }
    case '$timestamp': {
      let base = Math.floor(Date.now() / 1000);
      if (rest.length >= 2) base = applyOffset(base, rest);
      return String(base);
    }
    case '$datetime':
    case '$localDatetime': {
      const local = head === '$localDatetime';
      const format = (rest[0] ?? 'iso8601').toLowerCase();
      let ms = Date.now();
      if (rest.length >= 3) ms = applyOffset(Math.floor(ms / 1000), rest.slice(1)) * 1000;
      const d = new Date(ms);
      if (format === 'rfc1123') return d.toUTCString();
      return local ? toLocalIso(d) : d.toISOString();
    }
    case '$processEnv': {
      const key = rest.join(' ');
      return ctx.processEnv?.[key];
    }
    case '$dotenv': {
      const key = rest.join(' ');
      return ctx.dotenv?.[key];
    }
    default:
      return undefined;
  }
}

function applyOffset(baseSec: number, tokens: string[]): number {
  const n = Number(tokens[0]);
  const unit = (tokens[1] ?? '').toLowerCase();
  if (!Number.isFinite(n)) return baseSec;
  const scale =
    unit === 's'  ? 1 :
    unit === 'm'  ? 60 :
    unit === 'h'  ? 3600 :
    unit === 'd'  ? 86400 :
    unit === 'w'  ? 604800 :
    unit === 'ms' ? 0.001 : 1;
  return Math.floor(baseSec + n * scale);
}

function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function createResolver(rawText: string): { fileVars: Record<string, string> } {
  const fileVars: Record<string, string> = {};
  const re = /^\s*@([A-Za-z_][\w-]*)\s*=\s*(.+?)\s*$/;
  for (const line of rawText.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(re);
    if (m) fileVars[m[1]] = m[2];
  }
  return { fileVars };
}
