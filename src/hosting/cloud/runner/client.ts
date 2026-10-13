// The page's runner on the cloud hosting: a client of the runner server with `postMessage`'s shape. Messages go up as
// POSTs with the session's token; everything comes down one stream, reopened after a drop from the last numbered
// message it got, so nothing is missed or shown twice.

import type { GetToken } from '../../../../shared/src/page/token-requests.js';

import type {
  PageToRunner,
  RunnerEndpoint,
  RunnerInit,
  RunnerToPage
} from '../../../protocol.js';
import { decode, encode } from './wire.js';

type Listener = (event: MessageEvent<RunnerToPage>) => void;

/** `url`: the runner server. Sends `init` first; `stopped` hears once when the server stays unreachable. */
export function runnerClient(
  url: string,
  init: RunnerInit,
  getToken: GetToken,
  opts: { stopped(reason: string): void }
): RunnerEndpoint & { close(): void } {
  const base = url.replace(/\/+$/, '');
  const connection = crypto.randomUUID();
  const listeners = new Set<Listener>();
  const closing = new AbortController();
  let after: number | undefined;
  let opened!: Promise<void>;
  let open!: () => void;
  const closed = () => {
    opened = new Promise((resolve) => (open = resolve));
  };
  closed();
  const query = (extra: Record<string, string> = {}) =>
    new URLSearchParams({ tenant: init.tenant, connection, ...extra });
  const headers = async () => ({
    authorization: `Bearer ${await getToken()}`
  });

  const receive = (message: RunnerToPage) => {
    if ('seq' in message) after = message.seq;
    const event = new MessageEvent('message', { data: message });
    for (const listener of listeners) listener(event);
  };

  const listen = async () => {
    let failures = 0;
    while (!closing.signal.aborted) {
      try {
        const cursor: Record<string, string> =
          after !== undefined ? { after: String(after) } : {};
        const response = await fetch(`${base}/stream?${query(cursor)}`, {
          headers: await headers(),
          signal: closing.signal
        });
        if (!response.ok || response.body === null) {
          throw new Error(`the runner answered ${response.status}`);
        }
        failures = 0;
        open();
        const lines = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await lines.read();
          if (done) break;
          buffer += value;
          const complete = buffer.split('\n');
          buffer = complete.pop() ?? '';
          for (const line of complete) {
            if (line !== '') receive(decode(line) as RunnerToPage);
          }
        }
      } catch (error) {
        if (closing.signal.aborted) return;
        failures += 1;
        if (failures === 3) {
          opts.stopped(
            `the runner at ${base} does not answer: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      closed();
      await new Promise((r) => setTimeout(r, Math.min(failures, 5) * 1_000));
    }
  };

  const send = async (message: PageToRunner) => {
    for (;;) {
      await opened;
      if (closing.signal.aborted) return;
      const response = await fetch(`${base}/messages?${query()}`, {
        method: 'POST',
        headers: { ...(await headers()), 'content-type': 'application/json' },
        body: encode(message),
        signal: closing.signal
      }).catch(() => undefined);
      // Read to the end, or the browser reports the request as aborted.
      await response?.arrayBuffer().catch(() => undefined);
      // The stream dropped on the server's side first: send again once it is back.
      if (response?.status === 404 || response === undefined) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      return;
    }
  };

  let sending: Promise<void> = Promise.resolve();
  const postMessage = (message: PageToRunner) => {
    sending = sending.then(() => send(message)).catch(() => undefined);
  };

  void listen();
  postMessage({ type: 'init', init });
  return {
    postMessage,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    close: () => closing.abort()
  };
}
