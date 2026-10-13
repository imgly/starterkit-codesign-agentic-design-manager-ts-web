// The Agentic Design Manager's runner server, on the cloud hosting: the assistant (`src/runner/`),
// for each person `auth.ts` names, on the cloud's executors and store, paid for by the platform's gateway key. A server
// process; the page reaches it only through `client.ts`.
import { openAssistant } from '../../../runner/assistant.js';
import { createRunner } from '../../../runner/serve.js';
import { TENANT_PROFILES } from '../../../brand/tenants.js';
import { forTenant } from '../tenant.js';
import { runnerAuth } from './auth.js';
import { runnerHandler } from './server.js';

/** `ALLOWED_ORIGINS`: the page origins that may call, comma-separated; the rest of `env` is `runnerAuth`'s. */
export function designPlatformRunner(env: Parameters<typeof runnerAuth>[0]) {
  const origins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o !== '');
  return runnerHandler({
    authenticate: runnerAuth(env),
    origins,
    chat: (user, tenant) =>
      TENANT_PROFILES.some((p) => p.tenantId === tenant)
        ? createRunner({
            openSession: (ctx) => openAssistant(forTenant)({ ...ctx, user })
          })
        : undefined
  });
}
