import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSmoke } from './smokeRunner.ts';
import { startTestServer } from '../../test/fixtures/testServer.ts';
import type { ParsedRequest } from '../types.ts';

test('runs a GET, assertions pass, durationMs set', async () => {
  const srv = await startTestServer();
  try {
    const req: ParsedRequest = {
      startLine: 1,
      endLine: 2,
      name: 'health',
      method: 'GET',
      url: `http://127.0.0.1:${srv.port}/health`,
      headers: [],
      body: undefined,
      expects: [
        { kind: 'status', op: 'eq', code: 200 },
        { kind: 'body', op: 'contains', value: 'ok' }
      ],
      diagnostics: []
    };
    const results = await runSmoke([req], { requestTimeoutMs: 5000 });
    assert.equal(results.length, 1);
    assert.equal(results[0].ok, true);
    assert.equal(results[0].statusCode, 200);
    assert.ok(results[0].durationMs >= 0);
  } finally {
    await srv.stop();
  }
});

test('runs a POST with JSON body and sees 201', async () => {
  const srv = await startTestServer();
  try {
    const req: ParsedRequest = {
      startLine: 1,
      endLine: 5,
      name: 'create',
      method: 'POST',
      url: `http://127.0.0.1:${srv.port}/users`,
      headers: [['Content-Type', 'application/json']],
      body: '{"name":"Ada"}',
      expects: [
        { kind: 'status', op: 'eq', code: 201 },
        { kind: 'bodyPath', path: '$.name', op: 'equals', value: 'Ada' }
      ],
      diagnostics: []
    };
    const results = await runSmoke([req], { requestTimeoutMs: 5000 });
    assert.equal(results[0].ok, true);
  } finally {
    await srv.stop();
  }
});

test('failing assertion produces FailureDetail', async () => {
  const srv = await startTestServer();
  try {
    const req: ParsedRequest = {
      startLine: 1,
      endLine: 2,
      name: 'boom',
      method: 'POST',
      url: `http://127.0.0.1:${srv.port}/users`,
      headers: [['Content-Type', 'application/json'], ['X-Fail', '1']],
      body: '{}',
      expects: [{ kind: 'status', op: 'eq', code: 201 }],
      diagnostics: []
    };
    const [r] = await runSmoke([req], { requestTimeoutMs: 5000 });
    assert.equal(r.ok, false);
    assert.equal(r.statusCode, 500);
    assert.equal(r.failures[0].expected, '201');
  } finally {
    await srv.stop();
  }
});

test('cancellation aborts in-flight request', async () => {
  const srv = await startTestServer();
  try {
    const ac = new AbortController();
    const req: ParsedRequest = {
      startLine: 1,
      endLine: 2,
      name: 'slow',
      method: 'GET',
      url: `http://127.0.0.1:${srv.port}/slow`,
      headers: [],
      body: undefined,
      expects: [],
      diagnostics: []
    };
    const p = runSmoke([req], { requestTimeoutMs: 5000, signal: ac.signal });
    setTimeout(() => ac.abort(), 30);
    const [r] = await p;
    assert.equal(r.ok, false);
    assert.ok(r.errorMessage && /abort|cancel/i.test(r.errorMessage));
  } finally {
    await srv.stop();
  }
});

test('per-request timeout trips', async () => {
  const srv = await startTestServer();
  try {
    const req: ParsedRequest = {
      startLine: 1,
      endLine: 2,
      name: 'slow',
      method: 'GET',
      url: `http://127.0.0.1:${srv.port}/slow`,
      headers: [],
      body: undefined,
      expects: [],
      diagnostics: []
    };
    const [r] = await runSmoke([req], { requestTimeoutMs: 50 });
    assert.equal(r.ok, false);
    assert.match(r.errorMessage ?? '', /timeout/i);
  } finally {
    await srv.stop();
  }
});
