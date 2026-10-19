import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AuthenticationError, type Identity, type VerifyToken } from './auth.js';
import { currencySchema, customerIdSchema, quoteCurrencySchema, SourceError, type Sources } from './sources.js';

const internalSource = { name: 'Customers REST API', kind: 'internal-api', synthetic: true };
const sqlSource = { name: 'Claims and Policies REST APIs', kind: 'database', transport: 'HTTP', storage: 'SQLite', synthetic: true };
const internetSource = { name: 'Frankfurter', kind: 'public-api', url: 'https://frankfurter.dev/', synthetic: false };
const result = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data,
});
const schemas = {
  get_customer_file: z.object({ customerId: customerIdSchema }).strict(),
  list_customer_claims: z.object({ customerId: customerIdSchema }).strict(),
  get_exchange_rate: z.object({ baseCurrency: currencySchema, targetCurrency: currencySchema }).strict(),
  get_customer_overview: z.object({
    customerId: customerIdSchema, targetCurrency: quoteCurrencySchema.default('USD'),
  }).strict(),
};
const descriptions = {
  get_customer_file: 'Read a fictional customer dossier through a private HTTP API. Does not change data.',
  list_customer_claims: 'Call the Claims and Policies REST APIs backed by SQLite. Does not change data.',
  get_exchange_rate: 'Fetch a dated exchange rate from Frankfurter on the Internet. Only currency codes leave this server.',
  get_customer_overview: 'Call the Customers, Claims and Policies REST APIs, then a public exchange-rate API. Returns source provenance; no model or insurance decision.',
};
type ToolName = keyof typeof schemas;

export interface SandboxOptions {
  sources: Sources;
  verifyToken?: VerifyToken;
  host?: string;
  publicUrl?: string;
  consoleOrigin?: string;
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
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin) {
      res.vary('Origin');
      if (req.headers.origin !== options.consoleOrigin || req.path !== '/mcp' ||
          !['POST', 'OPTIONS'].includes(req.method) || req.headers.authorization) {
        res.status(403).json({ error: 'BROWSER_ORIGIN_DENIED', message: 'Use the approved public workshop console or the terminal client.' });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', options.consoleOrigin);
      res.setHeader('Access-Control-Expose-Headers', 'Retry-After, Mcp-Session-Id');
      if (req.method === 'OPTIONS') {
        const headers = (req.get('access-control-request-headers') ?? '').toLowerCase().split(',').map((header) => header.trim()).filter(Boolean);
        if (req.get('access-control-request-method') !== 'POST' ||
            headers.some((header) => !['content-type', 'mcp-protocol-version', 'mcp-session-id'].includes(header))) {
          res.status(403).json({ error: 'CONSOLE_PREFLIGHT_DENIED' });
          return;
        }
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Protocol-Version, Mcp-Session-Id');
        res.setHeader('Access-Control-Max-Age', '600');
        res.status(204).end();
        return;
      }
    }
    next();
  });
  app.get('/health', (_req, res) => res.json({
    status: 'ok', mode: verifyToken ? 'protected-entra' : 'public-read-only',
    syntheticCustomerData: true, sources: ['customers-api', 'claims-api', 'policies-api', 'public-exchange-rate-api'],
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
    const server = new McpServer({ name: 'multi-source-mcp-workshop', version: '1.0.0' });
    for (const name of Object.keys(schemas) as ToolName[]) {
      server.registerTool(name, {
        description: descriptions[name], inputSchema: schemas[name],
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: name === 'get_exchange_rate' || name === 'get_customer_overview' },
      }, async (args: Record<string, unknown>) => {
        try {
          let data: Record<string, unknown>;
          const customerId = name !== 'get_exchange_rate' ? customerIdSchema.parse(args.customerId) : undefined;
          const redact = (customer: Awaited<ReturnType<Sources['customer']>>) => {
            if (!identity || identity.canReadPii) return customer;
            redactedFields = ['customerName', 'dateOfBirth', 'address'];
            return { ...customer, customerName: '[REDACTED]', dateOfBirth: '[REDACTED]', address: '[REDACTED]' };
          };
          if (name === 'get_customer_file' && customerId) {
            data = { customer: redact(await sources.customer(customerId)), sources: [internalSource] };
          } else if (name === 'list_customer_claims' && customerId) {
            data = { customerId, claims: await sources.claims(customerId), sources: [sqlSource] };
          } else if (name === 'get_exchange_rate') {
            data = { exchangeRate: await sources.exchangeRate(currencySchema.parse(args.baseCurrency), currencySchema.parse(args.targetCurrency)), sources: [internetSource] };
          } else if (name === 'get_customer_overview' && customerId) {
            const [customer, claims, exchangeRate] = await Promise.all([
              sources.customer(customerId), sources.claims(customerId),
              sources.exchangeRate('EUR', quoteCurrencySchema.parse(args.targetCurrency)),
            ]);
            data = {
              customer: redact(customer), claims, exchangeRate,
              convertedClaims: claims.map((claim) => ({
                claimId: claim.claimId, amount: Math.round(claim.amount * exchangeRate.rate * 100) / 100,
                currency: exchangeRate.quote,
              })),
              sources: [internalSource, sqlSource, internetSource],
              warning: 'Dated reference rate, not a live trading rate or an insurance coverage/payment decision.',
            };
          } else {
            throw new SourceError('INVALID_ARGUMENTS', 'Choose a documented tool and valid arguments.');
          }
          decision = 'allowed';
          return result({ ...data, syntheticCustomerData: true, redactedFields });
        } catch (error) {
          code = error instanceof SourceError ? error.code : 'TOOL_FAILED';
          if (!(error instanceof SourceError)) console.error('Multi-source tool failed.', { tool: name, category: error instanceof Error ? error.name : 'UNKNOWN' });
          return { ...result({ error: code, message: error instanceof SourceError ? error.message : 'Tool failed. Check server diagnostics; no substitute data was returned.' }), isError: true };
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
    const status = error instanceof SyntaxError ? 400 :
      typeof error === 'object' && error !== null && 'status' in error && error.status === 413 ? 413 : 500;
    console.error('Sandbox HTTP request rejected.', { status });
    res.status(status).json({ error: 'REQUEST_REJECTED' });
  };
  app.use(onError);
  return app;
}
