// A first visit's data: the demo tenants' brands and logos, as the tenant plugin reads them from the store.

import { imageSizeOf } from '@imgly/codesign-sdk';

import {
  BRAND_TYPEFACES,
  TENANT_LOGOS,
  TENANT_PROFILES
} from '../brand/tenants.js';
import {
  BRAND_COLORS_SOURCE_ID,
  BRAND_TYPEFACE_SOURCE_ID,
  FILES_SOURCE_ID,
  FONT_UPLOAD_SOURCE_ID,
  IMAGE_UPLOAD_SOURCE_ID,
  type AssetResult,
  type TenantAPI
} from '../brand/sources.js';
import { orMissing, type StoreFiles } from './tenant-api.js';

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const channel = (hex: string, at: number) =>
  parseInt(hex.slice(at, at + 2), 16) / 255;

/** The brand sources' records: CE.SDK assets with a typeface or colour payload; none yet for imports and fonts. */
function brandRecords(tenantId: string): Record<string, AssetResult[]> {
  const profile = TENANT_PROFILES.find((p) => p.tenantId === tenantId);
  return {
    [FILES_SOURCE_ID]: [],
    [FONT_UPLOAD_SOURCE_ID]: [],
    [BRAND_TYPEFACE_SOURCE_ID]: (BRAND_TYPEFACES[tenantId] ?? []).map(
      ({ name, role, fonts }) => ({
        id: slug(name),
        label: name,
        groups: [role],
        tags: [role],
        payload: { typeface: { name, fonts } }
      })
    ),
    [BRAND_COLORS_SOURCE_ID]: (profile?.colors ?? []).map(({ name, hex }) => ({
      id: slug(name),
      label: name,
      meta: { hex },
      payload: {
        color: {
          colorSpace: 'sRGB',
          r: channel(hex, 1),
          g: channel(hex, 3),
          b: channel(hex, 5)
        }
      }
    }))
  };
}

/** Gives every image the library kept without a size the size its bytes say: records written before every image asset carried one. */
async function sizeImages(
  fs: StoreFiles,
  tenantId: string,
  api: TenantAPI
): Promise<void> {
  const path = `tenants/${tenantId}/sources/${IMAGE_UPLOAD_SOURCE_ID}.json`;
  const text = await orMissing(fs.readFile(path, 'utf8'));
  if (text === undefined) return;
  const records = JSON.parse(text) as AssetResult[];
  let changed = false;
  const sized = await Promise.all(
    records.map(async (asset) => {
      const { uri, mimeType, width, height } = asset.meta ?? {};
      if (width !== undefined && height !== undefined) return asset;
      if (typeof uri !== 'string' || typeof mimeType !== 'string') return asset;
      const size = imageSizeOf(
        await api.bytes(uri).catch(() => new Uint8Array()),
        mimeType
      );
      if (size === undefined) return asset;
      changed = true;
      return { ...asset, meta: { ...asset.meta, ...size } };
    })
  );
  if (changed) await fs.writeFile(path, JSON.stringify(sized));
}

/** Writes each demo tenant's brand records and logos, unless that tenant already has them. */
export async function seedTenants(
  fs: StoreFiles,
  apiFor: (tenant: string) => TenantAPI
): Promise<void> {
  const missing = async (path: string) =>
    (await orMissing(fs.readFile(path))) === undefined;
  for (const { tenantId } of TENANT_PROFILES) {
    const sources = `tenants/${tenantId}/sources`;
    for (const [sourceId, records] of Object.entries(brandRecords(tenantId))) {
      if (await missing(`${sources}/${sourceId}.json`)) {
        await fs.writeFile(
          `${sources}/${sourceId}.json`,
          JSON.stringify(records)
        );
      }
    }
    if (await missing(`${sources}/${IMAGE_UPLOAD_SOURCE_ID}.json`)) {
      // The plugin's own upload: the same file name, record and listing a person's upload gets; the logo for light
      // backgrounds listed first.
      for (const logo of [...(TENANT_LOGOS[tenantId] ?? [])].reverse()) {
        await apiFor(tenantId).upload(
          IMAGE_UPLOAD_SOURCE_ID,
          new File([logo.svg], logo.filename, { type: 'image/svg+xml' }),
          'upload',
          imageSizeOf(new TextEncoder().encode(logo.svg), 'image/svg+xml')
        );
      }
    }
    await sizeImages(fs, tenantId, apiFor(tenantId));
  }
}
