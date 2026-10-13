// One tenant's records and files in a store shaped like `node:fs/promises`: the `TenantAPI` the tenant's sources read.
// Each hosting gives the store and its files' uri. Imports nothing but types from outside this demo: it is bundled into plugin modules.

import type {
  AssetQueryData,
  ImageSize,
  UploadAction
} from '@imgly/codesign-sdk';

import {
  FILES_SOURCE_ID,
  FONT_UPLOAD_SOURCE_ID,
  IMAGE_UPLOAD_SOURCE_ID,
  LISTED_IMAGE_TYPES,
  page,
  type AssetResult,
  type TenantAPI
} from '../brand/sources.js';

/**
 * The subset of `node:fs/promises` a hosting's store gives: POSIX paths relative to its root, errors with node's
 * `code` (`ENOENT` for a missing file). Unlike node's, `writeFile` creates the directories a path names.
 */
export interface StoreFiles {
  readFile(path: string): Promise<Uint8Array<ArrayBuffer>>;
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean }
  ): Promise<void>;
}

/** A missing file reads as `undefined`; any other failure still throws. */
export const orMissing = <T>(read: Promise<T>): Promise<T | undefined> =>
  read.catch((err: { code?: string }) => {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  });

const FILE_NAME = /^[a-f0-9]{64}(\.[a-z0-9]{1,5})?$/;

/**
 * `tenants/<tenant>/sources/<id>.json` holds a source's records, newest first, and `tenants/<tenant>/files/<sha256>.<ext>`
 * a file, named by its content, whose uri is `files` plus that name. `url` answers `undefined`: the engine fetches the
 * uri as it is, unless the hosting replaces `url`.
 */
export function tenantAPI(
  fs: StoreFiles,
  opts: {
    tenant: string;
    /** The uri of this tenant's files, which a file's name completes. */
    files: string;
  }
): TenantAPI & {
  /** The file a uri of this tenant's names, or `undefined`. */
  fileOf(uri: string): string | undefined;
} {
  const home = `tenants/${opts.tenant}`;
  const recordsAt = (sourceId: string) => `${home}/sources/${sourceId}.json`;
  const records = async (sourceId: string): Promise<AssetResult[]> =>
    JSON.parse(
      (await orMissing(fs.readFile(recordsAt(sourceId), 'utf8'))) ?? '[]'
    ) as AssetResult[];
  // One write at a time: listing reads the records, then replaces them.
  let writes: Promise<unknown> = Promise.resolve();
  const listFirst = (sourceId: string, asset: AssetResult) => {
    const next = writes.then(async () => {
      const all = await records(sourceId);
      await fs.writeFile(
        recordsAt(sourceId),
        JSON.stringify([asset, ...all.filter((a) => a.id !== asset.id)])
      );
    });
    writes = next.catch(() => undefined);
    return next;
  };
  const fileOf = (uri: string): string | undefined => {
    const name = uri.startsWith(opts.files) ? uri.slice(opts.files.length) : '';
    return FILE_NAME.test(name) ? name : undefined;
  };
  const keep = async (file: File, size?: ImageSize): Promise<AssetResult> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const ext = /\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1]?.toLowerCase();
    const name = ext === undefined ? hash : `${hash}.${ext}`;
    await fs.writeFile(`${home}/files/${name}`, bytes);
    const uri = opts.files + name;
    return {
      id: uri,
      meta: {
        uri,
        ...(file.type !== '' ? { mimeType: file.type } : {}),
        ...size
      }
    };
  };
  const named = (asset: AssetResult, filename: string): AssetResult => ({
    ...asset,
    label: filename,
    meta: { ...asset.meta, filename }
  });
  return {
    fileOf,
    async find(sourceId: string, q: AssetQueryData) {
      return page(await records(sourceId), q);
    },
    get: async (sourceId: string, id: string) =>
      (await records(sourceId)).find((a) => a.id === id) ?? null,
    async upload(
      sourceId: string,
      file: File,
      action: UploadAction,
      size?: ImageSize
    ): Promise<AssetResult | undefined> {
      if (sourceId === IMAGE_UPLOAD_SOURCE_ID) {
        if (action === 'saveComponent') return undefined;
        const image = LISTED_IMAGE_TYPES.some((t) => t === file.type);
        if (action === 'upload' && !image) {
          throw new Error(
            `${file.name} is not an image this library takes: PNG, JPEG, WebP, GIF or SVG.`
          );
        }
        const kept = await keep(file, size);
        if (action !== 'upload' && !(action === 'generate' && image)) {
          return kept;
        }
        const asset = named(kept, file.name);
        await listFirst(sourceId, asset);
        return asset;
      }
      if (sourceId === FONT_UPLOAD_SOURCE_ID) {
        return action === 'import' ? keep(file) : undefined;
      }
      if (sourceId === FILES_SOURCE_ID) {
        if (action !== 'upload') return undefined;
        const asset = named(await keep(file), file.name);
        await listFirst(sourceId, asset);
        return asset;
      }
      return undefined;
    },
    url: () => undefined,
    async bytes(uri: string): Promise<Uint8Array> {
      const name = fileOf(uri);
      if (name === undefined) throw new Error(`not in this library: ${uri}`);
      return fs.readFile(`${home}/files/${name}`).catch(() => {
        throw new Error(`not in this library: ${uri}`);
      });
    }
  };
}
