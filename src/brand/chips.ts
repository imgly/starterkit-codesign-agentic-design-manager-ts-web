// The chat's example prompts: one per job to be done that the demo can do, each about a brand's seed or its brand
// kit. Video jobs are left out (the executor encodes no video), and so is import, which is the Upload button.

import { askAbout, BRAND_SEEDS } from './seeds.js';

export interface Chip {
  /** The job to be done the prompt shows. */
  job: string;
  /** The seed it is about; none for a prompt about the brand. */
  design?: string;
  ask: string;
}

export const BRAND_CHIPS: Record<string, readonly Chip[]> = {
  nordwind: [
    {
      job: 'Resize',
      design: 'seed-nordwind-autumn-roast-ad',
      ask: 'Resize it to an Instagram story and a 1200×628 web banner.'
    },
    {
      job: 'Localize',
      design: 'seed-nordwind-opening-poster',
      ask: 'Translate it to Norwegian and German, one design per language.'
    },
    {
      job: 'Print-ready',
      design: 'seed-nordwind-opening-poster',
      ask: 'Make it print-ready: a PDF/X with 3 mm bleed.'
    }
  ],
  tidewell: [
    {
      job: 'Variants',
      design: 'seed-tidewell-serum-sale',
      ask: 'Make 3 variants with different value propositions for an A/B test.'
    },
    {
      job: 'Copy swap',
      design: 'seed-tidewell-serum-banner',
      ask: 'The price is now €29 and the button says “Try it tonight”.'
    },
    {
      job: 'Rebrand',
      design: 'seed-tidewell-serum-sale',
      ask: 'Rebrand it for our Tidewell Men line: Ink and Sea Glass only, no Amber.'
    },
    {
      job: 'Generate',
      ask: 'Create a 4:5 launch post for our new Sea Glass hydrating mist, €24.'
    }
  ]
};

/** The text a chip puts in the input: about its seed by title and design id, as a card's ask does. */
export function chipPrompt(tenant: string, chip: Chip): string {
  const seed = BRAND_SEEDS[tenant]?.find((s) => s.id === chip.design);
  return seed === undefined ? chip.ask : askAbout(seed, chip.ask);
}

/** The chip's label: the job, and the seed it is about. */
export function chipLabel(tenant: string, chip: Chip): string {
  const seed = BRAND_SEEDS[tenant]?.find((s) => s.id === chip.design);
  return `${chip.job} · ${seed?.title ?? 'new design'}: ${chip.ask}`;
}
