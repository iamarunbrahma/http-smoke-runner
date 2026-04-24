import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface TestServer {
  server: Server;
  port: number;
  stop(): Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/health' && req.method === 'GET') {
      res.setHeader('content-type', 'text/plain');
      res.statusCode = 200;
      res.end('ok');
      return;
    }
    if (url.pathname === '/users' && req.method === 'GET') {
      res.setHeader('content-type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify([{ id: 1 }, { id: 2 }]));
      return;
    }
    if (url.pathname === '/users' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        if (req.headers['x-fail'] === '1') {
          res.setHeader('content-type', 'application/json');
          res.statusCode = 500;
          res.end('{"error":"boom"}');
          return;
        }
        const payload = body ? JSON.parse(body) : {};
        res.setHeader('content-type', 'application/json');
        res.statusCode = 201;
        res.end(JSON.stringify({ id: 42, ...payload }));
      });
      return;
    }
    if (url.pathname === '/slow' && req.method === 'GET') {
      setTimeout(() => {
        res.statusCode = 200;
        res.end('slow');
      }, 200);
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    server,
    port,
    stop: () =>
      new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())))
  };
}
