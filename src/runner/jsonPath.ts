export interface JsonPathResult {
  found: boolean;
  values: unknown[];
}

type Tok =
  | { type: 'prop'; name: string }
  | { type: 'index'; index: number }
  | { type: 'recProp'; name: string };

export function evaluateJsonPath(root: unknown, path: string): JsonPathResult {
  if (!path.startsWith('$')) return { found: false, values: [] };

  const tokens = tokenize(path.slice(1));
  let contexts: unknown[] = [root];

  for (const tok of tokens) {
    const next: unknown[] = [];
    for (const ctx of contexts) {
      if (tok.type === 'prop') {
        if (ctx && typeof ctx === 'object' && !Array.isArray(ctx) &&
            Object.prototype.hasOwnProperty.call(ctx, tok.name)) {
          next.push((ctx as Record<string, unknown>)[tok.name]);
        }
      } else if (tok.type === 'index') {
        if (Array.isArray(ctx) && tok.index >= 0 && tok.index < ctx.length) {
          next.push(ctx[tok.index]);
        }
      } else {
        collectRecursive(ctx, tok.name, next);
      }
    }
    contexts = next;
    if (contexts.length === 0) return { found: false, values: [] };
  }

  return { found: contexts.length > 0, values: contexts };
}

function tokenize(rest: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === '.' && rest[i + 1] === '.') {
      i += 2;
      const start = i;
      while (i < rest.length && /[A-Za-z0-9_]/.test(rest[i])) i++;
      toks.push({ type: 'recProp', name: rest.slice(start, i) });
    } else if (ch === '.') {
      i++;
      const start = i;
      while (i < rest.length && /[A-Za-z0-9_]/.test(rest[i])) i++;
      toks.push({ type: 'prop', name: rest.slice(start, i) });
    } else if (ch === '[') {
      const end = rest.indexOf(']', i);
      if (end < 0) throw new Error('unclosed [');
      const inner = rest.slice(i + 1, end).trim();
      const idx = Number(inner);
      if (!Number.isInteger(idx)) throw new Error(`non-integer index: ${inner}`);
      toks.push({ type: 'index', index: idx });
      i = end + 1;
    } else {
      i++;
    }
  }
  return toks;
}

function collectRecursive(ctx: unknown, name: string, out: unknown[]): void {
  if (ctx === null || typeof ctx !== 'object') return;
  if (Array.isArray(ctx)) {
    for (const item of ctx) collectRecursive(item, name, out);
    return;
  }
  const obj = ctx as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, name)) out.push(obj[name]);
  for (const key of Object.keys(obj)) collectRecursive(obj[key], name, out);
}
