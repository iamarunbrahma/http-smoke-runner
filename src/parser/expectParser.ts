import type { Predicate } from '../types.ts';

const EXPECT_PREFIX = /^#\s*expect\s+/i;

const STATUS_EXACT = /^status\s+(\d{3})\s*$/i;
const STATUS_RANGE = /^status\s+([1-5]xx)\s*$/i;

const HEADER_EQ = /^header\s+(\S+)\s+equals\s+(.+)$/i;
const HEADER_CONT = /^header\s+(\S+)\s+contains\s+(.+)$/i;
const HEADER_EXISTS = /^header\s+(\S+)\s+exists\s*$/i;

const BODY_CONTAINS = /^body\s+contains\s+(.+)$/i;

const BODY_PATH_EQ = /^body\s+path\s+(\S+)\s+equals\s+(.+)$/i;
const BODY_PATH_EXISTS = /^body\s+path\s+(\S+)\s+exists\s*$/i;
const BODY_PATH_MATCH = /^body\s+path\s+(\S+)\s+matches\s+\/(.+)\/\s*$/i;

const TIME_LT = /^time\s*<\s*(\d+)\s*(ms|s)\s*$/i;

const MAX_REGEX_PATTERN_LEN = 256;

export function parseExpectLine(raw: string): Predicate | null {
  const rest = raw.replace(EXPECT_PREFIX, '').trim();
  let m: RegExpMatchArray | null;

  if ((m = rest.match(STATUS_EXACT))) {
    const code = Number(m[1]);
    if (!Number.isFinite(code)) return null;
    return { kind: 'status', op: 'eq', code };
  }
  if ((m = rest.match(STATUS_RANGE))) {
    const range = m[1].toLowerCase();
    if (range === '1xx') return null;
    return { kind: 'status', op: 'range', range: range as '2xx' | '3xx' | '4xx' | '5xx' };
  }

  if ((m = rest.match(HEADER_EXISTS))) {
    return { kind: 'header', name: m[1].toLowerCase(), op: 'exists' };
  }
  if ((m = rest.match(HEADER_EQ))) {
    return { kind: 'header', name: m[1].toLowerCase(), op: 'equals', value: stripQuotes(m[2].trim()) };
  }
  if ((m = rest.match(HEADER_CONT))) {
    return { kind: 'header', name: m[1].toLowerCase(), op: 'contains', value: stripQuotes(m[2].trim()) };
  }

  if ((m = rest.match(BODY_CONTAINS))) {
    return { kind: 'body', op: 'contains', value: stripQuotes(m[1].trim()) };
  }

  if ((m = rest.match(BODY_PATH_MATCH))) {
    const src = m[2];
    if (src.length > MAX_REGEX_PATTERN_LEN) return null;
    try {
      return { kind: 'bodyPath', path: m[1], op: 'matches', pattern: new RegExp(src) };
    } catch {
      return null;
    }
  }
  if ((m = rest.match(BODY_PATH_EXISTS))) {
    return { kind: 'bodyPath', path: m[1], op: 'exists' };
  }
  if ((m = rest.match(BODY_PATH_EQ))) {
    const v = parseLiteral(m[2].trim());
    if (v === undefined) return null;
    return { kind: 'bodyPath', path: m[1], op: 'equals', value: v };
  }

  if ((m = rest.match(TIME_LT))) {
    const n = Number(m[1]);
    const ms = m[2].toLowerCase() === 's' ? n * 1000 : n;
    return { kind: 'time', op: 'lt', ms };
  }

  return null;
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseLiteral(s: string): string | number | boolean | null | undefined {
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  const n = Number(s);
  if (Number.isFinite(n) && s.trim().length > 0) return n;
  return undefined;
}
