// The designs home: a card per design with its render, size and age, and a design opened large.

import { openEditorModal } from '../../shared/src/editor-modal/index.js';

import { tenantEditor } from './editor-tenant.js';
import type {
  DesignCard,
  DesignSize,
  DownloadFormat,
  PageToRunner,
  RunnerToPage
} from '../protocol.js';
import { chosenTenant, el } from './brand.js';
import { ago, sizeLabel } from './format.js';

interface Shown {
  card: DesignCard;
  size?: DesignSize;
  thumb?: { version: string; url: string };
}

export interface DesignsHome {
  refresh(): void;
  titleOf(design: string): string | undefined;
  /** Opens a design large, as clicking its card does. */
  open(design: string): void;
  /** Takes the runner's answers to this home's requests; false for any other message. */
  receive(message: RunnerToPage): boolean;
}

export function designsHome(opts: {
  post: (message: PageToRunner, transfer?: Transferable[]) => void;
  /** The editor's CE.SDK licence, asked each time it opens. */
  license: () => Promise<string>;
  ask: (card: DesignCard) => void;
  error: (message: string) => void;
}): DesignsHome {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const grid = $<HTMLUListElement>('designs');
  const dialog = $<HTMLDialogElement>('design-view');
  // `closedby="any"` closes it on a backdrop click; a browser without it gets the same here.
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  }
  const shown = new Map<string, Shown>();
  const downloads = new Map<string, string>();
  // The editor's reads and saves, answered by the runner, which is the store's only writer.
  const answers = new Map<
    string,
    { resolve(message: RunnerToPage): void; reject(error: Error): void }
  >();
  const ask = (
    message: Extract<
      PageToRunner,
      { type: 'design.read' | 'design.save' | 'image.upload' }
    >,
    transfer?: Transferable[]
  ) =>
    new Promise<RunnerToPage>((resolve, reject) => {
      answers.set(message.id, { resolve, reject });
      opts.post(message, transfer);
    });
  let turnRunning = false;
  let open: Shown | undefined;
  let requests = 0;
  const next = (prefix: string) => `${prefix}${(requests += 1)}`;

  // One render at a time: each may boot an engine for its design.
  const queue: string[] = [];
  let rendering: string | undefined;
  const pump = () => {
    if (rendering !== undefined) return;
    const design = queue.shift();
    const item = design === undefined ? undefined : shown.get(design);
    if (item === undefined) return;
    if (item.thumb?.version === item.card.version) return pump();
    rendering = next('t');
    performance.mark(rendering);
    opts.post({
      type: 'design.thumbnail',
      id: rendering,
      design: item.card.id,
      version: item.card.version
    });
  };

  const render = () => {
    $('empty').hidden = shown.size > 0;
    grid.replaceChildren(
      ...[...shown.values()].map((item) => {
        const thumb = el('span', 'thumb');
        thumb.append(
          item.thumb !== undefined
            ? Object.assign(new Image(), { src: item.thumb.url, alt: '' })
            : el('span', 'spinner')
        );
        const meta = el(
          'span',
          'meta',
          ...(item.size !== undefined ? [`${sizeLabel(item.size)} · `] : []),
          el('span', 'edited', 'edited '),
          ago(item.card.updatedAt)
        );
        const button = el(
          'button',
          '',
          thumb,
          el('span', 'body', el('span', 'title', item.card.title), meta)
        );
        button.type = 'button';
        button.addEventListener('click', () => show(item));
        const li = el('li', 'card', button);
        li.dataset.design = item.card.id;
        return li;
      })
    );
  };

  const show = (item: Shown) => {
    open = item;
    const size = item.size !== undefined ? sizeLabel(item.size) : undefined;
    $('view-title').textContent = item.card.title;
    $('view-meta').textContent = [
      ...(size !== undefined ? [size] : []),
      `edited ${ago(item.card.updatedAt)}`
    ].join(' · ');
    Object.assign($<HTMLImageElement>('view-image'), {
      src: item.thumb?.url ?? '',
      alt: [item.card.title, size].filter(Boolean).join(', ')
    });
    dialog.showModal();
  };

  const download = (format: DownloadFormat) => {
    if (open === undefined) return;
    const id = next('e');
    const name = `${open.card.title}.${format}`;
    downloads.set(id, name);
    opts.post({
      type: 'design.export',
      id,
      design: open.card.id,
      format,
      name
    });
  };
  $('view-png').addEventListener('click', () => download('png'));
  $('view-pdf').addEventListener('click', () => download('pdf'));
  $('view-imgly').addEventListener('click', () => download('imgly'));
  $('view-ask').addEventListener('click', () => {
    dialog.close();
    if (open !== undefined) opts.ask(open.card);
  });

  const editButton = el('button', '', 'Edit design');
  editButton.type = 'button';
  editButton.id = 'view-edit';
  $('view-ask').after(editButton);
  editButton.addEventListener('click', () => {
    if (open === undefined || turnRunning) return;
    const design = open.card.id;
    const title = open.card.title;
    dialog.close();
    void opts
      .license()
      .then((license) =>
        openEditorModal({
          title,
          license,
          ...tenantEditor(chosenTenant(), async (file) => {
            const bytes = await file.arrayBuffer();
            const m = await ask(
              {
                type: 'image.upload',
                id: next('i'),
                bytes,
                name: file.name,
                mimeType: file.type
              },
              [bytes]
            );
            if (m.type !== 'image.kept')
              throw new Error(`${file.name} was not kept`);
            return m.asset;
          }),
          async read() {
            const m = await ask({ type: 'design.read', id: next('r'), design });
            if (m.type !== 'design.content')
              throw new Error('no design content');
            return {
              content:
                'archive' in m
                  ? { archive: new Uint8Array(m.archive) }
                  : { scene: m.scene },
              version: m.version,
              cesdkVersion: m.cesdkVersion
            };
          },
          async write(content, { ifMatch, cesdkVersion }) {
            const id = next('s');
            const head = {
              type: 'design.save' as const,
              id,
              design,
              ifMatch,
              cesdkVersion
            };
            const m =
              content.archive !== undefined
                ? await ask({ ...head, archive: content.archive.buffer }, [
                    content.archive.buffer
                  ])
                : await ask({ ...head, scene: content.scene });
            if (m.type !== 'design.saved') throw new Error('not saved');
            return m.version ?? undefined;
          },
          onSaved: () => opts.post({ type: 'designs.list', id: next('l') })
        })
      )
      .catch((error: unknown) =>
        opts.error(
          `The editor could not start: ${error instanceof Error ? error.message : String(error)}`
        )
      );
  });

  // A file opens as a new design through the executor's importers; the label says so until it is in the grid.
  const uploadLabel = $('upload-label');
  const uploadText = uploadLabel.querySelector('span') as HTMLSpanElement;
  const importing = new Map<string, string>();
  const showImporting = () => {
    const names = [...importing.values()];
    uploadLabel.classList.toggle('busy', names.length > 0);
    uploadText.textContent =
      names.length > 0 ? `Importing ${names.join(', ')}…` : 'Import a file';
  };
  $<HTMLInputElement>('upload').addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;
    const bytes = await file.arrayBuffer();
    const id = next('u');
    importing.set(id, file.name);
    showImporting();
    opts.post({ type: 'design.upload', id, bytes, name: file.name }, [bytes]);
  });
  const imported = (id: string) => {
    const was = importing.delete(id);
    if (was) showImporting();
    return was;
  };

  return {
    refresh: () => opts.post({ type: 'designs.list', id: next('l') }),
    titleOf: (design) => shown.get(design)?.card.title,
    open: (design) => {
      const item = shown.get(design);
      if (item !== undefined) show(item);
    },
    receive(message) {
      if (
        message.type === 'design.content' ||
        message.type === 'design.saved' ||
        message.type === 'image.kept' ||
        message.type === 'design.failed'
      ) {
        const waiting = answers.get(message.id);
        if (waiting !== undefined) {
          answers.delete(message.id);
          if (message.type === 'design.failed') {
            waiting.reject(new Error(message.error));
          } else {
            waiting.resolve(message);
          }
          return true;
        }
      }
      switch (message.type) {
        // The editor opens between turns; main.ts still shows these.
        case 'event':
          turnRunning = true;
          editButton.disabled = true;
          return false;
        case 'turn.end':
          turnRunning = false;
          editButton.disabled = false;
          return false;
        case 'designs': {
          // In the runner's order: the most recently changed first.
          const previous = new Map(shown);
          shown.clear();
          for (const card of message.designs) {
            const kept = previous.get(card.id);
            shown.set(card.id, { ...kept, card });
            if (kept?.thumb?.version !== card.version) queue.push(card.id);
          }
          render();
          pump();
          return true;
        }
        case 'design.thumbnail': {
          // Visible in the browser's performance timeline as "thumbnail".
          performance.measure('thumbnail', message.id);
          rendering = undefined;
          const item = shown.get(message.design);
          if (item !== undefined) {
            if (item.thumb?.url.startsWith('blob:') === true) {
              URL.revokeObjectURL(item.thumb.url);
            }
            item.thumb = {
              version: message.version,
              url:
                'url' in message
                  ? message.url
                  : URL.createObjectURL(
                      new Blob([message.png], { type: 'image/png' })
                    )
            };
            item.size = message.size;
            render();
          }
          pump();
          return true;
        }
        case 'design.file': {
          const name = downloads.get(message.id);
          if (name === undefined) return false;
          downloads.delete(message.id);
          const link = el('a');
          link.download = name;
          if ('url' in message) {
            // Another origin's file: the browser opens it in a tab, where it saves it or shows it.
            link.href = message.url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.click();
            return true;
          }
          link.href = URL.createObjectURL(new Blob([message.bytes]));
          link.click();
          setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
          return true;
        }
        case 'design.loaded':
          imported(message.id);
          opts.post({ type: 'designs.list', id: next('l') });
          return true;
        case 'design.failed':
          if (imported(message.id)) {
            opts.error(`The file did not open: ${message.error}`);
          } else if (message.id === rendering) {
            // A design with nothing to render yet keeps its blank card.
            rendering = undefined;
            pump();
          } else {
            opts.error(message.error);
          }
          return true;
        default:
          return false;
      }
    }
  };
}
