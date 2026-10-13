// The two tenants' brand typefaces, copied verbatim from CE.SDK's `ly.img.gfonts` catalogue.

import type { BrandTypeface } from './tenants.js';

export const BRAND_TYPEFACES: Record<string, BrandTypeface[]> = {
  nordwind: [
    {
      name: 'Crimson Text',
      role: 'display',
      fonts: [
        {
          subFamily: 'Regular',
          weight: 'normal',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/crimsontext/wlp2gwHKFkZgtmSR3NB0oRJvbQJSA_JN3Q.woff2'
        },
        {
          subFamily: 'Bold',
          weight: 'bold',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/crimsontext/wlppgwHKFkZgtmSR3NB0oRJX1C12DtlR1LFffg.woff2'
        }
      ]
    },
    {
      name: 'Poppins',
      role: 'body',
      fonts: [
        {
          subFamily: 'Regular',
          weight: 'normal',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/poppins/pxiEyp8kv8JHgFVrFJXUc1NECPY.woff2'
        },
        {
          subFamily: 'Bold',
          weight: 'bold',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/poppins/pxiByp8kv8JHgFVrLCz7V15vFP-KUEg.woff2'
        }
      ]
    },
    {
      name: 'Kalam',
      role: 'accent',
      fonts: [
        {
          subFamily: 'Regular',
          weight: 'normal',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/kalam/YA9dr0Wd4kDdMuhTMibDszkB.woff2'
        },
        {
          subFamily: 'Bold',
          weight: 'bold',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/kalam/YA9Qr0Wd4kDdMtDqHQLOmCUItqGt.woff2'
        }
      ]
    }
  ],
  // Both are variable fonts: one file serves every weight the typeface lists.
  tidewell: [
    {
      name: 'Fraunces',
      role: 'display',
      fonts: [
        {
          subFamily: 'Regular',
          weight: 'normal',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/fraunces/6NUV8FyLNQOQZAnv9awKnugMyM1A.woff2'
        },
        {
          subFamily: 'Bold',
          weight: 'bold',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/fraunces/6NUV8FyLNQOQZAnv9awKnugMyM1A.woff2'
        }
      ]
    },
    {
      name: 'DM Sans',
      role: 'body',
      fonts: [
        {
          subFamily: 'Regular',
          weight: 'normal',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/dmsans/rP2Hp2ywxg089UriOZGCHBeHFl0.woff2'
        },
        {
          subFamily: 'Bold',
          weight: 'bold',
          style: 'normal',
          uri: 'https://cdn.img.ly/packages/imgly/gfonts-data/0.1.0/dist/ly.img.gfonts-data/fonts/dmsans/rP2Hp2ywxg089UriOZGCHBeHFl0.woff2'
        }
      ]
    }
  ]
};
