// Each brand's starter designs, made by scripts/build-seeds.mjs.

import nordwindBarista from '../../seeds/images/nordwind-barista.jpg?url';
import nordwindIcedLatte from '../../seeds/images/nordwind-iced-latte.png?url';
import tidewellSerumBottle from '../../seeds/images/tidewell-serum-bottle.png?url';
import tidewellSerumShadows from '../../seeds/images/tidewell-serum-shadows.jpg?url';
import { TENANT_LOGOS } from './logos.js';
import nordwindAdThumb from './seeds/nordwind-autumn-roast-ad.png?url';
import nordwindAdScene from './seeds/nordwind-autumn-roast-ad.scene?url';
import nordwindPosterThumb from './seeds/nordwind-opening-poster.png?url';
import nordwindPosterScene from './seeds/nordwind-opening-poster.scene?url';
import tidewellBannerThumb from './seeds/tidewell-serum-banner.png?url';
import tidewellBannerScene from './seeds/tidewell-serum-banner.scene?url';
import tidewellSaleThumb from './seeds/tidewell-serum-sale.png?url';
import tidewellSaleScene from './seeds/tidewell-serum-sale.scene?url';
import type { SeedDesign } from '../store/seed-designs.js';

/** Raise it after changing a seed: a brand seeded at a lower version gets the new seeds. */
export const SEED_VERSION = 2;

/** The photos the seeds' scenes name, by file name; the brand's logos are the others. */
export const SEED_PHOTOS: Record<string, string> = {
  'nordwind-barista.jpg': nordwindBarista,
  'nordwind-iced-latte.png': nordwindIcedLatte,
  'tidewell-serum-bottle.png': tidewellSerumBottle,
  'tidewell-serum-shadows.jpg': tidewellSerumShadows
};

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png'
};

/** The CE.SDK that saved the scenes: the build script's `@cesdk/node`. */
export const SEEDS_SAVED_BY = '1.83.0';

export type BrandSeed = SeedDesign;

const px = (width: number, height: number) => ({
  width,
  height,
  unit: 'Pixel'
});

export const BRAND_SEEDS: Record<string, readonly BrandSeed[]> = {
  nordwind: [
    {
      id: 'seed-nordwind-autumn-roast-ad',
      title: 'Autumn Roast ad',
      scene: nordwindAdScene,
      thumbnail: nordwindAdThumb,
      size: px(1080, 1350)
    },
    {
      id: 'seed-nordwind-opening-poster',
      title: 'Opening poster',
      scene: nordwindPosterScene,
      thumbnail: nordwindPosterThumb,
      size: { width: 210, height: 297, unit: 'Millimeter' }
    }
  ],
  tidewell: [
    {
      id: 'seed-tidewell-serum-sale',
      title: 'Serum sale post',
      scene: tidewellSaleScene,
      thumbnail: tidewellSaleThumb,
      size: px(1080, 1080)
    },
    {
      id: 'seed-tidewell-serum-banner',
      title: 'Serum web banner',
      scene: tidewellBannerScene,
      thumbnail: tidewellBannerThumb,
      size: px(1200, 628)
    }
  ]
};

const fetchBundled = async (url: string) =>
  new Uint8Array(await (await fetch(url)).arrayBuffer());

/** The seeding options for a brand's hosting; `read` gets a bundled file by its URL, fetching it unless told how. */
export const brandSeeds = (tenant: string, read = fetchBundled) => ({
  seeds: BRAND_SEEDS[tenant] ?? [],
  version: SEED_VERSION,
  savedBy: SEEDS_SAVED_BY,
  read,
  async image(file: string): Promise<File> {
    const logo = TENANT_LOGOS[tenant]?.find((l) => l.filename === file);
    if (logo !== undefined) {
      return new File([logo.svg], file, { type: 'image/svg+xml' });
    }
    const url = SEED_PHOTOS[file];
    if (url === undefined) throw new Error(`no seed image ${file}`);
    return new File([await read(url)], file, {
      type: IMAGE_TYPES[file.split('.').pop() ?? ''] ?? ''
    });
  }
});

/** A chip's request about a seed, naming it the way the card's “ask” does, so the model knows which design. */
export const askAbout = (seed: BrandSeed, ask: string) =>
  `About “${seed.title}” (design ${seed.id}): ${ask}`;
