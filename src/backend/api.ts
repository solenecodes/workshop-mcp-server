import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, Response } from 'express';
import { z } from 'zod';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { AuthenticationError, type VerifyToken } from '../sandbox/auth.js';
import type { BackendStore } from './store.js';

const ticketId = z.string().regex(/^CT-\d{4}$/);
const basePath = '/contoso-tickets';

// OpenAPI contract of the workshop's Contoso Tickets API (read-only, synthetic data).
export function backendOpenApi(baseUrl: string, authenticated = true) {
  const ticket = {
    type: 'object', required: ['id', 'title', 'severity', 'status', 'service'], additionalProperties: false,
    properties: {
      id: { type: 'string', example: 'CT-1001' }, title: { type: 'string', example: 'VPN gateway reports intermittent timeouts' },
      severity: { type: 'string', enum: ['low', 'medium', 'high'] }, status: { type: 'string', enum: ['open', 'in-progress', 'resolved'] },
      service: { type: 'string', example: 'network' },
    },
  };
  const problem = { description: 'RFC 9457 problem; requestId correlates with server logs.', content: { 'application/problem+json': { schema: { type: 'object' } } } };
  return {
    openapi: '3.0.3',
    info: { title: 'Contoso Tickets API', version: '1.0.0', description: 'Read-only demonstration API. All tickets are synthetic.' },
    servers: [{ url: `${baseUrl}${basePath}` }],
    security: authenticated ? [{ bearerAuth: [] }] : [],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas: { Ticket: ticket } },
    paths: {
      '/tickets': { get: { operationId: 'list-tickets', summary: 'List tickets', description: 'Matches the MCP tool list_tickets.',
        responses: { '200': { description: 'Synthetic tickets.', content: { 'application/json': { schema: { type: 'array', items: ticket } } } }, '401': problem, '429': problem } } },
      '/tickets/{ticketId}': { get: { operationId: 'get-ticket', summary: 'Get a ticket', description: 'Matches the MCP tool get_ticket.',
        parameters: [{ name: 'ticketId', in: 'path', required: true, description: 'Ticket identifier.', schema: { type: 'string', example: 'CT-1001' } }],
        responses: { '200': { description: 'The ticket.', content: { 'application/json': { schema: ticket } } }, '400': problem, '401': problem, '404': problem, '429': problem } } },
    },
  };
}
export function createBackendApp(options: {
  store: BackendStore; host?: string; publicUrl?: string; verifyToken?: VerifyToken;
  requestLimit?: number; log?: (entry: Record<string, unknown>) => void;
}) {
  const host = options.host ?? '127.0.0.1';
  const publicUrl = options.publicUrl ? new URL(options.publicUrl) : undefined;
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if (publicUrl && (publicUrl.protocol !== 'https:' || publicUrl.pathname !== '/' ||
      publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash)) {
    throw new Error('PUBLIC_API_URL must be an HTTPS origin without credentials, path, query or fragment.');
  }
  if (!loopback && (!publicUrl || !options.verifyToken)) {
    throw new Error('Remote business APIs require PUBLIC_API_URL and Entra authentication. Anonymous mode is loopback-only.');
  }
  const app = createMcpExpressApp({ host, ...(publicUrl ? { allowedHosts: [publicUrl.hostname, '127.0.0.1', 'localhost', '[::1]'] } : {}) });
  const log = options.log ?? ((entry: Record<string, unknown>) => console.log(JSON.stringify(entry)));
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.set({ 'X-Request-Id': requestId, 'Cache-Control': 'no-store' });
    res.once('finish', () => log({ timestamp: new Date().toISOString(), requestId, method: req.method,
      service: res.locals.service ?? 'business-api', status: res.statusCode }));
    if (req.headers.origin) { problem(res, 403, 'BROWSER_ORIGIN_DENIED', 'Use a console or authorized agent client.'); return; }
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'workshop-business-apis', synthetic: true, database: options.store.persistent ? 'persistent-sqlite' : 'in-memory-test-sqlite' }));
  app.get('/openapi/contoso-tickets.json', (req, res) => {
    res.json(backendOpenApi(publicUrl?.origin ?? `http://${req.get('host')}`, Boolean(options.verifyToken)));
  });
  let started = Date.now();
  let count = 0;
  app.use(async (req, res, next) => {
    if (Date.now() - started >= 60000) { started = Date.now(); count = 0; }
    if (++count > (options.requestLimit ?? 1200)) {
      res.setHeader('Retry-After', '60');
      problem(res, 429, 'RATE_LIMITED', 'Shared workshop API capacity reached.');
      return;
    }
    if (options.verifyToken) {
      try {
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith('Bearer ') || !authorization.slice(7).trim()) throw new AuthenticationError(401, 'MISSING_ACCESS_TOKEN');
        res.locals.identity = await options.verifyToken(authorization.slice(7));
      } catch (error) {
        if (!(error instanceof AuthenticationError)) log({ event: 'identity-service-failure', requestId: res.locals.requestId });
        const status = error instanceof AuthenticationError ? error.status : 503;
        if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="workshop-business-apis"');
        problem(res, status, error instanceof AuthenticationError ? error.code : 'IDENTITY_SERVICE_UNAVAILABLE', 'An authorized service identity is required.');
        return;
      }
    }
    next();
  });
  app.get(`${basePath}/tickets`, (_req, res) => {
    res.locals.service = 'tickets-api';
    res.json(options.store.tickets());
  });
  app.get(`${basePath}/tickets/:ticketId`, (req, res) => {
    res.locals.service = 'tickets-api';
    const parsed = ticketId.safeParse(req.params.ticketId);
    if (!parsed.success) { problem(res, 400, 'INVALID_ID', 'Ticket identifiers look like CT-1001.'); return; }
    const ticket = options.store.ticket(parsed.data);
    if (!ticket) { problem(res, 404, 'TICKET_NOT_FOUND', 'No ticket has this identifier.'); return; }
    res.json(ticket);
  });
  app.use((req, res) => problem(res, req.method === 'GET' || req.method === 'HEAD' ? 404 : 405, 'UNSUPPORTED_OPERATION', 'These APIs expose only the documented read operations.'));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    log({ event: 'backend-request-failure', requestId: res.locals.requestId, category: error instanceof Error ? error.name : 'UNKNOWN' });
    const invalidJson = error instanceof SyntaxError && 'status' in error && error.status === 400;
    problem(res, invalidJson ? 400 : 500, invalidJson ? 'INVALID_JSON' : 'BACKEND_FAILURE', invalidJson
      ? 'The request body is not valid JSON.' : 'The API could not complete the request. No fixture response was substituted.');
  };
  app.use(errors);
  return app;
}

function problem(res: Response, status: number, code: string, detail: string) {
  if (!res.locals.requestId) {
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-Id', res.locals.requestId);
  }
  if (status === 405) res.setHeader('Allow', 'GET, HEAD');
  res.status(status).type('application/problem+json').json({
    type: `urn:workshop:problem:${code.toLowerCase()}`, title: code, status, detail, requestId: res.locals.requestId,
  });
}
