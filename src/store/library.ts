// What the designs home keeps beside the designs: each design's last render, and the tenant's conversation.

import type { Thumbnail } from '../runner/session.js';
import type { DesignSize } from '../protocol.js';
import { orMissing, type StoreFiles } from './tenant-api.js';

/**
 * `user`: a chat per signed-in person, where a runner serves many; without one, the tenant's one chat. `url`: where the
 * store serves a path, so a thumbnail is answered as its link; without it, as its bytes.
 */
export function tenantLibrary(
  tenant: string,
  fs: StoreFiles,
  user?: string,
  opts: { url?(path: string): string } = {}
) {
  const home = `tenants/${tenant}`;
  const chat =
    user === undefined
      ? `${home}/chat.json`
      : `${home}/chats/${encodeURIComponent(user)}.json`;
  // The version in the link, so a browser never shows an older render it cached.
  const answer = async (
    design: string,
    version: string,
    size: DesignSize
  ): Promise<Thumbnail> => {
    const png = `${home}/thumbnails/${design}.png`;
    return opts.url !== undefined
      ? { url: `${opts.url(png)}?v=${encodeURIComponent(version)}`, size }
      : { png: await fs.readFile(png), size };
  };
  return {
    thumbnails: {
      /** The render kept for `version`, or `undefined`. */
      async get(design: string, version: string) {
        const at = `${home}/thumbnails/${design}`;
        const kept = await orMissing(fs.readFile(`${at}.json`, 'utf8'));
        const meta =
          kept === undefined
            ? undefined
            : (JSON.parse(kept) as { version: string; size: DesignSize });
        if (meta?.version !== version) return undefined;
        return answer(design, version, meta.size);
      },
      async put(
        design: string,
        version: string,
        png: Uint8Array,
        size: DesignSize
      ): Promise<Thumbnail> {
        const at = `${home}/thumbnails/${design}`;
        await fs.writeFile(`${at}.png`, png);
        await fs.writeFile(`${at}.json`, JSON.stringify({ version, size }));
        return opts.url !== undefined
          ? answer(design, version, size)
          : { png, size };
      }
    },
    /** The conversation with the agent, as pi keeps it. */
    history: {
      load: async () =>
        JSON.parse(
          (await orMissing(fs.readFile(chat, 'utf8'))) ?? '[]'
        ) as unknown[],
      save: (messages: readonly unknown[]) =>
        fs.writeFile(chat, JSON.stringify(messages))
    }
  };
}
