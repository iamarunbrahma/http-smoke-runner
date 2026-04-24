import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRequestBlock } from './requestParser.ts';

const block = (text: string, startLine = 1) => ({
  startLine,
  endLine: startLine + text.split('\n').length - 1,
  text
});

test('parses simple GET with label after ###', () => {
  const r = parseRequestBlock(block('### health\nGET http://x/health'));
  assert.equal(r?.name, 'health');
  assert.equal(r?.method, 'GET');
  assert.equal(r?.url, 'http://x/health');
  assert.deepEqual(r?.headers, []);
  assert.equal(r?.body, undefined);
});

test('parses # @name directive', () => {
  const r = parseRequestBlock(block('###\n# @name listUsers\nGET http://x/users'));
  assert.equal(r?.name, 'listUsers');
});

test('@name takes precedence over label', () => {
  const r = parseRequestBlock(block('### fromLabel\n# @name fromDirective\nGET http://x/'));
  assert.equal(r?.name, 'fromDirective');
});

test('fallback name is METHOD path', () => {
  const r = parseRequestBlock(block('###\nGET http://x/abc/def?q=1'));
  assert.equal(r?.name, 'GET /abc/def');
});

test('parses headers and body', () => {
  const r = parseRequestBlock(
    block(
      [
        '### create',
        'POST http://x/users',
        'Content-Type: application/json',
        'X-Req: abc',
        '',
        '{"name":"Ada"}'
      ].join('\n')
    )
  );
  assert.equal(r?.method, 'POST');
  assert.deepEqual(r?.headers, [
    ['Content-Type', 'application/json'],
    ['X-Req', 'abc']
  ]);
  assert.equal(r?.body, '{"name":"Ada"}');
});

test('strips HTTP-Version from request line', () => {
  const r = parseRequestBlock(block('### a\nGET http://x HTTP/1.1'));
  assert.equal(r?.url, 'http://x');
});

test('collects # expect lines as raw strings', () => {
  const r = parseRequestBlock(
    block(['### a', 'GET http://x', '# expect status 200', '# expect body contains "ok"'].join('\n'))
  );
  assert.equal(r?._rawExpects.length, 2);
  assert.equal(r?._rawExpects[0].text, '# expect status 200');
  assert.equal(r?._rawExpects[0].line, 3);
});

test('file-vars block (no request line) returns null', () => {
  const r = parseRequestBlock(block('@baseUrl = http://x\n@token = abc'));
  assert.equal(r, null);
});

test('malformed request (no method) returns null', () => {
  const r = parseRequestBlock(block('### bad\nnot-a-http-verb-here'));
  assert.equal(r, null);
});
