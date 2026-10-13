// A tenant's designs in the hosting's store: the runner's `DesignStore`.

import {
  assertCanSave,
  type DesignContent,
  type DesignStore,
  type StoredDesign
} from '@imgly/codesign-sdk';
import { DESIGNS_SOURCE_ID } from '../brand/sources.js';
import { orMissing, type StoreFiles } from './tenant-api.js';

interface DesignMeta {
  version: string;
  cesdkVersion: string;
  editKey?: string;
  title: string;
  kind: 'scene' | 'archive';
  /** When this version was written, in ms since the epoch. */
  updatedAt: number;
}

/** One design as the designs home lists it. */
export interface DesignRow {
  id: string;
  title: string;
  version: string;
  updatedAt: number;
}

export type ListedDesignStore = DesignStore & {
  /** Every design, the most recently changed first. */
  list(): Promise<DesignRow[]>;
};

const DESIGN_ID = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;
const EXT = { scene: 'scene', archive: 'imgly' } as const;

/**
 * `tenants/<tenant>/designs/<id>.json` holds a design's version, saving CE.SDK, edit key, title and kind; `<id>.scene`
 * or `<id>.imgly` its content. The design list, `sources/demo.designs.json`, is what the tenant plugin's
 * `demo.designs` source reads in the executor's engine. Compare-and-set holds within the runner, the only writer.
 */
export function designStore(opts: {
  tenant: string;
  fs: StoreFiles;
}): ListedDesignStore {
  const { fs } = opts;
  const home = `tenants/${opts.tenant}`;
  const metaAt = (id: string) => `${home}/designs/${id}.json`;
  const contentAt = (id: string, kind: DesignMeta['kind']) =>
    `${home}/designs/${id}.${EXT[kind]}`;
  const listAt = `${home}/sources/${DESIGNS_SOURCE_ID}.json`;

  const metaOf = async (id: string): Promise<DesignMeta | undefined> => {
    const text = await orMissing(fs.readFile(metaAt(id), 'utf8'));
    return text === undefined ? undefined : (JSON.parse(text) as DesignMeta);
  };

  let writes: Promise<unknown> = Promise.resolve();
  const oneAtATime = <T>(write: () => Promise<T>): Promise<T> => {
    const next = writes.then(write);
    writes = next.catch(() => undefined);
    return next;
  };

  return {
    listSourceId: DESIGNS_SOURCE_ID,

    async list() {
      const listed = await orMissing(fs.readFile(listAt, 'utf8'));
      const rows: DesignRow[] = [];
      for (const { id } of JSON.parse(listed ?? '[]') as Array<{
        id: string;
      }>) {
        const meta = await metaOf(id);
        if (meta === undefined) continue;
        rows.push({
          id,
          title: meta.title,
          version: meta.version,
          updatedAt: meta.updatedAt ?? 0
        });
      }
      return rows.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async read(id): Promise<StoredDesign | undefined> {
      if (!DESIGN_ID.test(id)) return undefined;
      const meta = await metaOf(id);
      if (meta === undefined) return undefined;
      const content: DesignContent =
        meta.kind === 'scene'
          ? { scene: await fs.readFile(contentAt(id, 'scene'), 'utf8') }
          : { archive: await fs.readFile(contentAt(id, 'archive')) };
      return {
        content,
        version: meta.version,
        cesdkVersion: meta.cesdkVersion,
        title: meta.title,
        ...(meta.editKey !== undefined ? { editKey: meta.editKey } : {})
      };
    },

    write(id, content, { ifMatch, cesdkVersion, editKey, title }) {
      if (!DESIGN_ID.test(id)) {
        return Promise.reject(new Error(`not a design id: ${id}`));
      }
      return oneAtATime(async () => {
        const stored = await metaOf(id);
        if (
          ifMatch === undefined
            ? stored !== undefined
            : stored?.version !== ifMatch
        ) {
          return undefined;
        }
        assertCanSave({ saver: cesdkVersion, recorded: stored?.cesdkVersion });
        const kind = content.scene !== undefined ? 'scene' : 'archive';
        const meta: DesignMeta = {
          version: String(Number(stored?.version ?? 0) + 1),
          cesdkVersion,
          ...(editKey !== undefined ? { editKey } : {}),
          title: stored?.title ?? title ?? id,
          kind,
          updatedAt: Date.now()
        };
        await fs.writeFile(
          contentAt(id, kind),
          content.scene !== undefined ? content.scene : content.archive
        );
        if (stored !== undefined && stored.kind !== kind) {
          await fs.rm(contentAt(id, stored.kind), { force: true });
        }
        await fs.writeFile(metaAt(id), JSON.stringify(meta));
        if (stored === undefined) {
          const list = (await orMissing(fs.readFile(listAt, 'utf8'))) ?? '[]';
          await fs.writeFile(
            listAt,
            JSON.stringify([
              { id, label: meta.title },
              ...(JSON.parse(list) as Array<{ id: string }>).filter(
                (row) => row.id !== id
              )
            ])
          );
        }
        return meta.version;
      });
    }
  };
}
