// The cloud hosting's tenants, on the runner server: the executor as IMG.LY's published image in containers you run,
// and each tenant's designs, files, renders and chat in a store you run. Server code: the page never runs it.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { remoteExecutors } from '@imgly/codesign-sdk';
import { GATEWAY_ORIGIN } from '../../../shared/src/config.js';
import { executorPool } from '../../../shared/hosting/cloud/executor-pool.js';

import type { ForTenant } from '../../runner/session.js';
import { brandSeeds } from '../../brand/seeds.js';
import { designStore } from '../../store/designs.js';
import { tenantLibrary } from '../../store/library.js';
import { seedDesigns } from '../../store/seed-designs.js';
import { seedTenants } from '../../store/seed-tenants.js';
import { tenantAPI } from '../../store/tenant-api.js';
import { filesURI, httpFiles } from './http-files.js';
import { previewKeeper, storeURL } from './links.js';
import { tenantPlugins } from './index.js';

/** The containers, the store and the gateway, from the runner's environment (see `.env.template` here). */
export function cloudSettings(env: {
  EXECUTOR_URLS?: string;
  VITE_STORE_URL?: string;
  STORE_TOKEN?: string;
  IMGLY_GATEWAY_API_KEY?: string;
  IMGLY_GATEWAY_URL?: string;
}) {
  const token = env.STORE_TOKEN || undefined;
  const gatewayKey = env.IMGLY_GATEWAY_API_KEY || undefined;
  return {
    /** Each executor's URL: one conversation at a time each. */
    executors: (env.EXECUTOR_URLS ?? '')
      .split(',')
      .map((url) => url.trim().replace(/\/+$/, ''))
      .filter((url) => url !== ''),
    store: (env.VITE_STORE_URL ?? '').trim().replace(/\/+$/, ''),
    ...(token !== undefined ? { token } : {}),
    /** The platform's IMG.LY key: it pays the model and generated images for everyone. */
    ...(gatewayKey !== undefined ? { gatewayKey } : {}),
    gatewayURL: (env.IMGLY_GATEWAY_URL || GATEWAY_ORIGIN).replace(/\/+$/, '')
  };
}

/** A file bundled with the runner, by the URL its build gave it, under the folder the runner starts in. */
const readBundled = async (url: string) =>
  new Uint8Array(await readFile(join(process.cwd(), url)));

const EXPORT_NAME = /[^\w .()-]+/g;

// One per process: the pool remembers which conversation holds which executor.
let cloud: ReturnType<typeof connect> | undefined;
function connect() {
  const settings = cloudSettings(process.env);
  const files = httpFiles({
    url: settings.store,
    ...(settings.token !== undefined ? { token: settings.token } : {})
  });
  const apiFor = (tenant: string) =>
    tenantAPI(files, { tenant, files: filesURI(settings.store, tenant) });
  const previews = new Map<string, ReturnType<typeof previewKeeper>>();
  const previewsOf = (tenant: string) => {
    let keep = previews.get(tenant);
    if (keep === undefined) {
      keep = previewKeeper(files, settings.store, tenant);
      previews.set(tenant, keep);
    }
    return keep;
  };
  return {
    settings,
    files,
    apiFor,
    previewsOf,
    acquire: executorPool(settings.executors)
  };
}

/**
 * Everything a tenant's sessions need from the hosting, on the runner server. The platform's key pays the gateway and
 * the containers' licence key every export: nothing is the visitor's. `user` keeps a chat per person.
 */
export const forTenant: ForTenant = async (tenant, { user }) => {
  cloud ??= connect();
  const { settings, files, apiFor, previewsOf, acquire } = cloud;
  const url = (path: string) => storeURL(settings.store, path);
  await seedTenants(files, apiFor);
  return {
    seed: () =>
      seedDesigns(
        files,
        apiFor(tenant),
        tenant,
        brandSeeds(tenant, readBundled)
      ),
    executors: remoteExecutors({ acquire }),
    designs: designStore({ tenant, fs: files }),
    plugins: tenantPlugins(settings.store, tenant, settings.token),
    gateway: {
      baseURL: settings.gatewayURL,
      bearer: async () => settings.gatewayKey
    },
    files: apiFor(tenant),
    // In the store, at a link the chat shows.
    async keepExport({ design, name, bytes }) {
      const path = [
        'tenants',
        tenant,
        'exports',
        design,
        crypto.randomUUID(),
        name.replace(EXPORT_NAME, '-')
      ];
      await files.writeFile(path.join('/'), bytes);
      return url(path.join('/'));
    },
    keepPreview: previewsOf(tenant),
    ...tenantLibrary(tenant, files, user, { url })
  };
};
