// Bundles each hosting's `src/hosting/<name>/tenant.plugin.ts` into one module's text, as the executor receives it.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const hostings = new URL('../src/hosting/', import.meta.url);

/** The plugin entries there are: one per hosting that sends the tenant's sources to an engine. */
export const pluginEntries = () =>
  readdirSync(hostings, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => new URL(`${d.name}/tenant.plugin.ts`, hostings))
    .filter((entry) => existsSync(entry));

/** The module text of one entry: bundled, its types stripped. */
export async function pluginText(entry) {
  const out = await build({
    entryPoints: [fileURLToPath(entry)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    legalComments: 'none',
    write: false
  });
  return out.outputFiles[0].text;
}

export const generatedAt = (entry) =>
  new URL('tenant-plugin.generated.ts', entry);

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const entry of pluginEntries()) {
    writeFileSync(
      generatedAt(entry),
      `// Generated from tenant.plugin.ts by \`pnpm run generate:plugin\`; do not edit.\n\nexport const TENANT_PLUGIN_MODULE = ${JSON.stringify(await pluginText(entry))};\n`
    );
  }
}
