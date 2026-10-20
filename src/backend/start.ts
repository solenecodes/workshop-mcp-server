import type { Server } from 'node:http';
import { z } from 'zod';
import { createEntraVerifier } from '../sandbox/auth.js';
import { createBackendApp } from './api.js';
import { createBackendStore } from './store.js';

async function main() {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? 3210);
  const mode = z.enum(['local', 'entra']).parse(process.env.BACKEND_MODE ?? 'local');
  const verifyToken = mode === 'entra'
    ? createEntraVerifier(process.env.ENTRA_TENANT_ID ?? '', process.env.BACKEND_CLIENT_ID ?? '', undefined, 'Mcp.Backend.Read')
    : undefined;
  const store = await createBackendStore(process.env.BACKEND_DATABASE_PATH ?? '.workshop-data/business.sqlite');
  let server: Server;
  try {
    const app = createBackendApp({ store, host, verifyToken, publicUrl: process.env.PUBLIC_API_URL });
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(port, host, () => resolve(listener));
      listener.once('error', reject);
    });
  } catch (error) { store.close(); throw error; }
  console.log(`Contoso Tickets API: ${process.env.PUBLIC_API_URL ?? `http://${host}:${port}`}`);
  console.log('OpenAPI: /openapi/contoso-tickets.json. All tickets are synthetic.');
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      if (stopping) return;
      stopping = true;
      server.close(() => store.close());
      server.closeAllConnections();
    });
  }
}

main().catch((error: unknown) => {
  console.error('Business API startup failed.', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
