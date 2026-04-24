export interface ParsedRequest {
  /** 1-based starting line of the ### block in the document. */
  startLine: number;
  /** 1-based ending line (inclusive). */
  endLine: number;
  /** Human-readable name: # @name, label after ###, or "METHOD path" fallback. */
  name: string;
  method: string;
  url: string;
  headers: Array<[string, string]>;
  body: string | undefined;
  expects: Predicate[];
  diagnostics: ParseDiagnostic[];
}

export type Predicate =
  | { kind: 'status'; op: 'eq'; code: number }
  | { kind: 'status'; op: 'range'; range: '2xx' | '3xx' | '4xx' | '5xx' }
  | { kind: 'header'; name: string; op: 'equals' | 'contains'; value: string }
  | { kind: 'header'; name: string; op: 'exists' }
  | { kind: 'body'; op: 'contains'; value: string }
  | { kind: 'bodyPath'; path: string; op: 'equals'; value: string | number | boolean | null }
  | { kind: 'bodyPath'; path: string; op: 'exists' }
  | { kind: 'bodyPath'; path: string; op: 'matches'; pattern: RegExp }
  | { kind: 'time'; op: 'lt'; ms: number };

export interface ParseDiagnostic {
  /** 1-based line in the document. */
  line: number;
  message: string;
  severity: 'warning' | 'error';
}

export interface FailureDetail {
  summary: string;
  expected?: string;
  actual?: string;
  diffable: boolean;
}

export interface RunResult {
  request: ParsedRequest;
  ok: boolean;
  durationMs: number;
  statusCode?: number;
  failures: FailureDetail[];
  transcript: string;
  errorMessage?: string;
}
