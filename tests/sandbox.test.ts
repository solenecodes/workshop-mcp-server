import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createEntraVerifier } from '../src/sandbox/auth.js';
import { createSandboxApp, type SandboxOptions } from '../src/sandbox/server.js';
import { createSources, startInternalApi } from '../src/sandbox/sources.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const audience = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
const keys = await generateKeyPair('RS256', { extractable: true });
const jwk = await exportJWK(keys.publicKey);
const verifyToken = createEntraVerifier(tenantId, audience, createLocalJWKSet({ keys: [{ ...jwk, kid: 'workshop', alg: 'RS256' }] }));

async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({ oid: userId, tid: tenantId, scp: 'Mcp.Read', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'workshop' })
    .setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
}

async function fixture(options: Partial<Omit<SandboxOptions, 'sources'>> & { failInternet?: boolean } = {}) {
  const internal = await startInternalApi();
  const internetRequests: URL[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === '127.0.0.1') return fetch(input, init);
    internetRequests.push(url);
    if (options.failInternet) return new Response('Unavailable', { status: 503 });
    const date = url.searchParams.get('start_date');
    return Response.json({ daily: { time: [date], temperature_2m_max: [12.5], precipitation_sum: [3.2], wind_gusts_10m_max: [95.4] } });
  };
  const sources = await createSources(internal.url, fetcher);
  const logs: Record<string, unknown>[] = [];
  const app = createSandboxApp({ sources, log: (entry) => logs.push(entry), ...options });
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const authorizationPresent: boolean[] = [];
  server.on('request', (req) => authorizationPresent.push(Boolean(req.headers.authorization)));
  const url = new URL(`http://127.0.0.1:${address.port}/mcp`);
  const clients: Client[] = [];
  return {
    url, sources, internetRequests, logs, authorizationPresent,
    async client(accessToken?: string) {
      const client = new Client({ name: 'sandbox-test', version: '1.0' });
      clients.push(client);
      await client.connect(new StreamableHTTPClientTransport(url, {
        requestInit: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
      }));
      return client;
    },
    async close() {
      await Promise.all(clients.map((client) => client.close()));
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      sources.close();
      await internal.close();
    },
  };
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const response = await client.callTool({ name, arguments: args });
  return { error: response.isError === true, data: z.record(z.string(), z.unknown()).parse(response.structuredContent) };
}

test('public MCP discovers exactly four read-only tools and queries real private HTTP plus SQLite', async () => {
  const f = await fixture();
  try {
    const client = await f.client();
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['get_customer_file', 'get_customer_overview', 'get_incident_weather', 'list_customer_claims']);
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint === false));
    const dossier = await call(client, 'get_customer_file', { customerId: 'DEMO-PERSON-1' });
    assert.equal(dossier.error, false);
    assert.match(JSON.stringify(dossier.data), /Alex Example/);
    assert.equal(dossier.data.syntheticCustomerData, true);
    const claims = await call(client, 'list_customer_claims', { customerId: 'DEMO-PERSON-1' });
    assert.match(JSON.stringify(claims.data), /CLM-1001/);
    assert.match(JSON.stringify(claims.data), /POL-1001/);
    assert.match(JSON.stringify(claims.data), /25000/);
    assert.match(JSON.stringify(claims.data), /"peril":"storm".*"incidentDate":"2023-11-02".*"city":"Brest"/);
    assert.doesNotMatch(JSON.stringify(claims.data), /latitude|longitude/);
    assert.equal(f.internetRequests.length, 0);
  } finally { await f.close(); }
});

test('one aggregate returns three real source kinds and checks the weather on the incident date', async () => {
  const f = await fixture();
  try {
    const client = await f.client();
    const overview = await call(client, 'get_customer_overview', { customerId: 'DEMO-PERSON-1' });
    assert.equal(overview.error, false);
    assert.deepEqual(z.array(z.object({ kind: z.string() })).parse(overview.data.sources).map((source) => source.kind), ['internal-api', 'database', 'public-api']);
    const [check] = z.array(z.object({
      claimId: z.string(), severeWeatherObserved: z.boolean(), cached: z.boolean(),
      observed: z.object({ maxWindGustKmh: z.number(), precipitationMm: z.number(), maxTemperatureC: z.number() }),
    })).parse(overview.data.weatherChecks);
    assert.deepEqual(check, { claimId: 'CLM-1001', severeWeatherObserved: true, cached: false, observed: { maxWindGustKmh: 95.4, precipitationMm: 3.2, maxTemperatureC: 12.5 } });
    const again = await call(client, 'get_incident_weather', { claimId: 'CLM-1001' });
    assert.equal(z.object({ cached: z.boolean() }).parse(again.data.weatherCheck).cached, true);
    assert.equal(f.internetRequests.length, 1);
    const requested = f.internetRequests[0]!;
    assert.equal(requested.origin + requested.pathname, 'https://archive-api.open-meteo.com/v1/archive');
    assert.equal(requested.searchParams.get('start_date'), '2023-11-02');
    assert.doesNotMatch(requested.href, /PERSON|CLM|Alex|Brest/);
  } finally { await f.close(); }
});

test('a failed Internet source returns an explicit MCP error, never fixture weather or partial success', async () => {
  const f = await fixture({ failInternet: true });
  try {
    const reply = await call(await f.client(), 'get_customer_overview', { customerId: 'DEMO-PERSON-1' });
    assert.equal(reply.error, true);
    assert.equal(reply.data.error, 'SOURCE_UNAVAILABLE');
    assert.equal(reply.data.weatherChecks, undefined);
    assert.equal(f.logs.find((entry) => entry.toolName === 'get_customer_overview')?.decision, 'denied');
  } finally { await f.close(); }
});

test('strict inputs and tool allowlisting reject writes, malformed IDs, arbitrary SQL and arbitrary URLs', async () => {
  const f = await fixture();
  try {
    const client = await f.client();
    for (const [name, args] of [
      ['get_customer_file', { customerId: "DEMO-PERSON-1' OR 1=1" }],
      ['get_customer_file', { customerId: 'DEMO-PERSON-9' }],
      ['list_customer_claims', { customerId: 'DEMO-PERSON-1', sql: 'DROP TABLE claims' }],
      ['get_incident_weather', { claimId: 'CLM-1001', url: 'http://internal' }],
      ['get_incident_weather', { claimId: 'CLM-9999' }],
      ['create_claim_note', { claimId: 'CLM-1001', note: 'Approve' }],
    ] as const) {
      assert.equal((await client.callTool({ name, arguments: args })).isError, true);
    }
    assert.equal(f.internetRequests.length, 0);
    assert.equal((await call(client, 'list_customer_claims', { customerId: 'DEMO-PERSON-1' })).error, false);
  } finally { await f.close(); }
});

test('protected MCP requires a real signed API token; missing/wrong scope denies before backend access', async () => {
  const f = await fixture({ verifyToken });
  try {
    for (const [accessToken, status] of [
      [undefined, 401], ['demo-admin-token', 401], [await token({ scp: 'other' }), 403],
    ] as const) {
      const response = await fetch(f.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_customer_overview', arguments: { customerId: 'DEMO-PERSON-1' } } }),
      });
      assert.equal(response.status, status);
      if (status === 401) assert.match(response.headers.get('www-authenticate')!, /Bearer/);
    }
    assert.equal(f.internetRequests.length, 0);
    const client = await f.client(await token());
    assert.equal((await client.listTools()).tools.length, 4);
    const overview = await call(client, 'get_customer_overview', { customerId: 'DEMO-PERSON-1' });
    assert.equal(overview.error, false);
    assert.doesNotMatch(JSON.stringify(overview.data), /Alex Example|Example Street|1981-03-12/);
    assert.deepEqual(overview.data.redactedFields, ['customerName', 'dateOfBirth', 'address']);
    const privileged = await f.client(await token({ roles: ['Mcp.Pii.Read'] }));
    const full = await call(privileged, 'get_customer_file', { customerId: 'DEMO-PERSON-1' });
    assert.match(JSON.stringify(full.data), /Alex Example/);
    assert.deepEqual(full.data.redactedFields, []);
    assert.doesNotMatch(JSON.stringify(f.logs), /Bearer|eyJ|Example Street/);
  } finally { await f.close(); }
});

test('JWT verification rejects wrong audience, issuer, lifetime, tenant, unsigned token and ID-only permissions', async () => {
  const sign = (payload: Record<string, unknown>) => new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'workshop' }).sign(keys.privateKey);
  const valid = { iss: issuer, aud: audience, oid: userId, tid: tenantId, scp: 'Mcp.Read', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 };
  for (const payload of [
    { ...valid, aud: 'different-api' }, { ...valid, iss: 'https://different-issuer/' },
    { ...valid, exp: 1 }, { ...valid, tid: 'wrong-tenant' }, { ...valid, oid: 'invalid' },
    { ...valid, scp: '' },
  ]) await assert.rejects(verifyToken(await sign(payload)));
  await assert.rejects(verifyToken('eyJhbGciOiJub25lIn0.e30.'));
  assert.equal((await verifyToken(await token())).userId, userId);
});

test('an unavailable signing-key service reports 503 rather than pretending the user token is invalid', async () => {
  const offlineVerifier = createEntraVerifier(tenantId, audience, async () => { throw new TypeError('Key service unreachable'); });
  const f = await fixture({ verifyToken: offlineVerifier });
  try {
    const response = await fetch(f.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'IDENTITY_SERVICE_UNAVAILABLE');
    assert.equal(f.internetRequests.length, 0);
  } finally { await f.close(); }
});

test('transport rejects browser origins, public HTTP configuration and rate overflow with Retry-After', async () => {
  let time = 1_000;
  const f = await fixture({ requestLimit: 1, now: () => time });
  try {
    assert.throws(() => createSandboxApp({ sources: f.sources, host: '0.0.0.0' }), /PUBLIC_MCP_URL/);
    assert.throws(() => createSandboxApp({ sources: f.sources, publicUrl: 'http://public.example/mcp' }), /HTTPS/);
    assert.equal((await fetch(f.url, { method: 'POST', headers: { Origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await fetch(f.url)).status, 405);
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) };
    assert.equal((await fetch(f.url, options)).status, 200);
    const limited = await fetch(f.url, options);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
    time += 60_000;
    assert.equal((await fetch(f.url, options)).status, 200);
  } finally { await f.close(); }
});

test('the actual terminal command calls the sandbox; anonymous mode drops an existing bearer token', async () => {
  const f = await fixture();
  try {
    const run = promisify(execFile);
    const cli = ['node_modules/tsx/dist/cli.mjs', 'src/workshop-client.ts', '--url', f.url.href, '--anonymous'];
    const response = await run(process.execPath, [...cli, 'get_customer_file', '{"customerId":"DEMO-PERSON-1"}'], {
      env: { ...process.env, MCP_TOKEN: 'must-not-be-forwarded' }, timeout: 15_000,
    });
    assert.match(response.stdout, /Alex Example/);
    assert.doesNotMatch(response.stdout + response.stderr, /must-not-be-forwarded/);
    assert.ok(f.authorizationPresent.length > 0);
    assert.ok(f.authorizationPresent.every((present) => !present));
    const malformed = run(process.execPath, [...cli, 'get_customer_file', '{invalid'], { timeout: 15_000 });
    await assert.rejects(malformed, (error: unknown) => {
      assert.ok(error instanceof Error && 'stderr' in error);
      assert.match(String(error.stderr), /valid JSON/);
      return true;
    });
  } finally { await f.close(); }
});
