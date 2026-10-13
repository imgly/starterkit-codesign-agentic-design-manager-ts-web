// The demo's two tenants, both fictional, and what their brand is: colours, typefaces (CE.SDK `Typeface`s with a role), a logo and a voice.

import type { Typeface } from '@imgly/codesign-sdk';

/** What the tenant uses a typeface for: headlines, running text, or a flourish. */
export type BrandRole = 'display' | 'body' | 'accent';

/** A CE.SDK typeface, and the role the brand gives it. One per family, each carrying every weight the brand has. */
export interface BrandTypeface extends Typeface {
  role: BrandRole;
}

export interface BrandColor {
  name: string;
  /** `#rrggbb`. */
  hex: string;
}

export { BRAND_TYPEFACES } from './fonts.js';
export { TENANT_LOGOS } from './logos.js';

/** Who exists in this demo. Their fonts come from `fonts.ts`, their logos from `logos.ts`. */
export const TENANT_PROFILES = [
  {
    tenantId: 'nordwind',
    tenantName: 'Nordwind Coffee',
    tagline: 'Roastery, Oslo',
    voice:
      'Warm and plain-spoken, like the person behind the counter: short sentences, concrete origins and tasting notes, no hype.',
    colors: [
      { name: 'Espresso', hex: '#2b1a12' },
      { name: 'Crema', hex: '#e8d9c5' },
      { name: 'Signal', hex: '#d2552b' }
    ]
  },
  {
    tenantId: 'tidewell',
    tenantName: 'Tidewell Botanics',
    tagline: 'Online skincare shop (a fictional brand)',
    voice:
      'Calm and exact: name the ingredient and what it does, give prices and offers plainly, never promise miracles.',
    colors: [
      { name: 'Ink', hex: '#1f2a2e' },
      { name: 'Sand', hex: '#efe6da' },
      { name: 'Amber', hex: '#9a5524' },
      { name: 'Sea Glass', hex: '#7fb5b0' }
    ]
  }
] as const;
