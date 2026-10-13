// The runner as an HTTP server: each page's messages come up as POSTs, and everything for it goes down one stream of
// JSON lines, which the page reopens after a drop with the number of the last message it got. A chat per person and
// tenant, in memory; it keeps running while no page is connected.
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Runner } from '../../../runner/serve.js';
import type {
  MessageEndpoint,
  PageToRunner,
  RunnerToPage
} from '../../../protocol.js';
import { decode, encode } from './wire.js';

type Listener = (event: MessageEvent<PageToRunner>) => void;

interface Connection {
  user: string;
  tenant: string;
  listeners: Set<Listener>;
  close(): void;
}

export function runnerHandler(opts: {
  /** Yours: the signed-in person a request's credentials name, or `undefined` to answer 401. */
  authenticate(req: IncomingMessage): Promise<string | undefined>;
  /** A new chat of `user` with `tenant`, or `undefined` for a tenant there is none of (404). Called once per pair. */
  chat(user: string, tenant: string): Runner | undefined;
  /** The page origins that may call, for CORS. */
  origins: readonly string[];
}): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const chats = new Map<string, Runner>();
  const connections = new Map<string, Connection>();

  const chatOf = (user: string, tenant: string) => {
    const key = JSON.stringify([user, tenant]);
    let chat = chats.get(key);
    if (chat === undefined) {
      chat = opts.chat(user, tenant);
      if (chat !== undefined) chats.set(key, chat);
    }
    return chat;
  };

  const stream = (
    res: ServerResponse,
    user: string,
    tenant: string,
    chat: Runner,
    id: string,
    after: number | undefined
  ) => {
    connections.get(id)?.close();
    res.writeHead(200, {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-store'
    });
    res.flushHeaders();
    const listeners = new Set<Listener>();
    const page: MessageEndpoint<RunnerToPage, PageToRunner> = {
      postMessage: (message) => res.write(`${encode(message)}\n`),
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener)
    };
    const detach = chat.attach(page, after !== undefined ? { after } : {});
    const connection: Connection = {
      user,
      tenant,
      listeners,
      close: () => {
        detach();
        res.end();
        if (connections.get(id) === connection) connections.delete(id);
      }
    };
    connections.set(id, connection);
    res.on('close', connection.close);
  };

  return async (req, res) => {
    const origin = req.headers.origin;
    if (origin !== undefined && opts.origins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader(
        'access-control-allow-headers',
        'authorization, content-type'
      );
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      res.setHeader('vary', 'origin');
    }
    const url = new URL(req.url ?? '/', 'http://runner');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      return;
    }
    const tenant = url.searchParams.get('tenant') ?? '';
    const id = url.searchParams.get('connection') ?? '';
    const user = await opts.authenticate(req);
    if (user === undefined) {
      res.writeHead(401, { 'www-authenticate': 'Bearer' }).end();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/stream' && id !== '') {
      const held = connections.get(id);
      if (
        held !== undefined &&
        (held.user !== user || held.tenant !== tenant)
      ) {
        res.writeHead(409).end();
        return;
      }
      const chat = chatOf(user, tenant);
      if (chat === undefined) {
        res.writeHead(404).end();
        return;
      }
      const after = Number(url.searchParams.get('after') ?? NaN);
      stream(
        res,
        user,
        tenant,
        chat,
        id,
        Number.isFinite(after) ? after : undefined
      );
      return;
    }
    if (req.method === 'POST' && url.pathname === '/messages') {
      const connection = connections.get(id);
      // A connection id is no credential: another person's, or another tenant's, finds nothing.
      if (connection?.user !== user || connection.tenant !== tenant) {
        res.writeHead(404).end();
        return;
      }
      let message: PageToRunner;
      try {
        message = decode(await readText(req)) as PageToRunner;
      } catch {
        res.writeHead(400).end();
        return;
      }
      const event = new MessageEvent('message', { data: message });
      for (const listener of connection.listeners) listener(event);
      res.writeHead(204).end();
      return;
    }
    res.writeHead(404).end();
  };
}

async function readText(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
