// The Agentic Design Manager's tools as an MCP server, on the cloud hosting: IMG.LY's executor image, and the tenant's
// designs and files in the store. A server process; nothing in the page imports this folder.
import { randomUUID } from 'node:crypto';

import { prepareCoDesign } from '@imgly/codesign-sdk';

import { sessionPlugins } from '../../../plugins.js';
import { httpFiles } from '../http-files.js';
import { cloudSettings, forTenant } from '../tenant.js';
import { bearerTokens } from './auth.js';
import { mcpHandler } from './server.js';

const EXTENSIONS: Record<string, string> = { jpeg: 'jpg', pdfx: 'pdf' };

export function designPlatformMCP(env: {
  EXECUTOR_URLS?: string;
  VITE_STORE_URL?: string;
  STORE_TOKEN?: string;
  /** `tenant=token,…`: who may call, as `Authorization: Bearer <token>`. */
  MCP_TOKENS?: string;
  /** Your IMG.LY key for the gateway: lets the agent generate images, charged to your IMG.LY account. */
  IMGLY_GATEWAY_API_KEY?: string;
}) {
  const settings = cloudSettings(env);
  const files = httpFiles({
    url: settings.store,
    ...(settings.token !== undefined ? { token: settings.token } : {})
  });
  const gatewayKey = env.IMGLY_GATEWAY_API_KEY || undefined;
  return mcpHandler({
    authenticate: bearerTokens(env.MCP_TOKENS ?? ''),
    async prepare(caller, conversation) {
      // The page's gateway arguments: the cloud hosting does not use them; this server's own key is below.
      const at = await forTenant(caller.tenant, {
        gatewayBaseURL: '',
        meteringBaseURL: '',
        bearer: async () => undefined
      });
      return prepareCoDesign({
        conversation,
        // Exports run on the executor image and are charged to the CoDesign licence key it runs with. A server
        // cannot ask the person first: the MCP client's approval of each tool call is that confirmation.
        executors: at.executors,
        designs: at.designs,
        plugins: sessionPlugins(at.plugins),
        gateway:
          gatewayKey !== undefined ? { bearer: async () => gatewayKey } : false,
        // An MCP client cannot take a download: the file goes to the store, and the model gets its link.
        async uploadExport({ design, format, bytes }) {
          const path = `tenants/${caller.tenant}/exports/${design}/${randomUUID()}.${EXTENSIONS[format] ?? format}`;
          await files.writeFile(path, bytes);
          return { downloadURL: `${settings.store}/${path}` };
        }
      });
    }
  });
}
