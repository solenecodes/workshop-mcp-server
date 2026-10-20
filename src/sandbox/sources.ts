import type { Server } from 'node:http';
import { z } from 'zod';
import { createBackendApp } from '../backend/api.js';
import { createBackendStore, ticketRecord } from '../backend/store.js';
import { ManagedIdentityError } from '../backend/identity.js';

export const ticketIdSchema = z.string().regex(/^CT-\d{4}$/);
export type Ticket = z.infer<typeof ticketRecord>;

export class SourceError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export async function startInternalApi(databasePath?: string) {
  const store = await createBackendStore(databasePath);
  let server: Server;
  try {
    server = await new Promise<Server>((resolve, reject) => {
      const listener = createBackendApp({ store }).listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
  } catch (error) { store.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Internal API did not obtain a TCP port.');
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections();
      try { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
      finally { store.close(); }
    },
  };
}

export async function createSources(internalApiUrl: string, fetcher: typeof fetch = fetch,
  accessToken?: () => Promise<string>) {
  const internalUrl = new URL(internalApiUrl);
  const loopback = internalUrl.protocol === 'http:' && internalUrl.hostname === '127.0.0.1';
  if ((!loopback && (internalUrl.protocol !== 'https:' || !accessToken)) ||
      internalUrl.username || internalUrl.password || internalUrl.search || internalUrl.hash || internalUrl.pathname !== '/') {
    throw new Error('Business APIs require a loopback HTTP origin, or an HTTPS origin with service authentication.');
  }
  const shutdown = new AbortController();

  async function getJson(url: URL, source: string, notFoundIsError = false) {
    try {
      const token = url.origin === internalUrl.origin && accessToken ? await accessToken() : undefined;
      const response = await fetcher(url, {
        signal: AbortSignal.any([AbortSignal.timeout(5000), shutdown.signal]), redirect: 'error',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      if (notFoundIsError && response.status === 404) throw new SourceError('TICKET_NOT_FOUND', 'No ticket has this identifier.');
      if (!response.ok) throw new SourceError('SOURCE_UNAVAILABLE', `${source} returned HTTP ${response.status}. Retry later.`);
      return await response.json() as unknown;
    } catch (error) {
      if (error instanceof SourceError) throw error;
      console.error('Workshop source request failed.', { source, category: error instanceof Error ? error.name : 'UNKNOWN' });
      if (error instanceof ManagedIdentityError) throw new SourceError('SERVICE_IDENTITY_UNAVAILABLE', error.message);
      throw new SourceError('SOURCE_UNAVAILABLE', `${source} could not be reached or returned invalid JSON. No fixture response was substituted.`);
    }
  }
  return {
    async listTickets() {
      const parsed = z.array(ticketRecord).safeParse(await getJson(new URL('/contoso-tickets/tickets', internalUrl), 'Contoso Tickets API'));
      if (!parsed.success) throw new SourceError('INVALID_SOURCE_RESPONSE', 'Tickets API returned an invalid list.');
      return parsed.data;
    },
    async ticket(ticketId: string) {
      const id = ticketIdSchema.parse(ticketId);
      const parsed = ticketRecord.safeParse(await getJson(new URL(`/contoso-tickets/tickets/${id}`, internalUrl), 'Contoso Tickets API', true));
      if (!parsed.success || parsed.data.id !== id) {
        throw new SourceError('INVALID_SOURCE_RESPONSE', 'Tickets API returned an invalid or mismatched ticket.');
      }
      return parsed.data;
    },
    close() { shutdown.abort(); },
  };
}

export type Sources = Awaited<ReturnType<typeof createSources>>;
