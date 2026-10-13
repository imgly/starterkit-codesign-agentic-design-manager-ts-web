// The design tools as a remote MCP server, over Streamable HTTP: one prepareCoDesign per MCP session.
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { CoDesign } from '@imgly/codesign-sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  isInitializeRequest,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';

/** Who is calling: what your sign-in says about the token's owner. */
export interface Caller {
  tenant: string;
  user: string;
}

/** One MCP server for one CoDesign: its tools, and its instructions as the server's. Each `design` a call names goes in `named`. */
export function mcpServerFor(
  codesign: CoDesign,
  named = new Set<string>()
): McpServer {
  const mcp = new McpServer(
    { name: 'agentic-design-manager', version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: codesign.instructions }
  );
  // The tools carry JSON Schema already, so they are served as they are rather than through `registerTool`'s zod.
  mcp.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: codesign.tools.map(
      ({ name, description, inputSchema, annotations }): Tool => ({
        name,
        description,
        inputSchema: inputSchema as Tool['inputSchema'],
        annotations
      })
    )
  }));
  mcp.server.setRequestHandler(
    CallToolRequestSchema,
    async ({ params }, { signal }): Promise<CallToolResult> => {
      const tool = codesign.tools.find((t) => t.name === params.name);
      if (tool === undefined) return failed(`There is no tool ${params.name}.`);
      const design = params.arguments?.design;
      if (typeof design === 'string') named.add(design);
      try {
        // A refusal the model can act on comes back as an `isError` result; a cancelled call aborts `signal`.
        return await tool.call(params.arguments ?? {}, { signal });
      } catch (error) {
        // Nothing the model can fix (no credits, an executor or your store down): yours to log and alert on.
        console.error(`${params.name} failed:`, error);
        return failed(
          `The design service could not finish ${params.name}. Tell the person; trying again now will not help.`
        );
      }
    }
  );
  return mcp;
}

const failed = (text: string): CallToolResult => ({
  isError: true,
  content: [{ type: 'text', text }]
});

/** Your HTTP route for MCP clients: `(req, res) => …` for `node:http`, Express, or any Node server. */
export function mcpHandler(opts: {
  /** Yours: the caller this request's credentials name, or `undefined` to answer 401. */
  authenticate(req: IncomingMessage): Promise<Caller | undefined>;
  /** Yours: the design tools for a caller, in a conversation of its own for each MCP session. */
  prepare(caller: Caller, conversation: string): Promise<CoDesign>;
  /** Where clients learn how to sign in (OAuth protected-resource metadata), sent with every 401. */
  resourceMetadata?: string;
}): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const sessions = new Map<
    string,
    { caller: Caller; transport: StreamableHTTPServerTransport }
  >();
  return async (req, res) => {
    const caller = await opts.authenticate(req);
    if (caller === undefined) {
      res
        .writeHead(401, {
          'www-authenticate':
            opts.resourceMetadata !== undefined
              ? `Bearer resource_metadata="${opts.resourceMetadata}"`
              : 'Bearer'
        })
        .end();
      return;
    }
    const id = req.headers['mcp-session-id'];
    let session = typeof id === 'string' ? sessions.get(id) : undefined;
    // A session id is no credential: another caller holding it finds nothing.
    if (
      session !== undefined &&
      (session.caller.tenant !== caller.tenant ||
        session.caller.user !== caller.user)
    ) {
      session = undefined;
    }
    let body: unknown;
    try {
      body = req.method === 'POST' ? await readJSON(req) : undefined;
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (session === undefined) {
      if (id !== undefined || !isInitializeRequest(body)) {
        res.writeHead(id !== undefined ? 404 : 400).end();
        return;
      }
      const sessionId = randomUUID();
      const codesign = await opts.prepare(
        caller,
        `${caller.tenant}.${sessionId}`
      );
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId
      });
      const named = new Set<string>();
      transport.onclose = () => {
        sessions.delete(sessionId);
        for (const design of named)
          void codesign.release({ design }).catch(() => undefined);
      };
      await mcpServerFor(codesign, named).connect(transport);
      session = { caller, transport };
      sessions.set(sessionId, session);
    }
    await session.transport.handleRequest(req, res, body);
  };
}

async function readJSON(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text === '' ? undefined : (JSON.parse(text) as unknown);
}
