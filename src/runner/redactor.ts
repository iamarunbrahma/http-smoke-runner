export const DEFAULT_REDACTED_HEADERS: readonly string[] = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'proxy-authorization'
];

export function redactHeaders(
  headers: ReadonlyArray<[string, string]>,
  redactList: ReadonlyArray<string> = DEFAULT_REDACTED_HEADERS
): Array<[string, string]> {
  const set = new Set(redactList.map(s => s.toLowerCase()));
  return headers.map(([name, value]) =>
    set.has(name.toLowerCase()) ? [name, mask(value)] : [name, value]
  );
}

function mask(_value: string): string {
  return '***';
}
