// Serves the MCP route at http://127.0.0.1:<MCP_PORT>/mcp, with its settings from `.env`. Online, an HTTPS proxy goes in front.
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';

import { designPlatformMCP } from './index.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const port = Number(process.env.MCP_PORT ?? 8791);
const handler = designPlatformMCP(process.env);
createServer((req, res) => {
  if (new URL(req.url ?? '/', 'http://x').pathname !== '/mcp') {
    res.writeHead(404).end();
    return;
  }
  handler(req, res).catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500).end();
  });
}).listen(port, '127.0.0.1', () =>
  console.log(`MCP server: http://127.0.0.1:${port}/mcp`)
);
