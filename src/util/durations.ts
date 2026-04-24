const RE = /^\s*(\d+)\s*(ms|s)\s*$/i;

export function parseDurationMs(input: string): number | null {
  const m = input.match(RE);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase() === 's' ? n * 1000 : n;
}
