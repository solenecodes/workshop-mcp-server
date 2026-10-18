import type { Server } from 'node:http';
import initSqlJs from 'sql.js';
import { z } from 'zod';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { createDemoData } from '../data/demoData.js';

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

export function createInternalApi() {
  const app = createMcpExpressApp();
  app.disable('x-powered-by');
  const data = createDemoData();
  app.get('/customers/:customerId', (req, res) => {
    const parsed = customerIdSchema.safeParse(req.params.customerId);
    if (!parsed.success) {
      res.status(404).json({ error: 'CUSTOMER_NOT_FOUND' });
      return;
    }
    const claim = [...data.claims.values()].find((item) => item.policyholderId === parsed.data);
    if (!claim) {
      res.status(404).json({ error: 'CUSTOMER_NOT_FOUND' });
      return;
    }
    res.json({
      customerId: claim.policyholderId, customerName: claim.customerName,
      dateOfBirth: claim.dateOfBirth, address: claim.address,
    });
  });
  return app;
}

export async function startInternalApi() {
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = createInternalApi().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Internal API did not obtain a TCP port.');
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

export async function createSources(internalApiUrl: string, fetcher: typeof fetch = fetch) {
  const internalUrl = new URL(internalApiUrl);
  if (internalUrl.protocol !== 'http:' || internalUrl.hostname !== '127.0.0.1' ||
      internalUrl.username || internalUrl.password || internalUrl.search || internalUrl.hash || internalUrl.pathname !== '/') {
    throw new Error('The synthetic internal API must use HTTP on 127.0.0.1 with no extra URL components.');
  }
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.run(`CREATE TABLE policies (policyId TEXT PRIMARY KEY, coverage TEXT, coverageLimit REAL);
    CREATE TABLE claims (claimId TEXT PRIMARY KEY, customerId TEXT, policyId TEXT, amount REAL, currency TEXT, status TEXT);`);
  const data = createDemoData();
  for (const policy of data.policies.values()) {
    database.run('INSERT INTO policies VALUES (?, ?, ?)', [policy.policyId, policy.coverage, policy.limit]);
  }
  for (const claim of data.claims.values()) {
    database.run('INSERT INTO claims VALUES (?, ?, ?, ?, ?, ?)', [
      claim.claimId, claim.policyholderId, claim.policyId, claim.claimAmount, claim.currency, claim.status,
    ]);
  }
  database.run('PRAGMA query_only = ON');
  const rates = new Map<string, { expires: number; value: z.infer<typeof rateSchema> }>();
  const pendingRates = new Map<string, Promise<z.infer<typeof rateSchema>>>();

  async function getJson(url: URL, source: string) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok) throw new SourceError('SOURCE_UNAVAILABLE', `${source} returned HTTP ${response.status}. Retry later.`);
      return await response.json() as unknown;
    } catch (error) {
      if (error instanceof SourceError) throw error;
      console.error('Workshop source request failed.', { source, category: error instanceof Error ? error.name : 'UNKNOWN' });
      throw new SourceError('SOURCE_UNAVAILABLE', `${source} could not be reached or returned invalid JSON. No fixture rate was substituted.`);
    }
  }
  return {
    async customer(customerId: string) {
      const id = customerIdSchema.parse(customerId);
      const parsed = customerSchema.safeParse(await getJson(new URL(`/customers/${id}`, internalUrl), 'Internal dossier API'));
      if (!parsed.success || parsed.data.customerId !== id) {
        throw new SourceError('INVALID_SOURCE_RESPONSE', 'Internal dossier API returned an invalid or mismatched customer.');
      }
      return parsed.data;
    },
    claims(customerId: string) {
      const id = customerIdSchema.parse(customerId);
      const statement = database.prepare(`SELECT c.claimId, c.policyId, c.amount, c.currency, c.status,
        p.coverage, p.coverageLimit FROM claims c JOIN policies p ON c.policyId = p.policyId
        WHERE c.customerId = ? ORDER BY c.claimId`);
      try {
        statement.bind([id]);
        const rows: Record<string, string | number | Uint8Array | null>[] = [];
        while (statement.step()) rows.push(statement.getAsObject());
        return z.array(claimRowSchema).parse(rows);
      } finally { statement.free(); }
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
    close() { database.close(); },
  };
}

export type Sources = Awaited<ReturnType<typeof createSources>>;
