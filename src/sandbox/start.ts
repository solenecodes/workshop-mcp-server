import type { Server } from 'node:http';
import { z } from 'zod';
import { createEntraVerifier } from './auth.js';
import { createSandboxApp } from './server.js';
import { createSources, startInternalApi } from './sources.js';
import { appServiceAccessToken } from '../backend/identity.js';

async function main() {
  const mode = z.enum(['public', 'protected']).parse(process.env.SANDBOX_MODE ?? 'public');
  const host = process.env.HOST ?? '127.0.0.1';
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? (mode === 'protected' ? 3202 : 3201));
  // No hardcoded/demo token is accepted by the Internet-capable protected edition.
  const verifyToken = mode === 'protected'
    ? createEntraVerifier(process.env.ENTRA_TENANT_ID ?? '', process.env.ENTRA_CLIENT_ID ?? '')
    : undefined;
  const remoteApi = process.env.BACKEND_API_URL;
  const accessToken = remoteApi ? appServiceAccessToken({
    clientId: process.env.BACKEND_CLIENT_ID ?? '', endpoint: process.env.IDENTITY_ENDPOINT,
    identityHeader: process.env.IDENTITY_HEADER,
  }) : undefined;
  const internal = remoteApi ? undefined : await startInternalApi(process.env.BACKEND_DATABASE_PATH ?? '.workshop-data/business.sqlite');
  let sources: Awaited<ReturnType<typeof createSources>> | undefined;
  let listener: Server | undefined;
  try {
    const apiUrl = remoteApi ?? internal?.url;
    if (!apiUrl) throw new Error('No business API endpoint was configured or started.');
    sources = await createSources(apiUrl, fetch, accessToken);
    const app = createSandboxApp({ sources, verifyToken, host, publicUrl: process.env.PUBLIC_MCP_URL, consoleOrigin: process.env.PUBLIC_CONSOLE_ORIGIN });
    listener = await new Promise<Server>((resolve, reject) => {
      const server = app.listen(port, host, () => resolve(server));
      server.once('error', reject);
    });
  } catch (error) {
    sources?.close();
    await internal?.close();
    throw error;
  }
  console.log(`${mode === 'public' ? 'Read-only synthetic sandbox' : 'Entra-protected sandbox'}: ${process.env.PUBLIC_MCP_URL ?? `http://${host}:${port}/mcp`}`);
  console.log(`Sources: Customers, Claims and Policies HTTP APIs (${remoteApi ? 'remote, managed identity' : 'local, persistent SQLite'}) + Frankfurter. No real customer data.`);
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      if (stopping) return;
      stopping = true;
      listener.close(() => {
        sources.close();
        if (internal) void internal.close().catch(() => { console.error('Internal API shutdown failed.'); process.exitCode = 1; });
      });
      listener.closeAllConnections();
    });
  }
}

main().catch((error: unknown) => {
  console.error('Sandbox startup failed.', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
