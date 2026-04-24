import { evaluatePredicates, type ResponseSnapshot } from './assertionEngine.ts';
import { redactHeaders, DEFAULT_REDACTED_HEADERS } from './redactor.ts';
import type { ParsedRequest, RunResult } from '../types.ts';

export interface RunOptions {
  requestTimeoutMs: number;
  signal?: AbortSignal;
  redactedHeaders?: ReadonlyArray<string>;
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

export async function runSmoke(
  requests: ReadonlyArray<ParsedRequest>,
  opts: RunOptions
): Promise<RunResult[]> {
  const results: RunResult[] = [];
  const redacted = opts.redactedHeaders ?? DEFAULT_REDACTED_HEADERS;
  const maxBytes = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  for (const req of requests) {
    if (opts.signal?.aborted) {
      results.push(errorResult(req, 'cancelled'));
      continue;
    }
    results.push(await runOne(req, opts.requestTimeoutMs, opts.signal, redacted, maxBytes));
  }
  return results;
}

async function runOne(
  req: ParsedRequest,
  timeoutMs: number,
  externalSignal: AbortSignal | undefined,
  redactedHeaderList: ReadonlyArray<string>,
  maxBytes: number
): Promise<RunResult> {
  const ac = new AbortController();
  const onExternalAbort = (): void => ac.abort(externalSignal?.reason ?? 'cancelled');

  if (externalSignal) {
    if (externalSignal.aborted) ac.abort(externalSignal.reason ?? 'cancelled');
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timeout = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);

  const start = Date.now();
  let status = 0;
  const responseHeaders: Array<[string, string]> = [];
  let bodyText = '';

  try {
    const init: RequestInit = {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: ac.signal
    };
    const res = await fetch(req.url, init);
    status = res.status;
    for (const [k, v] of res.headers) responseHeaders.push([k, v]);

    const reader = res.body?.getReader();
    if (reader) {
      let received = 0;
      const chunks: Uint8Array[] = [];
      let truncated = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
          truncated = true;
          break;
        }
        chunks.push(value);
      }
      bodyText = new TextDecoder('utf-8', { fatal: false }).decode(concatBytes(chunks));
      if (truncated) bodyText += `\n...[response truncated at ${maxBytes} bytes]`;
    }

    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);

    const durationMs = Date.now() - start;
    const headerMap = new Map(responseHeaders.map(([k, v]) => [k.toLowerCase(), v]));
    const snap: ResponseSnapshot = { status, headers: headerMap, body: bodyText, durationMs };
    const { ok, failures } = evaluatePredicates(snap, req.expects);

    const transcript = formatTranscript(req, status, responseHeaders, bodyText, redactedHeaderList);

    return {
      request: req,
      ok,
      durationMs,
      statusCode: status,
      failures,
      transcript
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);
    const durationMs = Date.now() - start;
    const message = classifyError(err);
    return {
      request: req,
      ok: false,
      durationMs,
      failures: [],
      transcript: `# ${req.method} ${req.url}\n# ERROR: ${message}\n`,
      errorMessage: message
    };
  }
}

function classifyError(err: unknown): string {
  const e = err as { cause?: { message?: string }; name?: string; message?: string };
  const msg = String(e?.message ?? err ?? '');
  if (e?.cause?.message === 'timeout' || /timeout/i.test(msg)) return 'timeout';
  if (e?.name === 'AbortError' || /abort/i.test(msg)) return 'cancelled';
  return msg || 'unknown error';
}

function errorResult(req: ParsedRequest, message: string): RunResult {
  return {
    request: req,
    ok: false,
    durationMs: 0,
    failures: [],
    transcript: `# ${req.method} ${req.url}\n# SKIPPED: ${message}\n`,
    errorMessage: message
  };
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((a, c) => a + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function formatTranscript(
  req: ParsedRequest,
  status: number,
  resHeaders: Array<[string, string]>,
  body: string,
  redactedHeaderList: ReadonlyArray<string>
): string {
  const redReq = redactHeaders(req.headers, redactedHeaderList);
  const redRes = redactHeaders(resHeaders, redactedHeaderList);
  const lines: string[] = [];
  lines.push(`> ${req.method} ${req.url}`);
  for (const [k, v] of redReq) lines.push(`> ${k}: ${v}`);
  if (req.body) {
    lines.push('');
    lines.push(req.body);
    lines.push('');
  }
  lines.push(`< HTTP ${status}`);
  for (const [k, v] of redRes) lines.push(`< ${k}: ${v}`);
  lines.push('');
  lines.push(body);
  return lines.join('\r\n') + '\r\n';
}
