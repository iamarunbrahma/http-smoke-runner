import { evaluateJsonPath } from './jsonPath.ts';
import type { Predicate, FailureDetail } from '../types.ts';

const MAX_REGEX_INPUT_BYTES = 64 * 1024;

export interface ResponseSnapshot {
  status: number;
  /** Header names lowercased; multi-value headers joined by ", " per RFC. */
  headers: Map<string, string>;
  body: string;
  durationMs: number;
}

export interface EvaluationResult {
  ok: boolean;
  failures: FailureDetail[];
}

export function evaluatePredicates(
  snap: ResponseSnapshot,
  predicates: ReadonlyArray<Predicate>
): EvaluationResult {
  const failures: FailureDetail[] = [];
  let parsedJson: { ok: true; value: unknown } | { ok: false } | null = null;
  const ensureJson = () => {
    if (parsedJson !== null) return parsedJson;
    try {
      parsedJson = { ok: true, value: JSON.parse(snap.body) };
    } catch {
      parsedJson = { ok: false };
    }
    return parsedJson;
  };

  for (const p of predicates) {
    switch (p.kind) {
      case 'status': {
        if (p.op === 'eq') {
          if (snap.status !== p.code) {
            failures.push({
              summary: `expected status ${p.code}, got ${snap.status}`,
              expected: String(p.code),
              actual: String(snap.status),
              diffable: true
            });
          }
        } else {
          const decade = Math.floor(snap.status / 100);
          const want = Number(p.range[0]);
          if (decade !== want) {
            failures.push({
              summary: `expected status ${p.range}, got ${snap.status}`,
              expected: p.range,
              actual: String(snap.status),
              diffable: true
            });
          }
        }
        break;
      }
      case 'header': {
        const actual = snap.headers.get(p.name.toLowerCase());
        if (p.op === 'exists') {
          if (!actual) failures.push({ summary: `expected header "${p.name}" to exist`, diffable: false });
        } else if (p.op === 'equals') {
          if (actual !== p.value) {
            failures.push({
              summary: `expected header "${p.name}" = "${p.value}", got ${actual === undefined ? '<missing>' : `"${actual}"`}`,
              expected: p.value,
              actual: actual ?? '<missing>',
              diffable: true
            });
          }
        } else {
          if (actual === undefined || !actual.includes(p.value)) {
            failures.push({
              summary: `expected header "${p.name}" to contain "${p.value}", got ${actual === undefined ? '<missing>' : `"${actual}"`}`,
              diffable: false
            });
          }
        }
        break;
      }
      case 'body': {
        if (!snap.body.includes(p.value)) {
          failures.push({ summary: `expected body to contain "${p.value}"`, diffable: false });
        }
        break;
      }
      case 'bodyPath': {
        const parsed = ensureJson();
        if (!parsed || !parsed.ok) {
          failures.push({ summary: `body is not JSON`, diffable: false });
          break;
        }
        const { found, values } = evaluateJsonPath(parsed.value, p.path);
        if (p.op === 'exists') {
          if (!found) failures.push({ summary: `expected ${p.path} to exist`, diffable: false });
        } else if (p.op === 'equals') {
          if (!found) {
            failures.push({
              summary: `expected ${p.path} = ${JSON.stringify(p.value)}, path not found`,
              expected: JSON.stringify(p.value),
              actual: '<missing>',
              diffable: true
            });
          } else if (!values.some(v => deepEquals(v, p.value))) {
            failures.push({
              summary: `expected ${p.path} = ${JSON.stringify(p.value)}, got ${JSON.stringify(values[0])}`,
              expected: JSON.stringify(p.value),
              actual: JSON.stringify(values[0]),
              diffable: true
            });
          }
        } else {
          const any = values.some(
            v => typeof v === 'string' && p.pattern.test(capForRegex(v))
          );
          if (!any) {
            failures.push({
              summary: `expected ${p.path} to match ${p.pattern}, got ${JSON.stringify(values[0] ?? '<missing>')}`,
              diffable: false
            });
          }
        }
        break;
      }
      case 'time': {
        if (snap.durationMs >= p.ms) {
          failures.push({
            summary: `time budget exceeded: ${snap.durationMs}ms >= ${p.ms}ms`,
            diffable: false
          });
        }
        break;
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

function capForRegex(s: string): string {
  return s.length > MAX_REGEX_INPUT_BYTES ? s.slice(0, MAX_REGEX_INPUT_BYTES) : s;
}

function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
