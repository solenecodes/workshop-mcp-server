import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AuthenticationError, type Identity, type VerifyToken } from './auth.js';
import { SourceError, ticketIdSchema, type Sources } from './sources.js';
import { parkingLotRouter, type createParkingLot } from './parking-lot.js';

const ticketsSource = { name: 'Contoso Tickets REST API', kind: 'internal-api', storage: 'SQLite', synthetic: true };
const result = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data,
});
const schemas = {
  list_tickets: z.object({}).strict(),
  get_ticket: z.object({ ticketId: ticketIdSchema }).strict(),
};
const descriptions = {
  list_tickets: 'List the Contoso support tickets: id, title, severity, status and affected service. Does not change data.',
  get_ticket: 'Read one Contoso support ticket by its identifier, for example CT-1001. Does not change data.',
};
type ToolName = keyof typeof schemas;

export interface SandboxOptions {
  sources: Sources;
  verifyToken?: VerifyToken;
  host?: string;
  publicUrl?: string;
  consoleOrigin?: string;
  parkingLot?: ReturnType<typeof createParkingLot>;
  requestLimit?: number;
  now?: () => number;
  log?: (entry: Record<string, unknown>) => void;
}

export function createSandboxApp(options: SandboxOptions) {
  const { sources, verifyToken, host = '127.0.0.1', requestLimit = 600, now = Date.now,
    log = (entry) => console.log(JSON.stringify(entry)) } = options;
  const publicUrl = options.publicUrl ? new URL(options.publicUrl) : undefined;
  if (publicUrl && (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password ||
      publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/mcp')) {
    throw new Error('PUBLIC_MCP_URL must be an HTTPS /mcp URL without credentials, query or fragment.');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !publicUrl) {
    throw new Error('A non-loopback bind requires PUBLIC_MCP_URL for explicit Host validation.');
  }
  if (options.consoleOrigin) {
    const origin = new URL(options.consoleOrigin);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
    if (verifyToken || origin.origin !== options.consoleOrigin ||
        (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:'))) {
      throw new Error('The browser console requires an exact HTTPS origin (or loopback HTTP), on the public read-only endpoint only.');
    }
  }
  const app = createMcpExpressApp({
    host, ...(publicUrl ? { allowedHosts: [publicUrl.hostname, '127.0.0.1', 'localhost', '[::1]'] } : {}),
  });
  app.disable('x-powered-by');
  if (verifyToken && options.parkingLot) throw new Error('The shared parking lot belongs on the public endpoint only.');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin) {
      res.vary('Origin');
      const parking = Boolean(options.parkingLot) && /^\/parking-lot(?:\/[^/]+)?\/?$/.test(req.path);
      const methods = parking ? ['GET', 'POST', 'PATCH', 'DELETE'] : ['POST'];
      if (req.headers.origin !== options.consoleOrigin || (req.path !== '/mcp' && !parking) ||
          ![...methods, 'OPTIONS'].includes(req.method) || req.headers.authorization) {
        res.status(403).json({ error: 'BROWSER_ORIGIN_DENIED', message: 'Use the approved public workshop console or the terminal client.' });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', options.consoleOrigin);
      res.setHeader('Access-Control-Expose-Headers', 'Retry-After, Mcp-Session-Id');
      if (req.method === 'OPTIONS') {
        const headers = (req.get('access-control-request-headers') ?? '').toLowerCase().split(',').map((header) => header.trim()).filter(Boolean);
        if (!methods.includes(req.get('access-control-request-method') ?? '') ||
            headers.some((header) => !['content-type', 'mcp-protocol-version', 'mcp-session-id'].includes(header))) {
          res.status(403).json({ error: 'CONSOLE_PREFLIGHT_DENIED' });
          return;
        }
        res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Protocol-Version, Mcp-Session-Id');
        res.setHeader('Access-Control-Max-Age', '600');
        res.status(204).end();
        return;
      }
    }
    next();
  });
  if (options.parkingLot) app.use('/parking-lot', parkingLotRouter(options.parkingLot));
  app.get('/health', (_req, res) => res.json({
    status: 'ok', mode: verifyToken ? 'protected-entra' : 'public-read-only',
    syntheticCustomerData: true, sources: ['contoso-tickets-api'],
  }));
  let windowStart = now();
  let requestCount = 0;
  let activeRequests = 0;
  app.post('/mcp', async (req, res) => {
    const method = typeof req.body?.method === 'string' ? req.body.method : 'unknown';
    const toolName = method === 'tools/call' && typeof req.body?.params?.name === 'string' ? req.body.params.name : undefined;
    let identity: Identity | undefined;
    let decision = 'denied';
    let code: string | undefined;
    let redactedFields: string[] = [];
    res.once('finish', () => log({
      timestamp: new Date(now()).toISOString(), userId: identity?.userId ?? 'anonymous',
      method, ...(toolName ? { toolName } : {}), decision, ...(code ? { code } : {}), redactedFields,
    }));
    // Fixed-size global counters bound cost without trusting spoofable proxy/client IP headers.
    if (now() - windowStart >= 60_000) { windowStart = now(); requestCount = 0; }
    requestCount++;
    if (requestCount > requestLimit || activeRequests >= 32) {
      code = 'RATE_LIMITED';
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: code, message: 'Shared workshop capacity reached. Retry in one minute.' });
      return;
    }
    activeRequests++;
    const release = () => { activeRequests--; };
    res.once('close', release);
    if (verifyToken) {
      try {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ') || !header.slice(7).trim()) throw new AuthenticationError(401, 'MISSING_ACCESS_TOKEN');
        identity = await verifyToken(header.slice(7));
      } catch (error) {
        if (!(error instanceof AuthenticationError)) console.error('Identity verification failed unexpectedly.');
        const status = error instanceof AuthenticationError ? error.status : 503;
        code = error instanceof AuthenticationError ? error.code : 'IDENTITY_SERVICE_UNAVAILABLE';
        if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="mcp-workshop"');
        res.status(status).json({ error: code, message: 'Use a tenant-issued access token for this API with Mcp.Read permission.' });
        return;
      }
    }
    const server = new McpServer({ name: 'contoso-tickets-mcp', version: '1.0.0' });
    for (const name of Object.keys(schemas) as ToolName[]) {
      server.registerTool(name, {
        description: descriptions[name], inputSchema: schemas[name],
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      }, async (args: Record<string, unknown>) => {
        try {
          let data: Record<string, unknown>;
          if (name === 'list_tickets') {
            schemas.list_tickets.parse(args);
            data = { tickets: await sources.listTickets(), sources: [ticketsSource] };
          } else if (name === 'get_ticket') {
            data = { ticket: await sources.ticket(schemas.get_ticket.parse(args).ticketId), sources: [ticketsSource] };
          } else {
            throw new SourceError('INVALID_ARGUMENTS', 'Choose a documented tool and valid arguments.');
          }
          decision = 'allowed';
          return result({ ...data, synthetic: true });
        } catch (error) {
          code = error instanceof SourceError ? error.code : error instanceof z.ZodError ? 'INVALID_ARGUMENTS' : 'TOOL_FAILED';
          if (!(error instanceof SourceError) && !(error instanceof z.ZodError)) console.error('Workshop tool failed.', { tool: name, category: error instanceof Error ? error.name : 'UNKNOWN' });
          return { ...result({ error: code, message: error instanceof SourceError ? error.message : 'Tool failed or received invalid arguments. No substitute data was returned.' }), isError: true };
        }
      });
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.once('close', () => { void server.close().catch(() => console.error('Sandbox MCP cleanup failed.')); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      if (!toolName && res.statusCode < 400) decision = 'allowed';
    } catch {
      code = 'TRANSPORT_ERROR';
      console.error('Sandbox MCP transport failed.');
      if (!res.headersSent) res.status(500).json({ error: code });
    }
  });
  app.all('/mcp', (_req, res) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Use stateless Streamable HTTP POST.' });
  });
  const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = error instanceof SyntaxError && 'status' in error && error.status === 400 ? 400 :
      typeof error === 'object' && error !== null && 'status' in error && error.status === 413 ? 413 : 500;
    console.error('Sandbox HTTP request rejected.', { status });
    res.status(status).json({ error: 'REQUEST_REJECTED', message: status === 500
      ? 'The server could not read or save the data. Check server storage and retry.'
      : 'The request body is invalid or too large.' });
  };
  app.use(onError);
  return app;
}
