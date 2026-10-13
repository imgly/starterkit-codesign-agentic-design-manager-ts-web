// The cloud hosting's store: any HTTP server that answers GET, PUT and DELETE by path, as a `node:fs` subset.
// Imports nothing but types from outside this demo: it is bundled into the plugin module text the executor receives.

import type { StoreFiles } from '../../store/tenant-api.js';

/** What the runner sends with each session, and the editor applies. The model's code can read all of it. */
export interface CloudTenantPluginOptions {
  tenant: string;
  /** The store's URL, the same for the browser and the executors: a file's uri is this plus its path. */
  store: string;
  /** Sent as a bearer token with every write. */
  token?: string;
}

/** An error shaped as `node:fs` throws it: `code` is node's. */
const fsError = (code: string, path: string): Error & { code: string } =>
  Object.assign(new Error(`${code}: ${path}`), { code });

/**
 * `readFile`, `writeFile` and `rm` of `node:fs/promises` over the store at `url`. Paths are POSIX, relative to `url`
 * (a leading `/` is ignored), and may not climb. A write needs no directories first.
 */
export function httpFiles(store: { url: string; token?: string }): StoreFiles {
  const base = store.url.replace(/\/+$/, '');
  const urlOf = (path: string) => {
    const parts = path.split('/').filter((p) => p !== '' && p !== '.');
    if (parts.includes('..')) throw fsError('EINVAL', path);
    return `${base}/${parts.map(encodeURIComponent).join('/')}`;
  };
  const auth: Record<string, string> =
    store.token !== undefined ? { authorization: `Bearer ${store.token}` } : {};
  const failed = (response: Response, method: string, path: string) =>
    new Error(`${method} ${path}: the store answered ${response.status}`);

  async function readFile(path: string): Promise<Uint8Array<ArrayBuffer>>;
  async function readFile(path: string, encoding: 'utf8'): Promise<string>;
  async function readFile(
    path: string,
    encoding?: 'utf8'
  ): Promise<Uint8Array<ArrayBuffer> | string> {
    const response = await fetch(urlOf(path), { cache: 'no-store' });
    if (response.status === 404) throw fsError('ENOENT', path);
    if (!response.ok) throw failed(response, 'GET', path);
    return encoding === 'utf8'
      ? response.text()
      : new Uint8Array(await response.arrayBuffer());
  }

  return {
    readFile,
    async writeFile(path, data) {
      const response = await fetch(urlOf(path), {
        method: 'PUT',
        headers: auth,
        body: typeof data === 'string' ? data : data.slice()
      });
      // Read to the end, so the request is not left aborted.
      await response.arrayBuffer();
      if (!response.ok) throw failed(response, 'PUT', path);
    },
    async rm(path, options = {}) {
      const response = await fetch(urlOf(path), {
        method: 'DELETE',
        headers: auth
      });
      await response.arrayBuffer();
      if (response.status === 404) {
        if (options.force === true) return;
        throw fsError('ENOENT', path);
      }
      if (!response.ok) throw failed(response, 'DELETE', path);
    }
  };
}

/** The `TenantAPI` uri of a tenant's files in the store. */
export const filesURI = (store: string, tenant: string) =>
  `${store.replace(/\/+$/, '')}/tenants/${tenant}/files/`;
