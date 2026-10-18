import type { ErrorRequestHandler } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createDemoData } from './data/demoData.js';
import { ClaimsService } from './claims.js';
import { authenticate } from './secure/auth.js';
import { descriptions, insecureSchemas, PolicyError, secureSchemas, type BusinessTool, type ToolName } from './tools.js';
import { policyMap } from './secure/policies.js';

const result = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  structuredContent: data,
});

export function createClaimsApp(secure: boolean, service = new ClaimsService(createDemoData())) {
  // Both editions are loopback-only; DNS rebinding and Origin checks are transport safety, not business controls.
  const app = createMcpExpressApp({ host: '127.0.0.1' });
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (req.headers.origin) {
      res.status(403).json({ error: 'BROWSER_ORIGIN_DENIED', message: 'Use a native MCP client. Browser cross-origin access is disabled.' });
      return;
    }
    next();
  });
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', mode: secure ? 'secure-demo' : 'intentionally-insecure-demo', syntheticDataOnly: true });
  });
  app.post('/mcp', async (req, res) => {
    const user = secure ? authenticate(req.headers.authorization) : undefined;
    const isToolCall = req.body?.method === 'tools/call';
    const toolName = typeof req.body?.params?.name === 'string' ? req.body.params.name : 'unknown_tool';
    const claimId = typeof req.body?.params?.arguments?.claimId === 'string' ? req.body.params.arguments.claimId : undefined;
    let audited = false;
    const audit = (decision: 'allowed' | 'denied' | 'requiresApproval', code?: string, redactedFields?: string[], resolvedClaimId = claimId) => {
      if (secure && isToolCall && !audited) {
        service.audit.record(user, toolName, decision, { claimId: resolvedClaimId, code, redactedFields });
        audited = true;
      }
    };
    // Also record schema/unknown-tool rejections performed by the SDK before the handler.
    res.once('finish', () => audit('denied', 'PROTOCOL_OR_SCHEMA_REJECTED'));
    if (secure && !user) {
      audit('denied', 'UNAUTHENTICATED');
      res.setHeader('WWW-Authenticate', 'Bearer realm="local-claims-demo"');
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Use a documented demo bearer token. This endpoint has no OAuth discovery.' });
      return;
    }
    try {
      if (user) service.guard.check(user.userId);
    } catch (error) {
      if (!(error instanceof PolicyError)) throw error;
      audit('denied', error.code);
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: error.code, message: error.message });
      return;
    }
    if (user && isToolCall && !policyMap[user.role].some((tool) => tool === toolName)) {
      audit('denied', 'TOOL_DENIED');
      res.json({
        jsonrpc: '2.0', id: req.body.id ?? null,
        result: {
          ...result({ error: 'TOOL_DENIED', message: 'This tool is not allowlisted for your role.' }),
          isError: true,
        },
      });
      return;
    }
    const server = new McpServer({ name: secure ? 'insurance-claims-secure-demo' : 'insurance-claims-insecure-demo', version: '1.0.0' });
    const schemas = secure ? secureSchemas : insecureSchemas;
    for (const [name, schema] of Object.entries(schemas)) {
      const tool = name as ToolName;
      // Discovery only lists role-allowed tools; execution still enforces the same central map.
      if (user && !policyMap[user.role].includes(tool)) continue;
      server.registerTool(name, {
        description: descriptions[tool],
        inputSchema: schema,
        annotations: {
          readOnlyHint: !['create_claim_note', 'escalate_claim', 'confirm_action'].includes(name),
          destructiveHint: ['escalate_claim', 'confirm_action'].includes(name),
          openWorldHint: false,
        },
      }, async (args: Record<string, unknown>) => {
        try {
          const data = secure && user
            ? service.secure(user, tool, args)
            : service.insecure(tool as BusinessTool, args);
          const redactedFields = Array.isArray(data.redactedFields)
            ? data.redactedFields.filter((field): field is string => typeof field === 'string') : [];
          const resolvedClaimId = typeof data.claimId === 'string' ? data.claimId : claimId;
          audit(data.requiresApproval ? 'requiresApproval' : 'allowed', undefined, redactedFields, resolvedClaimId);
          return result(data);
        } catch (error) {
          if (error instanceof PolicyError) {
            audit('denied', error.code);
            return { ...result({ error: error.code, message: error.message }), isError: true };
          }
          audit('denied', 'INTERNAL_ERROR');
          console.error('Claims tool failed unexpectedly.', { tool: name });
          return { ...result({ error: 'INTERNAL_ERROR', message: 'Tool failed. Check the local server diagnostics.' }), isError: true };
        }
      });
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.once('close', () => {
      void server.close().catch(() => console.error('MCP connection cleanup failed.'));
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      audit('denied', 'TRANSPORT_ERROR');
      console.error('MCP transport failed.');
      if (!res.headersSent) res.status(500).json({ error: 'TRANSPORT_ERROR' });
    }
  });
  app.all('/mcp', (_req, res) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'This demo uses stateless Streamable HTTP POST requests.' });
  });
  const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    console.error('HTTP request rejected.', { category: error instanceof SyntaxError ? 'JSON_SYNTAX' : 'HTTP_ERROR' });
    res.status(error instanceof SyntaxError ? 400 : 500).json({ error: 'REQUEST_REJECTED' });
  };
  app.use(onError);
  return app;
}

export function startServer(secure: boolean) {
  const port = secure ? 3102 : 3101;
  const listener = createClaimsApp(secure).listen(port, '127.0.0.1', () => {
    console.log(`${secure ? 'Secure DEMO (public demo tokens; not Entra)' : 'WARNING: INTENTIONALLY INSECURE, synthetic data only'}: http://127.0.0.1:${port}/mcp`);
  });
  listener.on('error', (error) => {
    console.error('Unable to start workshop server.', error.message);
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      listener.close();
      listener.closeAllConnections();
    });
  }
  return listener;
}
