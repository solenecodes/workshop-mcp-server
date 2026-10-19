import type { Server } from 'node:http';
import { z } from 'zod';
import { createBackendApp } from '../backend/api.js';
import { claimRecord, createBackendStore, perilSchema, policyRecord } from '../backend/store.js';
import { ManagedIdentityError } from '../backend/identity.js';

export const customerIdSchema = z.string().regex(/^DEMO-PERSON-[1-5]$/);
export const claimIdSchema = z.string().regex(/^CLM-100[1-5]$/);
const customerSchema = z.object({
  customerId: customerIdSchema,
  customerName: z.string(),
  dateOfBirth: z.string(),
  address: z.string(),
}).strict();
const claimRowSchema = z.object({
  claimId: z.string(), policyId: z.string(), amount: z.number().nonnegative(),
  currency: z.literal('EUR'), status: z.string(), peril: perilSchema, incidentDate: z.iso.date(),
  city: z.string(), latitude: z.number(), longitude: z.number(), coverage: z.string(), coverageLimit: z.number(),
});
const dailyWeatherSchema = z.object({
  daily: z.object({
    time: z.tuple([z.iso.date()]),
    temperature_2m_max: z.tuple([z.number().finite()]),
    precipitation_sum: z.tuple([z.number().finite().nonnegative()]),
    wind_gusts_10m_max: z.tuple([z.number().finite().nonnegative()]),
  }),
});
type ClaimRow = z.infer<typeof claimRowSchema>;
type Observation = { maxWindGustKmh: number; precipitationMm: number; maxTemperatureC: number };
// Illustrative thresholds for the workshop, not an insurer's rules.
const rules = {
  storm: { label: 'Wind gusts of at least 80 km/h', severe: (o: Observation) => o.maxWindGustKmh >= 80 },
  flooding: { label: 'At least 20 mm of rain during the day', severe: (o: Observation) => o.precipitationMm >= 20 },
} as const;

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
  const observations = new Map<string, { expires: number; value: Observation }>();
  const pendingObservations = new Map<string, Promise<Observation>>();

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
    async claim(claimId: string) {
      const id = claimIdSchema.parse(claimId);
      const response = z.object({ data: claimRecord }).safeParse(await getJson(new URL(`/api/claims/v1/claims/${id}`, internalUrl), 'Claims API'));
      if (!response.success || response.data.data.claimId !== id) {
        throw new SourceError('INVALID_SOURCE_RESPONSE', 'Claims API returned an invalid or mismatched claim.');
      }
      return response.data.data;
    },
    // Only a town's coordinates and a past date leave this server: no customer data.
    async incidentWeather(claim: Pick<ClaimRow, 'claimId' | 'peril' | 'incidentDate' | 'city' | 'latitude' | 'longitude'>) {
      const key = `${claim.latitude},${claim.longitude},${claim.incidentDate}`;
      const cached = observations.get(key);
      let observed = cached && cached.expires > Date.now() ? cached.value : undefined;
      const wasCached = Boolean(observed);
      if (!observed) {
        let pending = pendingObservations.get(key);
        if (!pending) {
          pending = (async () => {
            const url = new URL('https://archive-api.open-meteo.com/v1/archive');
            url.search = new URLSearchParams({
              latitude: String(claim.latitude), longitude: String(claim.longitude),
              start_date: claim.incidentDate, end_date: claim.incidentDate,
              daily: 'temperature_2m_max,precipitation_sum,wind_gusts_10m_max', timezone: 'UTC',
            }).toString();
            const parsed = dailyWeatherSchema.safeParse(await getJson(url, 'Open-Meteo public weather API'));
            if (!parsed.success || parsed.data.daily.time[0] !== claim.incidentDate) {
              throw new SourceError('INVALID_SOURCE_RESPONSE', 'Weather API returned no observation for this date and place.');
            }
            const { daily } = parsed.data;
            const value = { maxWindGustKmh: daily.wind_gusts_10m_max[0], precipitationMm: daily.precipitation_sum[0], maxTemperatureC: daily.temperature_2m_max[0] };
            observations.set(key, { value, expires: Date.now() + 3_600_000 });
            return value;
          })();
          pendingObservations.set(key, pending);
        }
        try { observed = await pending; }
        finally { pendingObservations.delete(key); }
      }
      const rule = rules[claim.peril];
      return {
        claimId: claim.claimId, peril: claim.peril, incidentDate: claim.incidentDate, city: claim.city,
        observed, test: rule.label, severeWeatherObserved: rule.severe(observed), cached: wasCached,
      };
    },
    close() { shutdown.abort(); observations.clear(); pendingObservations.clear(); },
  };
}

export type Sources = Awaited<ReturnType<typeof createSources>>;
