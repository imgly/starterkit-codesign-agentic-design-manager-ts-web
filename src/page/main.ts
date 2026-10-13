// The page: starts the session, connects to the runner, and shows the chat and the designs.

import { hasLicence, licenceFor } from '../../shared/src/licence.js';
import { checkGateway } from '../../shared/src/page/check.js';
import { outOfCredits } from '../../shared/src/page/credits.js';
import {
  startSession,
  type GatewaySession
} from '../../shared/src/page/session.js';
import {
  DEFAULT_MODEL_ID,
  MODEL_CHOICES
} from '../../shared/src/runner/model.js';

import { connectRunner, hostProblem, visitorCredits } from '../hosting.js';

import type { PageToRunner, RunnerToPage } from '../protocol.js';
import { BRAND_CHIPS, chipLabel, chipPrompt } from '../brand/chips.js';
import { chosenTenant, showBrand } from './brand.js';
import { chatView } from './chat.js';
import { clearDataButton } from './clear-data.js';
import { designsHome } from './designs.js';
import { loadingPopup } from './loading.js';
import { usageNotices } from './usage.js';

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const loading = loadingPopup($('loading'));

function notice(text: string, kind: 'info' | 'error' = 'info'): void {
  if (kind === 'error') loading.done();
  const el = $('notice');
  el.textContent = text;
  el.classList.toggle('error', kind === 'error');
  el.hidden = false;
}

async function main(): Promise<void> {
  // How the page reaches the gateway is for developers: shown with ?debug only.
  $('mode').hidden = !new URLSearchParams(location.search).has('debug');
  const problem = await hostProblem();
  if (problem !== undefined) {
    loading.failed(problem);
    return;
  }
  const page = {
    notice,
    mode: (text: string) => ($('mode').textContent = text)
  };
  const session = await startSession(page);
  if (session === undefined) {
    loading.done();
    return;
  }
  // Where the platform's key pays on a server (the cloud hosting), the page never calls the gateway itself.
  if (visitorCredits) checkGateway(session, page);
  start(session);
}

function start(session: GatewaySession): void {
  const { gatewayBaseURL, getToken } = session;
  if (!hasLicence()) {
    notice('No CE.SDK license: set VITE_CESDK_LICENSE in .env.', 'error');
    return;
  }
  $('app').hidden = false;

  const tenant = chosenTenant();
  showBrand(tenant);

  const model = $<HTMLSelectElement>('model');
  const initialModel = import.meta.env.VITE_MODEL || DEFAULT_MODEL_ID;
  const choices = MODEL_CHOICES.some((c) => c.id === initialModel)
    ? MODEL_CHOICES
    : [{ id: initialModel, label: initialModel }, ...MODEL_CHOICES];
  for (const choice of choices) model.add(new Option(choice.label, choice.id));
  model.value = initialModel;

  const runner = connectRunner(
    {
      gatewayBaseURL,
      meteringBaseURL: session.meteringBaseURL,
      model: model.value,
      conversation: `${tenant}-${crypto.randomUUID()}`,
      tenant
    },
    getToken,
    { stopped: (reason) => notice(`The runner stopped: ${reason}`, 'error') }
  );
  const post = (message: PageToRunner, transfer: Transferable[] = []) =>
    runner.postMessage(message, transfer);

  const assistant = document.querySelector('.assistant') as HTMLElement;
  const chat = chatView($<HTMLOListElement>('log'), {
    titleOf: (design) => home.titleOf(design),
    open: (design) => home.open(design),
    onEmpty: (empty) => assistant.classList.toggle('empty', empty)
  });

  if (visitorCredits) {
    usageNotices({
      card: $('usage-card'),
      info: $<HTMLButtonElement>('usage-info'),
      dialog: $<HTMLDialogElement>('usage-dialog')
    });
  }
  clearDataButton({
    button: $<HTMLButtonElement>('clear-data'),
    dialog: $<HTMLDialogElement>('clear-data-dialog'),
    stop: () => runner.close(),
    fail: (message) => notice(message, 'error')
  });

  $('usage-info').hidden = !visitorCredits;
  let creditsNoticed = false;
  const noticeIfOutOfCredits = (message: string) => {
    if (creditsNoticed || !outOfCredits(message)) return;
    creditsNoticed = true;
    const out = session.outOfCredits ?? {
      text: 'The license key behind the gateway route is out of AI credits.'
    };
    chat.notice(out.text, out.link);
  };
  const prompt = $<HTMLTextAreaElement>('prompt');
  const home = designsHome({
    post,
    license: licenceFor(getToken),
    ask: (card) => {
      prompt.value = `About “${card.title}” (design ${card.id}): `;
      prompt.focus();
    },
    error: (message) => chat.error(message)
  });
  home.refresh();

  // An empty chat suggests one prompt per job to be done; a chip only fills the input, since sending spends credits.
  for (const chip of BRAND_CHIPS[tenant] ?? []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = chipLabel(tenant, chip);
    button.addEventListener('click', () => {
      prompt.value = chipPrompt(tenant, chip);
      prompt.focus();
    });
    $('suggest').append(button);
  }

  const send = $<HTMLButtonElement>('send');
  const stop = $<HTMLButtonElement>('stop');
  const busy = (on: boolean) => {
    send.disabled = on;
    stop.hidden = !on;
  };

  let turns = 0;
  $<HTMLFormElement>('composer').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = prompt.value.trim();
    if (text === '') return;
    prompt.value = '';
    busy(true);
    post({
      type: 'prompt',
      turn: `turn-${(turns += 1)}`,
      text,
      model: model.value
    });
  });
  stop.addEventListener('click', () => post({ type: 'abort' }));

  // One chat per brand: clearing empties it, and the model starts fresh. Designs stay.
  $('clear-chat').addEventListener('click', () => {
    if (
      send.disabled &&
      !confirm('The assistant is still working. Stop it and clear the chat?')
    ) {
      return;
    }
    post({ type: 'chat.clear', id: `c${(turns += 1)}` });
  });

  runner.addEventListener('message', (event: MessageEvent<RunnerToPage>) => {
    const message = event.data;
    // The popup stays until the library is read: the first design list, or the reason there is none.
    if (message.type === 'designs') loading.done();
    if (message.type === 'design.failed' && !$('loading').hidden) {
      loading.failed(message.error);
    }
    if (home.receive(message)) return;
    switch (message.type) {
      case 'history':
        // A runner that restarted replays its whole chat: what was shown before goes.
        chat.clear();
        for (const e of message.events) chat.event(e);
        chat.endTurn();
        return;
      case 'event':
        // The prompt comes back from the runner, also to a page that opens during the turn.
        if (message.event.type === 'user') busy(true);
        chat.event(message.event);
        // Designs appear and change as the agent works on them.
        if (message.event.type === 'tool_result') {
          home.refresh();
          if (message.event.isError) noticeIfOutOfCredits(message.event.text);
        }
        if (message.event.type === 'error') {
          noticeIfOutOfCredits(message.event.message);
        }
        return;
      case 'file':
        chat.file(
          message.name,
          'url' in message
            ? message.url
            : URL.createObjectURL(
                new Blob([message.bytes], { type: message.mimeType })
              )
        );
        return;
      case 'chat.cleared':
        chat.clear();
        $('cost').textContent = '';
        return;
      case 'turn.end':
        busy(false);
        chat.endTurn();
        if (message.report.costUsd > 0) {
          $('cost').textContent =
            `Last reply $${message.report.costUsd.toFixed(4)}`;
        }
        home.refresh();
        return;
    }
  });
}

void main();
