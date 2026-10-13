// Yours to replace: who is calling the MCP server. This version knows a fixed token per tenant; your product checks a
// token its own sign-in issued, and with MCP's OAuth that sign-in is the authorization server the client signs in at.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import type { Caller } from './server.js';

/** `spec` is `tenant=token,…`; the caller is the tenant whose token the request carries as `Authorization: Bearer`. */
export function bearerTokens(
  spec: string
): (req: IncomingMessage) => Promise<Caller | undefined> {
  const digest = (token: string) => createHash('sha256').update(token).digest();
  const known = spec
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair.indexOf('=') > 0)
    .map((pair) => {
      const at = pair.indexOf('=');
      return {
        tenant: pair.slice(0, at),
        digest: digest(pair.slice(at + 1))
      };
    });
  return async (req) => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (token === undefined) return undefined;
    const presented = digest(token);
    const match = known.find((k) => timingSafeEqual(k.digest, presented));
    return match && { tenant: match.tenant, user: match.tenant };
  };
}
