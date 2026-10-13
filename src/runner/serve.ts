// The runner's message loop: init, prompts, token requests, and the designs home's requests. One chat's state and its
// event log; a page attaches to it on every reconnect, and so does every tab that opens the chat. Plumbing;
// `assistant.ts` is the wiring.

import type { DesignAgent } from '../../shared/src/runner/agent.js';
import { historyEvents } from '../../shared/src/runner/events.js';
import { DEFAULT_MODEL_ID } from '../../shared/src/runner/model.js';
import {
  createTokenClient,
  type TokenEndpoint
} from '../../shared/src/runner/token-client.js';

import type {
  AgentEvent,
  MessageEndpoint,
  PageToRunner,
  RunnerInit,
  RunnerToPage,
  TurnReport
} from '../protocol.js';
import { eventLog } from './event-log.js';
import type { OpenSession, RunnerSession } from './session.js';

type Page = MessageEndpoint<RunnerToPage, PageToRunner>;

export interface Runner {
  /**
   * Connects a page: it receives `ready`, then the chat's logged messages after `after` (all of them without it), then
   * what follows. Answers go to the page that asked. Returns the disconnect.
   */
  attach(page: Page, opts?: { after?: number }): () => void;
}

export function createRunner(opts: { openSession: OpenSession }): Runner {
  const log = eventLog();
  const pages = new Set<Page>();
  // Token requests go to the page attached last; its responses come back through `handle`.
  let latest: Page | undefined;
  const tokenListeners: Parameters<TokenEndpoint['addEventListener']>[1][] = [];
  const tokens = createTokenClient({
    postMessage: (request) => latest?.postMessage(request),
    addEventListener: (_type, listener) => tokenListeners.push(listener)
  });
  let session: Promise<RunnerSession> | undefined;
  let agent: Promise<DesignAgent> | undefined;
  let running = false;
  let current: Promise<void> | undefined;
  let turn = '';
  let started: RunnerInit | undefined;

  type Unlogged = Parameters<typeof log.append>[0];
  const kept = async (event: AgentEvent): Promise<AgentEvent> => {
    const keep =
      event.type === 'preview' ? (await session)?.keepPreview : undefined;
    if (event.type !== 'preview' || keep === undefined) return event;
    try {
      return { ...event, uri: await keep(event.uri) };
    } catch (error) {
      console.warn(`a preview was not kept: ${errorText(error)}`);
      return event;
    }
  };
  const linked = async (message: Unlogged): Promise<Unlogged> => {
    if (message.type === 'event') {
      return { ...message, event: await kept(message.event) };
    }
    if (message.type === 'history') {
      return {
        ...message,
        events: await Promise.all(message.events.map(kept))
      };
    }
    return message;
  };
  // In order, each preview first kept where the hosting keeps them.
  let publishing: Promise<void> = Promise.resolve();
  const publish = (message: Unlogged) => {
    publishing = publishing.then(async () => {
      const logged = log.append(await linked(message));
      for (const page of pages) page.postMessage(logged);
    });
  };

  const designAgent = (
    s: RunnerSession,
    init: RunnerInit,
    messages: readonly unknown[]
  ) =>
    s.agent({
      model: init.model ?? DEFAULT_MODEL_ID,
      messages,
      onEvent: (event) => publish({ type: 'event', turn, event })
    });

  const start = (init: RunnerInit) => {
    started = init;
    session = opts.openSession({
      init,
      // Each token is the page's fresh one, so a forced refresh needs nothing more.
      bearer: () => tokens.token(),
      deliver: ({ name, mimeType, ...file }) =>
        publish({
          type: 'file',
          turn,
          name,
          mimeType,
          ...('url' in file
            ? { url: file.url }
            : { bytes: file.bytes.slice().buffer })
        })
    });
    agent = session.then(async (s) => {
      const messages = await s.history.load();
      publish({ type: 'history', events: historyEvents(messages) });
      return designAgent(s, init, messages);
    });
    // Awaited by each prompt, which reports the failure; this only keeps it from going unhandled.
    agent.catch(() => undefined);
  };

  const endTurn = (turn: string, report: TurnReport) =>
    publish({ type: 'turn.end', turn, report });
  const refuse = (turn: string, error: string) => {
    publish({ type: 'event', turn, event: { type: 'error', message: error } });
    endTurn(turn, { text: '', toolCalls: 0, costUsd: 0, error });
  };
  const ready = (): Promise<RunnerSession> =>
    session ?? Promise.reject(new Error('send init first'));

  const handle = async (message: PageToRunner, page: Page): Promise<void> => {
    const failed = (id: string, error: unknown) =>
      page.postMessage({ type: 'design.failed', id, error: errorText(error) });
    switch (message.type) {
      case 'init':
        if (session === undefined) start(message.init);
        return;
      case 'prompt': {
        publish({
          type: 'event',
          turn: message.turn,
          event: { type: 'user', text: message.text }
        });
        if (agent === undefined) return refuse(message.turn, 'send init first');
        if (running)
          return refuse(message.turn, 'the previous turn is still running');
        running = true;
        turn = message.turn;
        const turnAgent = agent;
        current = (async () => {
          try {
            const a = await turnAgent;
            const report = await a.prompt(message.text, message.model);
            await (await ready()).history.save(a.messages());
            endTurn(message.turn, report);
          } catch (error) {
            refuse(message.turn, errorText(error));
          } finally {
            running = false;
          }
        })();
        return current;
      }
      case 'chat.clear':
        try {
          // A running turn stops first, so its save cannot land after the clear.
          if (running) {
            void agent?.then((a) => a.abort());
            await current;
          }
          const s = await ready();
          await s.history.save([]);
          if (started !== undefined) {
            const init = started;
            agent = Promise.resolve(designAgent(s, init, []));
          }
          await publishing;
          log.clear();
          publish({ type: 'chat.cleared', id: message.id });
        } catch (error) {
          failed(message.id, error);
        }
        return;
      case 'abort':
        void agent?.then((a) => a.abort());
        return;
      case 'designs.list':
        try {
          const designs = await (await ready()).designs();
          page.postMessage({ type: 'designs', id: message.id, designs });
        } catch (error) {
          failed(message.id, error);
        }
        return;
      case 'design.thumbnail':
        try {
          const thumb = await (
            await ready()
          ).thumbnail(message.design, message.version);
          const head = {
            type: 'design.thumbnail' as const,
            id: message.id,
            design: message.design,
            version: message.version,
            size: thumb.size
          };
          if ('url' in thumb) {
            page.postMessage({ ...head, url: thumb.url });
          } else {
            const png = thumb.png.slice().buffer;
            page.postMessage({ ...head, png }, [png]);
          }
        } catch (error) {
          failed(message.id, error);
        }
        return;
      case 'design.export':
        try {
          const file = await (
            await ready()
          ).export(message.design, message.format, message.name);
          if ('url' in file) {
            page.postMessage({
              type: 'design.file',
              id: message.id,
              url: file.url
            });
          } else {
            const bytes = file.bytes.slice().buffer;
            page.postMessage({ type: 'design.file', id: message.id, bytes }, [
              bytes
            ]);
          }
        } catch (error) {
          failed(message.id, error);
        }
        return;
      case 'design.upload':
        try {
          const design = await (
            await ready()
          ).upload(new Uint8Array(message.bytes), message.name);
          page.postMessage({ type: 'design.loaded', id: message.id, design });
        } catch (error) {
          failed(message.id, error);
        }
        return;
      case 'image.upload':
        try {
          const asset = await (
            await ready()
          ).keepImage(
            new File([message.bytes], message.name, { type: message.mimeType })
          );
          page.postMessage({ type: 'image.kept', id: message.id, asset });
        } catch (error) {
          failed(message.id, error);
        }
        return;
      case 'design.read':
        try {
          const stored = await (await ready()).read(message.design);
          if (stored === undefined) {
            throw new Error(`no design ${message.design}`);
          }
          if ('uri' in stored.content) {
            throw new Error('a design stored by URL does not open here');
          }
          const head = {
            type: 'design.content' as const,
            id: message.id,
            design: message.design,
            version: stored.version,
            cesdkVersion: stored.cesdkVersion
          };
          if (stored.content.archive !== undefined) {
            const archive = stored.content.archive.slice().buffer;
            page.postMessage({ ...head, archive }, [archive]);
          } else {
            page.postMessage({ ...head, scene: stored.content.scene });
          }
        } catch (error) {
          failed(message.id, error);
        }
        return;
      case 'design.save':
        try {
          const version = await (
            await ready()
          ).save(
            message.design,
            'archive' in message
              ? { archive: new Uint8Array(message.archive) }
              : { scene: message.scene },
            { ifMatch: message.ifMatch, cesdkVersion: message.cesdkVersion }
          );
          page.postMessage({
            type: 'design.saved',
            id: message.id,
            design: message.design,
            version: version ?? null
          });
        } catch (error) {
          failed(message.id, error);
        }
        return;
      case 'token.response':
        return;
    }
  };

  return {
    attach(page, { after } = {}) {
      const listener = (event: MessageEvent<PageToRunner>) => {
        if (event.data.type === 'token.response') {
          for (const l of tokenListeners) l(event);
          return;
        }
        void handle(event.data, page);
      };
      page.addEventListener('message', listener);
      pages.add(page);
      latest = page;
      page.postMessage({ type: 'ready' });
      for (const message of log.since(after)) page.postMessage(message);
      return () => {
        page.removeEventListener('message', listener);
        pages.delete(page);
        if (latest === page) latest = [...pages].at(-1);
      };
    }
  };
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
