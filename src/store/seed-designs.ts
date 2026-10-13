// A brand's starter designs, written on its first visit so a visitor has something to ask about.

import { imageSizeOf } from '@imgly/codesign-sdk';

import { IMAGE_UPLOAD_SOURCE_ID, type TenantAPI } from '../brand/sources.js';
import type { DesignSize } from '../protocol.js';
import { designStore } from './designs.js';
import { tenantLibrary } from './library.js';
import { orMissing, type StoreFiles } from './tenant-api.js';

/** How a seed's scene names an image, by its file name: `scripts/build-seeds.mjs` writes it. */
const SEED_IMAGES = 'https://seeds.invalid/';
const UNCOMPRESSED = 'UBQ1';

/** One starter design: its scene and the render the designs home shows for it. */
export interface SeedDesign {
  id: string;
  title: string;
  /** Where `read` gets the scene: uncompressed (`UBQ1`), each image named `https://seeds.invalid/<file>`. */
  scene: string;
  /** Where `read` gets the PNG thumbnail, so the first visit renders and pays for no export. */
  thumbnail: string;
  size: DesignSize;
}

export interface SeedOptions {
  seeds: readonly SeedDesign[];
  /** Raised when the seeds change; a brand seeded at a lower one is seeded again. */
  version: number;
  /** The CE.SDK version that saved the scenes. */
  savedBy: string;
  read(url: string): Promise<Uint8Array<ArrayBuffer>>;
  /** The image a scene names by `file`. */
  image(file: string): Promise<File>;
}

const fromBase64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
};

/**
 * The scene with each image it names replaced by the tenant's own file of it, kept as a person's upload is: in the
 * tenant's files, listed in its image library with its size. An image the library lists already stays where it is.
 */
async function withTenantImages(
  scene: string,
  files: TenantAPI,
  image: SeedOptions['image'],
  kept: Map<string, string>
): Promise<string> {
  if (!scene.startsWith(UNCOMPRESSED)) {
    throw new Error('a seed scene is saved uncompressed (UBQ1)');
  }
  let json = new TextDecoder().decode(
    fromBase64(scene.slice(UNCOMPRESSED.length))
  );
  const named = new Set(
    [...json.matchAll(/"https:\/\/seeds\.invalid\/([^"]+)"/g)].map((m) => m[1]!)
  );
  for (const name of named) {
    let uri = kept.get(name);
    if (uri === undefined) {
      const file = await image(name);
      const size = imageSizeOf(
        new Uint8Array(await file.arrayBuffer()),
        file.type
      );
      if (size === undefined) throw new Error(`${name}: no width and height`);
      const asset = await files.upload(
        IMAGE_UPLOAD_SOURCE_ID,
        file,
        'import',
        size
      );
      if (asset?.meta?.uri === undefined) {
        throw new Error(`${name}: the library kept no file`);
      }
      uri = asset.meta.uri;
      if ((await files.get(IMAGE_UPLOAD_SOURCE_ID, asset.id)) === null) {
        await files.upload(IMAGE_UPLOAD_SOURCE_ID, file, 'upload', size);
      }
      kept.set(name, uri);
    }
    json = json.replaceAll(
      JSON.stringify(SEED_IMAGES + name),
      JSON.stringify(uri)
    );
  }
  return UNCOMPRESSED + toBase64(new TextEncoder().encode(json));
}

/** What `tenants/<tenant>/seeds.json` keeps: the seed version, and the store version each seed was written at. */
interface Seeded {
  version: number;
  written: Record<string, string>;
}

/**
 * Writes the tenant's seeds unless this seed version already did. A seed is written when the store has no design
 * of its id, and replaced only while the stored design is still the one seeding wrote; a design the visitor changed
 * stays. Clear data removes `tenants/`, so the next visit seeds again.
 */
export async function seedDesigns(
  fs: StoreFiles,
  files: TenantAPI,
  tenant: string,
  opts: SeedOptions
): Promise<void> {
  const markerAt = `tenants/${tenant}/seeds.json`;
  const kept = await orMissing(fs.readFile(markerAt, 'utf8'));
  const seeded = kept === undefined ? undefined : (JSON.parse(kept) as Seeded);
  if (seeded !== undefined && seeded.version >= opts.version) return;

  const designs = designStore({ tenant, fs });
  const { thumbnails } = tenantLibrary(tenant, fs);
  const written: Record<string, string> = {};
  const images = new Map<string, string>();
  for (const seed of opts.seeds) {
    const stored = await designs.read(seed.id, {});
    const untouched =
      stored !== undefined && seeded?.written[seed.id] === stored.version;
    if (stored !== undefined && !untouched) continue;
    const version = await designs.write(
      seed.id,
      {
        scene: await withTenantImages(
          new TextDecoder().decode(await opts.read(seed.scene)),
          files,
          opts.image,
          images
        )
      },
      {
        cesdkVersion: opts.savedBy,
        title: seed.title,
        ...(stored !== undefined ? { ifMatch: stored.version } : {})
      }
    );
    if (version === undefined) continue;
    await thumbnails.put(
      seed.id,
      version,
      await opts.read(seed.thumbnail),
      seed.size
    );
    written[seed.id] = version;
  }
  await fs.writeFile(
    markerAt,
    JSON.stringify({
      version: opts.version,
      written: { ...seeded?.written, ...written }
    } satisfies Seeded)
  );
}
