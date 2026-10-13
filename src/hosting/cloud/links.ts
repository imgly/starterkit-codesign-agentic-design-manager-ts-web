// What the cloud hosting shows the page: links into the store, never bytes the page would wrap in `blob:` or `data:`.

import type { StoreFiles } from '../../store/tenant-api.js';

/** Where the store serves `path`, for the browser and the executors alike. */
export const storeURL = (store: string, path: string) =>
  `${store.replace(/\/+$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

/** Keeps each image the chat shows (a `data:` uri) once, named by its content, under the tenant's `previews/`. */
export function previewKeeper(
  files: StoreFiles,
  store: string,
  tenant: string
) {
  const kept = new Map<string, Promise<void>>();
  return async (uri: string): Promise<string> => {
    const match = /^data:([^;,]+);base64,(.*)$/s.exec(uri);
    if (match === null) return uri;
    const [, mimeType, data] = match;
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    ]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const path = `tenants/${tenant}/previews/${hash}.${EXTENSIONS[mimeType] ?? 'bin'}`;
    // Named by its content, so writing it again is harmless: once per process, not a read first.
    let write = kept.get(path);
    if (write === undefined) {
      write = files.writeFile(path, bytes);
      kept.set(path, write);
      write.catch(() => kept.delete(path));
    }
    await write;
    return storeURL(store, path);
  };
}
