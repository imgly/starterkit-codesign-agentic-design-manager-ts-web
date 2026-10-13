// A tenant's asset sources over whatever keeps its records and files: brand fonts and colours, its images, imported
// fonts, attached files and its designs. Hosting-neutral: each hosting supplies the `TenantAPI` they read.
// Imports types only: it is bundled into the plugin module text the executor receives.

import type {
  ASSET_MIME_TYPES as SDK_ASSET_MIME_TYPES,
  AssetPayload,
  ImageSize,
  AssetQueryData,
  AssetResult as SDKAssetResult,
  AssetsQueryResult as SDKAssetsQueryResult,
  SupportedMimeType,
  UploadAction,
  UploadFileOptions
} from '@imgly/codesign-sdk';

/** CE.SDK's `AssetResult` with the payloads this product uses: the SDK's copy types the presets `unknown`, which CE.SDK's own type refuses. */
export type AssetResult = Omit<SDKAssetResult, 'payload'> & {
  payload?: Pick<AssetPayload, 'typeface' | 'color'>;
};
export type AssetsQueryResult = SDKAssetsQueryResult<AssetResult>;

export const BRAND_TYPEFACE_SOURCE_ID = 'demo.brand.typeface';
export const BRAND_COLORS_SOURCE_ID = 'demo.brand.colors';
export const IMAGE_UPLOAD_SOURCE_ID = 'demo.tenant.image.upload';
export const FONT_UPLOAD_SOURCE_ID = 'demo.tenant.fonts';
export const FILES_SOURCE_ID = 'demo.tenant.files';
export const DESIGNS_SOURCE_ID = 'demo.designs';

/** The SDK's `ASSET_MIME_TYPES` for assets backed by a payload, not a file: this module imports no values, so it spells them. */
export const ASSET_MIME_TYPES = {
  typeface: 'application/ubq-typeface',
  color: 'application/ubq-color'
} as const satisfies Pick<typeof SDK_ASSET_MIME_TYPES, 'typeface' | 'color'>;

/** Files `import` opens. A wildcard never covers one: `image/*` is no Photoshop file. */
export const IMPORTED_FILE_TYPES: SupportedMimeType[] = [
  'application/pdf',
  'image/vnd.adobe.photoshop',
  'application/vnd.adobe.indesign-idml-package',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip'
];

/** What the image library lists: the images a browser can show. */
export const LISTED_IMAGE_TYPES: SupportedMimeType[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml'
];

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== '');

/** Every word of `query` appears in the asset's label or tags, in any case. */
export function assetMatches(asset: AssetResult, query: string): boolean {
  const have = words([asset.label ?? '', ...(asset.tags ?? [])].join(' '));
  return words(query).every((w) => have.some((h) => h.includes(w)));
}

/** CE.SDK's query over a list in memory: matched by `query`, `tags` and `groups`, then one page of it. */
export function page(
  all: readonly AssetResult[],
  q: AssetQueryData
): AssetsQueryResult {
  const tags = q.tags === undefined ? [] : [q.tags].flat();
  const hits = all.filter(
    (asset) =>
      assetMatches(asset, q.query ?? '') &&
      tags.every((tag) => asset.tags?.includes(tag)) &&
      (q.groups === undefined ||
        q.groups.length === 0 ||
        q.groups.some((group) => asset.groups?.includes(group)))
  );
  const start = q.page * q.perPage;
  return {
    assets: hits.slice(start, start + q.perPage),
    total: hits.length,
    currentPage: q.page,
    ...(start + q.perPage < hits.length ? { nextPage: q.page + 1 } : {})
  };
}

/** A collection of the tenant's, as a CE.SDK `AssetSource` and the SDK's `CoDesignAssetSource`. */
export interface TenantSource {
  id: string;
  /** One line for the model: what it holds, and when to prefer it. */
  description: string;
  /** What it holds and may be offered: file types, or a payload's `ASSET_MIME_TYPES`. The SDK derives its roles from them. */
  getSupportedMimeTypes(): SupportedMimeType[];
  /** Throws while the collection cannot be read. */
  findAssets(query: AssetQueryData): Promise<AssetsQueryResult>;
  /** `null` for an id this tenant does not have. */
  fetchAsset(id: string): Promise<AssetResult | null>;
  /** Where the engine fetches a uri this tenant's files have; `undefined` for any other uri. */
  resolve(uri: string): string | undefined | Promise<string | undefined>;
  /** Store a new file and return the asset that places it, or decline it with `undefined`: not this source's. */
  uploadFile?(
    file: File,
    opts: UploadFileOptions
  ): Promise<AssetResult | undefined>;
}

/** What every source is built over: one tenant's records and files. */
export interface TenantAPI {
  find(sourceId: string, q: AssetQueryData): Promise<AssetsQueryResult>;
  get(sourceId: string, id: string): Promise<AssetResult | null>;
  /** `size`: an image's, to keep as `meta.width` and `meta.height`; every image asset carries it. */
  upload(
    sourceId: string,
    file: File,
    action: UploadAction,
    size?: ImageSize
  ): Promise<AssetResult | undefined>;
  url(uri: string): string | undefined | Promise<string | undefined>;
  bytes(uri: string): Promise<Uint8Array>;
}

/** A source over the tenant's records; `mimeType` marks a payload-backed asset. */
function recordsSource(
  api: TenantAPI,
  source: Omit<
    TenantSource,
    'findAssets' | 'fetchAsset' | 'resolve' | 'uploadFile'
  >,
  opts: { mimeType?: string; writable?: boolean } = {}
): TenantSource {
  const typed = (asset: AssetResult): AssetResult =>
    opts.mimeType === undefined
      ? asset
      : { ...asset, meta: { ...asset.meta, mimeType: opts.mimeType } };
  return {
    ...source,
    findAssets: async (q) => {
      const found = await api.find(source.id, q);
      return { ...found, assets: found.assets.map(typed) };
    },
    fetchAsset: async (id) => {
      const found = await api.get(source.id, id);
      return found === null ? null : typed(found);
    },
    resolve: api.url,
    ...(opts.writable === true
      ? {
          // The SDK tells an image's size, read from its bytes.
          uploadFile: (
            file: File,
            { action, width, height }: UploadFileOptions
          ) =>
            api.upload(
              source.id,
              file,
              action,
              width !== undefined && height !== undefined
                ? { width, height }
                : undefined
            )
        }
      : {})
  };
}

/** The tenant's sources, in the order a new file is offered to them and a font is looked up. */
export function tenantSources(api: TenantAPI): TenantSource[] {
  return [
    recordsSource(
      api,
      {
        id: BRAND_TYPEFACE_SOURCE_ID,
        description:
          "the brand's font families, each with every weight it has; its group names its role (display, body, accent)",
        getSupportedMimeTypes: () => [ASSET_MIME_TYPES.typeface]
      },
      { mimeType: ASSET_MIME_TYPES.typeface }
    ),
    recordsSource(
      api,
      {
        id: BRAND_COLORS_SOURCE_ID,
        description: "the brand's colours, by name",
        getSupportedMimeTypes: () => [ASSET_MIME_TYPES.color]
      },
      { mimeType: ASSET_MIME_TYPES.color }
    ),
    recordsSource(
      api,
      {
        id: IMAGE_UPLOAD_SOURCE_ID,
        description:
          "this customer's image library: their logo, every picture they uploaded and every image you generated, labelled by filename, newest first",
        // Video, audio and a transcript land here too, kept but not listed.
        getSupportedMimeTypes: () => [
          ...LISTED_IMAGE_TYPES,
          'video/*',
          'audio/*',
          'application/json'
        ]
      },
      { writable: true }
    ),
    recordsSource(
      api,
      {
        id: FONT_UPLOAD_SOURCE_ID,
        description:
          'fonts that files the person imported carried; it lists none of them',
        getSupportedMimeTypes: () => [
          'font/ttf',
          'font/otf',
          'font/woff',
          'font/woff2'
        ]
      },
      { writable: true }
    ),
    {
      ...recordsSource(api, {
        id: FILES_SOURCE_ID,
        description:
          'files the person brought (Photoshop, InDesign, PowerPoint, PDF, .imgly), newest first, by filename; import one to work on it',
        getSupportedMimeTypes: () => [...IMPORTED_FILE_TYPES]
      }),
      // Only a person brings files, and a person never works on an engine.
      uploadFile: async () => undefined
    },
    // The tenant's designs, by title: the editor's "your designs" panel, and the list the agent's `designs` tool searches.
    recordsSource(api, {
      id: DESIGNS_SOURCE_ID,
      description: "this customer's designs, by title",
      getSupportedMimeTypes: () => []
    })
  ];
}
