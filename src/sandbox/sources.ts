import type { Server } from 'node:http';
import { z } from 'zod';
import { createBackendApp } from '../backend/api.js';
import { claimRecord, createBackendStore, policyRecord } from '../backend/store.js';
import { ManagedIdentityError } from '../backend/identity.js';

export const customerIdSchema = z.string().regex(/^DEMO-PERSON-[1-5]$/);
export const currencySchema = z.enum(['EUR', 'USD', 'GBP', 'CHF']);
export const quoteCurrencySchema = z.enum(['USD', 'GBP', 'CHF']);
const customerSchema = z.object({
  customerId: customerIdSchema,
  customerName: z.string(),
  dateOfBirth: z.string(),
  address: z.string(),
}).strict();
const rateSchema = z.object({
  date: z.iso.date(),
  base: currencySchema,
  quote: currencySchema,
  rate: z.number().positive().finite(),
});
const claimRowSchema = z.object({
  claimId: z.string(), policyId: z.string(), amount: z.number().nonnegative(),
  currency: z.literal('EUR'), status: z.string(), coverage: z.string(), coverageLimit: z.number(),
});

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
  const rates = new Map<string, { expires: number; value: z.infer<typeof rateSchema> }>();
  const pendingRates = new Map<string, Promise<z.infer<typeof rateSchema>>>();

  async function getJson(url: URL, source: string) {
    try {
      const token = url.origin === internalUrl.origin && accessToken ? await accessToken() : undefined;
      const response = await fetcher(url, {
        signal: AbortSignal.any([AbortSignal.timeout(5000), shutdown.signal]), redirect: 'error',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
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
    async customer(customerId: string) {
      const id = customerIdSchema.parse(customerId);
      const response = z.object({ data: customerSchema }).safeParse(await getJson(new URL(`/api/customers/v1/customers/${id}`, internalUrl), 'Customers API'));
      if (!response.success || response.data.data.customerId !== id) {
        throw new SourceError('INVALID_SOURCE_RESPONSE', 'Internal dossier API returned an invalid or mismatched customer.');
      }
      return response.data.data;
    },
    async claims(customerId: string) {
      const id = customerIdSchema.parse(customerId);
      const claims = z.object({ data: z.array(claimRecord), meta: z.object({ total: z.number().int().nonnegative() }) }).safeParse(
        await getJson(new URL(`/api/claims/v1/claims?customerId=${id}&limit=100`, internalUrl), 'Claims API'));
      if (!claims.success || claims.data.meta.total !== claims.data.data.length || claims.data.data.some((claim) => claim.customerId !== id)) {
        throw new SourceError('INVALID_SOURCE_RESPONSE', 'Claims API returned incomplete or mismatched records.');
      }
      const rows: z.infer<typeof claimRowSchema>[] = [];
      for (const claim of claims.data.data) {
        const policy = z.object({ data: policyRecord }).safeParse(
          await getJson(new URL(`/api/policies/v1/policies/${encodeURIComponent(claim.policyId)}`, internalUrl), 'Policies API'));
        if (!policy.success || policy.data.data.policyId !== claim.policyId || policy.data.data.customerId !== id) {
          throw new SourceError('INVALID_SOURCE_RESPONSE', 'Policies API returned invalid or mismatched coverage.');
        }
        rows.push(claimRowSchema.parse({ ...claim, coverage: policy.data.data.coverage, coverageLimit: policy.data.data.coverageLimit }));
      }
      return rows;
    },
    async exchangeRate(baseCurrency: z.infer<typeof currencySchema>, targetCurrency: z.infer<typeof currencySchema>) {
      const base = currencySchema.parse(baseCurrency);
      const quote = currencySchema.parse(targetCurrency);
      if (base === quote) throw new SourceError('INVALID_CURRENCY_PAIR', 'Choose two different currencies.');
      const key = `${base}/${quote}`;
      const cached = rates.get(key);
      if (cached && cached.expires > Date.now()) return { ...cached.value, cached: true };
      let pending = pendingRates.get(key);
      if (!pending) {
        pending = (async () => {
          const url = new URL(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}`);
          const parsed = rateSchema.safeParse(await getJson(url, 'Frankfurter public exchange-rate API'));
          if (!parsed.success || parsed.data.base !== base || parsed.data.quote !== quote) {
            throw new SourceError('INVALID_SOURCE_RESPONSE', 'Exchange-rate API returned an invalid or mismatched currency pair.');
          }
          rates.set(key, { value: parsed.data, expires: Date.now() + 60_000 });
          return parsed.data;
        })();
        pendingRates.set(key, pending);
      }
      try { return { ...await pending, cached: false }; }
      finally { pendingRates.delete(key); }
    },
    close() { shutdown.abort(); rates.clear(); pendingRates.clear(); },
  };
}

export type Sources = Awaited<ReturnType<typeof createSources>>;
