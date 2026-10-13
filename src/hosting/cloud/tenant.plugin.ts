// The tenant's sources on an engine, over the cloud store: the module the executor receives as text, and the editor applies.
// Imports types only and nothing outside this demo: `pnpm run generate:plugin` bundles it into `tenant-plugin.generated.ts`.

import { tenantSources, type TenantSource } from '../../brand/sources.js';
import { tenantAPI } from '../../store/tenant-api.js';
import {
  filesURI,
  httpFiles,
  type CloudTenantPluginOptions
} from './http-files.js';

interface Engine {
  asset: { addSource(source: TenantSource): void };
}

/** The same file a browser editor applies with `cesdk.engine.addPlugin`. Its files are plain URLs the engine fetches. */
export default function tenantPlugin(options: CloudTenantPluginOptions) {
  const fs = httpFiles({
    url: options.store,
    ...(options.token !== undefined ? { token: options.token } : {})
  });
  return {
    name: 'demo.tenant',
    version: '4.0.0',
    initialize({ engine }: { engine: Engine }) {
      const api = tenantAPI(fs, {
        tenant: options.tenant,
        files: filesURI(options.store, options.tenant)
      });
      for (const source of tenantSources(api)) {
        engine.asset.addSource(source);
      }
    }
  };
}
