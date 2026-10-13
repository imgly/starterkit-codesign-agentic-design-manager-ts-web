// The chat: the person's prompts, and per turn one muted line of steps, the last render of each design, and the replies.

import type { AgentEvent } from '../protocol.js';
import { markdownHTML } from './markdown.js';
import { stepVerb, turnSummary } from './steps.js';

export interface ChatView {
  user(text: string): void;
  /** A line from the product, not the model, with an optional link. */
  notice(text: string, link?: { href: string; text: string }): void;
  event(event: AgentEvent): void;
  error(message: string): void;
  /** A file the agent made for the person: a link to it in this turn, a download when `url` is the page's own. */
  file(name: string, url: string): void;
  /** The turn is over: its running line goes. */
  endTurn(): void;
  clear(): void;
}

interface Turn {
  item: HTMLLIElement;
  steps: HTMLDetailsElement;
  trace: HTMLOListElement;
  status: HTMLDivElement;
  previews: HTMLDivElement;
  calls: Array<{ tool: string; args: unknown; row: HTMLLIElement }>;
  done: number;
  designs: Map<string, string>;
  shown: Map<string, HTMLButtonElement>;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = ''
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  return node;
};

export function chatView(
  log: HTMLOListElement,
  opts: {
    /** A design's title, when the designs home knows it. */
    titleOf: (design: string) => string | undefined;
    /** Opens a design as the grid does. */
    open: (design: string) => void;
    /** The chat went from empty to not, or back. */
    onEmpty: (empty: boolean) => void;
  }
): ChatView {
  let turn: Turn | undefined;
  const scroll = () => {
    log.scrollTop = log.scrollHeight;
  };
  const add = (className: string): HTMLLIElement => {
    const item = el('li', className);
    log.append(item);
    opts.onEmpty(false);
    scroll();
    return item;
  };

  const startTurn = (): Turn => {
    const item = add('turn');
    const steps = el('details', 'steps');
    steps.hidden = true;
    const summary = el('summary');
    const trace = el('ol');
    steps.append(summary, trace);
    const status = el('div', 'status');
    status.hidden = true;
    const previews = el('div', 'previews');
    item.append(steps, status, previews);
    turn = {
      item,
      steps,
      trace,
      status,
      previews,
      calls: [],
      done: 0,
      designs: new Map(),
      shown: new Map()
    };
    return turn;
  };
  const current = () => turn ?? startTurn();

  const designOf = (args: unknown): string | undefined => {
    const a = (args ?? {}) as { design?: unknown; title?: unknown };
    return typeof a.design === 'string' ? a.design : undefined;
  };
  const nameOf = (t: Turn, args: unknown): string | undefined => {
    const a = (args ?? {}) as { title?: unknown };
    const design = designOf(args);
    if (design !== undefined)
      return opts.titleOf(design) ?? t.designs.get(design);
    return typeof a.title === 'string' ? a.title : undefined;
  };
  const summarise = (t: Turn) => {
    const names = [...new Set(t.calls.map((c) => nameOf(t, c.args)))].filter(
      (n): n is string => n !== undefined
    );
    (t.steps.firstChild as HTMLElement).textContent = turnSummary(
      t.calls.length,
      names
    );
  };

  return {
    user(value) {
      this.endTurn();
      turn = undefined;
      add('user').textContent = value;
    },
    error(message) {
      const item = el('div', 'error');
      item.textContent = message;
      current().item.append(item);
      scroll();
    },
    notice(value, link) {
      const item = el('div', 'notice');
      item.append(value);
      if (link !== undefined) {
        const a = Object.assign(el('a'), {
          href: link.href,
          target: '_blank',
          rel: 'noopener',
          textContent: link.text
        });
        item.append(' ', a);
      }
      current().item.append(item);
      scroll();
    },
    file(name, url) {
      const link = Object.assign(el('a', 'file'), {
        href: url,
        download: name,
        target: '_blank',
        rel: 'noopener',
        textContent: `Download ${name}`
      });
      current().item.append(link);
      scroll();
    },
    endTurn() {
      if (turn !== undefined) turn.status.hidden = true;
    },
    clear() {
      turn = undefined;
      log.replaceChildren();
      opts.onEmpty(true);
    },
    event(event) {
      if (event.type === 'user') {
        this.user(event.text);
        return;
      }
      const t = current();
      switch (event.type) {
        case 'message': {
          const reply = el('div', 'reply markdown');
          reply.innerHTML = markdownHTML(event.text);
          t.item.append(reply);
          scroll();
          return;
        }
        case 'error':
          this.error(event.message);
          return;
        case 'thinking': {
          const row = el('li', 'thinking');
          row.textContent = event.text;
          t.trace.append(row);
          return;
        }
        case 'tool_call': {
          const row = el('li');
          row.textContent = stepVerb(event.tool, event.args, 'running');
          t.trace.append(row);
          t.calls.push({ tool: event.tool, args: event.args, row });
          t.steps.hidden = false;
          summarise(t);
          t.status.replaceChildren(
            Object.assign(el('span', 'spinner'), { ariaHidden: 'true' }),
            stepVerb(event.tool, event.args, 'running')
          );
          t.status.hidden = false;
          scroll();
          return;
        }
        case 'tool_result': {
          const call = t.calls[t.done];
          t.done += 1;
          if (call === undefined) return;
          call.row.textContent = stepVerb(
            call.tool,
            call.args,
            event.isError ? 'failed' : 'done'
          );
          if (event.isError) call.row.classList.add('failed');
          // A new design names itself in its result: remember its title for this turn's summary.
          const made = /"design":"([^"]+)"/.exec(event.text)?.[1];
          const title = (call.args as { title?: unknown } | null)?.title;
          if (made !== undefined && typeof title === 'string') {
            t.designs.set(made, title);
            if (designOf(call.args) === undefined) {
              call.args = { ...(call.args as object), design: made };
            }
          }
          const details = el('pre');
          details.textContent = event.text;
          call.row.append(details);
          summarise(t);
          return;
        }
        case 'preview': {
          // The latest render of each design this turn, small; it opens the design.
          const call = t.calls[t.done - 1];
          const design = designOf(call?.args) ?? 'design';
          const name = nameOf(t, call?.args) ?? 'Design';
          let button = t.shown.get(design);
          if (button === undefined) {
            button = el('button', 'preview');
            button.type = 'button';
            if (design !== 'design') {
              button.addEventListener('click', () => opts.open(design));
            }
            t.shown.set(design, button);
            t.previews.append(button);
          }
          const image = Object.assign(new Image(), {
            src: event.uri,
            alt: `${name}, as the assistant last rendered it`
          });
          const label = el('span');
          label.textContent = name;
          button.replaceChildren(image, label);
          scroll();
          return;
        }
        case 'cost':
          return;
      }
    }
  };
}
