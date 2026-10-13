// Each tenant's logos, drawn in its own brand colours: the one for light backgrounds first, then a light one for dark
// backgrounds. Seeding puts them in the tenant's image library, where the agent finds them by searching "logo".

export interface TenantLogo {
  filename: string;
  svg: string;
}

const nordwind = (circle: string, bean: string, cut: string) =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
    `<circle cx="256" cy="256" r="240" fill="${circle}"/>`,
    '<g transform="rotate(-30 256 256)">',
    `<ellipse cx="256" cy="256" rx="120" ry="170" fill="${bean}"/>`,
    `<path d="M236 104 C300 200 212 312 276 408" fill="none" stroke="${cut}" stroke-width="26" stroke-linecap="round"/>`,
    '</g>',
    '</svg>'
  ].join('');

// A drop of serum over two waves.
const tidewell = (drop: string, wave: string, under: string) =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
    `<path d="M256 40 C330 150 420 240 420 330 A164 164 0 0 1 92 330 C92 240 182 150 256 40 Z" fill="${drop}"/>`,
    `<path d="M120 352 C170 312 214 312 256 344 C298 376 342 376 392 336" fill="none" stroke="${wave}" stroke-width="28" stroke-linecap="round"/>`,
    `<path d="M150 410 C190 382 222 382 256 404 C290 426 322 426 362 398" fill="none" stroke="${under}" stroke-width="22" stroke-linecap="round"/>`,
    '</svg>'
  ].join('');

export const TENANT_LOGOS: Record<string, readonly TenantLogo[]> = {
  nordwind: [
    {
      filename: 'nordwind-coffee-logo.svg',
      svg: nordwind('#2b1a12', '#e8d9c5', '#d2552b')
    },
    {
      filename: 'nordwind-coffee-logo-light-for-dark-backgrounds.svg',
      svg: nordwind('#e8d9c5', '#2b1a12', '#d2552b')
    }
  ],
  tidewell: [
    {
      filename: 'tidewell-botanics-logo.svg',
      svg: tidewell('#9a5524', '#efe6da', '#7fb5b0')
    },
    {
      filename: 'tidewell-botanics-logo-light-for-dark-backgrounds.svg',
      svg: tidewell('#efe6da', '#9a5524', '#7fb5b0')
    }
  ]
};
