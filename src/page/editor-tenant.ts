// The editor for one of the demo's tenants: its sessions' plugins, its files as the hosting keeps them, its brand in the panels.

import type { AssetDefinition } from '@cesdk/engine';
import type { EditorModalOptions } from '../../shared/src/editor-modal/index.js';

import {
  BRAND_COLORS_SOURCE_ID,
  BRAND_TYPEFACE_SOURCE_ID,
  IMAGE_UPLOAD_SOURCE_ID,
  type AssetResult
} from '../brand/sources.js';
import { editorPlugins } from '../hosting.js';
import { sessionPlugins } from '../plugins.js';

/** `keep`: where a person's image goes, the runner, which keeps it as the agent's uploads. */
export function tenantEditor(
  tenant: string,
  keep: (file: File) => Promise<AssetResult>
): Pick<EditorModalOptions, 'plugins' | 'libraries' | 'upload'> {
  return {
    async upload(file) {
      const { label, tags, ...rest } = await keep(file);
      return {
        ...rest,
        ...(label !== undefined ? { label: { en: label } } : {}),
        ...(tags !== undefined ? { tags: { en: tags } } : {})
      } as AssetDefinition;
    },
    plugins: sessionPlugins(editorPlugins(tenant)),
    libraries: {
      typefaces: [BRAND_TYPEFACE_SOURCE_ID, 'ly.img.gfonts'],
      colors: [BRAND_COLORS_SOURCE_ID],
      images: [IMAGE_UPLOAD_SOURCE_ID, 'ly.img.image'],
      brand: [IMAGE_UPLOAD_SOURCE_ID],
      titles: {
        [BRAND_TYPEFACE_SOURCE_ID]: 'Brand fonts',
        [BRAND_COLORS_SOURCE_ID]: 'Brand colours',
        [IMAGE_UPLOAD_SOURCE_ID]: 'Your library',
        'ly.img.gfonts': 'Google Fonts'
      }
    }
  };
}
