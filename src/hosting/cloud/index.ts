// This demo's cloud hosting: the runner (`runner/`), the executors and the store on servers you run, and only the page
// in the browser. IMG.LY does not host this for you. `src/hosting.ts` picks it; what to run is `compose.yaml` here, and the demo's README says how.

import type { EnginePluginModule } from '@imgly/codesign-sdk';
import type { GetToken } from '../../../shared/src/page/token-requests.js';

import type { ForTenant } from '../../runner/session.js';
import type { RunnerEndpoint, RunnerInit } from '../../protocol.js';
import type { CloudTenantPluginOptions } from './http-files.js';
import { runnerClient } from './runner/client.js';
import { TENANT_PLUGIN_MODULE } from './tenant-plugin.generated.js';

/** The platform's key pays the gateway: the visitor's credits are not used. */
export const visitorCredits = false;
/** None: the executors and the store's writes are the runner's alone, so the page prepares no tools. */
export const forTenantInPage: ForTenant | undefined = undefined;

/** The tenant's sources, as every engine of its sessions and its editor adds them; `token` only where they write. */
export const tenantPlugins = (
  store: string,
  tenant: string,
  token?: string
): EnginePluginModule[] => {
  const options: CloudTenantPluginOptions = {
    tenant,
    store,
    ...(token !== undefined ? { token } : {})
  };
  return [{ module: TENANT_PLUGIN_MODULE, options: { ...options } }];
};

const RUNNER = (import.meta.env.VITE_RUNNER_URL ?? '')
  .trim()
  .replace(/\/+$/, '');
const STORE = (import.meta.env.VITE_STORE_URL ?? '').trim().replace(/\/+$/, '');

/** The runner server, which the session's token reaches; their chat keeps running there while no tab is open. */
export const connectRunner = (
  init: RunnerInit,
  getToken: GetToken,
  opts: { stopped(reason: string): void }
): RunnerEndpoint & { close(): void } =>
  runnerClient(RUNNER, init, getToken, opts);

/** The page's editor for a tenant: its sources, which read the store's files as plain URLs and never write. */
export const editorPlugins = (tenant: string): EnginePluginModule[] =>
  tenantPlugins(STORE, tenant);

/** What stops this hosting, in words for the visitor; `undefined` when nothing does. */
export const hostProblem = async (): Promise<string | undefined> =>
  RUNNER === '' || STORE === ''
    ? 'This demo is set up for cloud hosting, but its build has no VITE_RUNNER_URL or VITE_STORE_URL. Set both in .env (see src/hosting/cloud/.env.template) and start the runner and the containers.'
    : undefined;

/** Not offered: the store is yours to run, and a button on the page never deletes it. */
export const clearData: (() => Promise<void>) | undefined = undefined;
