// Read this first: one tenant's design assistant. The hosting gives it an executor, a design store, the tenant's
// sources and a gateway; the CoDesign SDK turns those into tools; the agent loop gives the tools to a model on IMG.LY's
// gateway. The code is the same wherever the runner runs: only the hosting's `forTenant` differs.

import {
  imageSizeOf,
  prepareCoDesign,
  type ImageSize
} from '@imgly/codesign-sdk';
import { createDesignAgent } from '../../shared/src/runner/agent.js';

import {
  BRAND_COLORS_SOURCE_ID,
  BRAND_TYPEFACE_SOURCE_ID,
  FILES_SOURCE_ID,
  IMAGE_UPLOAD_SOURCE_ID
} from '../brand/sources.js';
import { TENANT_PROFILES } from '../brand/tenants.js';
import { sessionPlugins } from '../plugins.js';
import type { DesignSize } from '../protocol.js';
import type { ForTenant, OpenSession } from './session.js';

export const openAssistant =
  (forTenant: ForTenant): OpenSession =>
  async ({ init, user, bearer, deliver }) => {
    // Where the executor runs, where designs and files are kept, and who pays the gateway: `src/hosting/<name>/`.
    const hosting = await forTenant(init.tenant, {
      gatewayBaseURL: init.gatewayBaseURL,
      meteringBaseURL: init.meteringBaseURL,
      bearer,
      ...(user !== undefined ? { user } : {})
    });
    await hosting.seed();
    const { gateway } = hosting;

    const codesign = prepareCoDesign({
      // One id per chat: every design of it opens in one executor.
      conversation: init.conversation,
      executors: hosting.executors,
      designs: hosting.designs,
      plugins: sessionPlugins(hosting.plugins),
      // asset_generate, paid as the hosting's model calls are.
      gateway,
      // The agent's `export`: a link where the hosting kept the file, or the file itself, in the chat.
      uploadExport: async ({ design, format, title, mimeType, bytes }) => {
        const name = `${title}.${EXTENSIONS[format] ?? format}`;
        const url = await hosting.keepExport({ design, name, bytes });
        if (url !== undefined) {
          deliver({ name, mimeType, url });
          return { downloadURL: url };
        }
        deliver({ name, mimeType, bytes });
        return {
          note: 'The file is in the chat as a download for the person. There is no link to share.'
        };
      }
    });

    const preview = codesign.tools.find((t) => t.name === 'preview');

    const kept = async (file: File, sourceId: string, size?: ImageSize) => {
      const asset = await hosting.files.upload(sourceId, file, 'upload', size);
      if (asset === undefined) throw new Error(`${file.name} was not kept`);
      return asset;
    };

    return {
      agent: (opts) =>
        createDesignAgent({
          ...opts,
          gatewayBaseURL: gateway.baseURL,
          getApiKey: async () => {
            const token = await gateway.bearer();
            if (token === undefined) throw new Error('no gateway token');
            return token;
          },
          tools: codesign.tools,
          instructions: `${brandRule(init.tenant)}\n\n${codesign.instructions}`
        }),

      // What the designs home and the editor ask for, through the same SDK and store.
      designs: () => hosting.designs.list(),
      // The preview's render: free and size-capped, where a PNG export would be charged.
      async thumbnail(design, version) {
        const kept = await hosting.thumbnails.get(design, version);
        if (kept !== undefined) return kept;
        const first = (await codesign.edit(FIRST_PAGE, { design })).value as
          | (DesignSize & { page: number })
          | undefined;
        const result = await preview?.call(
          {
            design,
            version,
            ...(first !== undefined ? { blockIds: [first.page] } : {})
          },
          {}
        );
        const image = result?.content.find((p) => p.type === 'image');
        if (result?.isError === true || image?.type !== 'image') {
          throw new Error(`no preview of ${design}`);
        }
        const { page: _page, ...size } = first ?? {
          page: 0,
          width: 0,
          height: 0,
          unit: 'Pixel'
        };
        const png = Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0));
        return hosting.thumbnails.put(design, version, png, size);
      },
      async export(design, format, name) {
        const bytes = await codesign.export(format, { design });
        const url = await hosting.keepExport({ design, name, bytes });
        return url !== undefined ? { url } : { bytes };
      },
      read: (design) => hosting.designs.read(design, {}),
      save: (design, content, opts) =>
        hosting.designs.write(design, content, opts),
      // Through the executor's importers; a file that does not open writes nothing.
      async upload(bytes, name) {
        const file = new File([bytes.slice()], name);
        const asset = await kept(file, FILES_SOURCE_ID);
        const { design } = await codesign.create({
          title: name.replace(/\.[a-z0-9]+$/i, ''),
          from: { file: asset, source: FILES_SOURCE_ID }
        });
        return design;
      },
      // As the agent's uploads: kept in the tenant's files and listed first in its image library.
      keepImage: async (file) =>
        kept(
          file,
          IMAGE_UPLOAD_SOURCE_ID,
          imageSizeOf(new Uint8Array(await file.arrayBuffer()), file.type)
        ),
      history: hosting.history,
      ...(hosting.keepPreview !== undefined
        ? { keepPreview: hosting.keepPreview }
        : {})
    };
  };

/** Ahead of the SDK's instructions: whose brand this is, and that its typefaces, colours and logo come from the sources. */
const brandRule = (tenant: string) => {
  const profile = TENANT_PROFILES.find((p) => p.tenantId === tenant);
  return [
    `You work for ${profile?.tenantName ?? tenant}; everything you make is saved to their designs.`,
    ...(profile !== undefined ? [`Their voice: ${profile.voice}`] : []),
    'When the brief mentions the brand, "our", or "my", find the brand’s typefaces, colours and logo with asset_search and use them — never substitute a lookalike font.',
    `${BRAND_TYPEFACE_SOURCE_ID} and ${BRAND_COLORS_SOURCE_ID} hold only this brand’s, labelled by their own names (not the brand’s): search them with no query to list them all.`
  ].join('\n');
};

const EXTENSIONS: Record<string, string> = { jpeg: 'jpg', pdfx: 'pdf' };

const FIRST_PAGE = `const [page] = engine.scene.getPages();
return { page, width: engine.block.getWidth(page), height: engine.block.getHeight(page), unit: engine.scene.getDesignUnit() };`;
