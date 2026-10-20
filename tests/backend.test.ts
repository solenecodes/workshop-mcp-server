import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Server } from 'node:http';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import initSqlJs from 'sql.js';
import { z } from 'zod';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createBackendApp } from '../src/backend/api.js';
import { appServiceAccessToken } from '../src/backend/identity.js';
import { createBackendStore } from '../src/backend/store.js';
import { createSources } from '../src/sandbox/sources.js';
import { AuthenticationError, createEntraVerifier } from '../src/sandbox/auth.js';

async function fixture(options: Partial<Omit<Parameters<typeof createBackendApp>[0], 'store'>> = {}) {
  const store = await createBackendStore();
  const logs: Record<string, unknown>[] = [];
  const server = await new Promise<Server>((resolve) => {
    const listener = createBackendApp({ store, log: (entry) => logs.push(entry), ...options }).listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  return {
    store, logs, url,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      store.close();
    },
  };
}

test('the Contoso Tickets REST API follows its OpenAPI contract with real SQL data', async () => {
  const f = await fixture();
  try {
    const response = await fetch(`${f.url}/contoso-tickets/tickets`);
    const tickets = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(tickets.map((ticket: { id: string }) => ticket.id), ['CT-1001', 'CT-1002', 'CT-1003']);
    assert.deepEqual(tickets[0], { id: 'CT-1001', title: 'VPN gateway reports intermittent timeouts', severity: 'high', status: 'open', service: 'network' });
    const one = await (await fetch(`${f.url}/contoso-tickets/tickets/CT-1003`)).json();
    assert.equal(one.status, 'resolved');
    const spec = await (await fetch(`${f.url}/openapi/contoso-tickets.json`)).json();
    assert.equal(spec.openapi, '3.0.3');
    assert.equal(spec.info.title, 'Contoso Tickets API');
    assert.deepEqual(spec.servers, [{ url: `${f.url}/contoso-tickets` }]);
    assert.deepEqual(Object.keys(spec.paths), ['/tickets', '/tickets/{ticketId}']);
    assert.deepEqual([spec.paths['/tickets'].get.operationId, spec.paths['/tickets/{ticketId}'].get.operationId], ['list-tickets', 'get-ticket']);
    assert.ok(f.logs.some((entry) => entry.service === 'tickets-api'));
  } finally { await f.close(); }
});

test('REST errors distinguish malformed requests, unknown tickets, unsupported writes and browser requests', async () => {
  const f = await fixture();
  try {
    for (const [path, expected] of [
      ['/contoso-tickets/tickets/not-an-id', 400],
      ['/contoso-tickets/tickets/CT-9999', 404],
      ['/contoso-tickets/unknown', 404],
    ] as const) {
      const response = await fetch(f.url + path);
      assert.equal(response.status, expected, path);
      assert.match(response.headers.get('content-type') ?? '', /application\/problem\+json/);
      assert.equal((await response.json()).status, expected);
    }
    const write = await fetch(`${f.url}/contoso-tickets/tickets/CT-1001`, { method: 'DELETE' });
    assert.equal(write.status, 405);
    assert.equal(write.headers.get('allow'), 'GET, HEAD');
    assert.equal((await fetch(`${f.url}/contoso-tickets/tickets`, { headers: { Origin: 'https://example.org' } })).status, 403);
    assert.throws(() => createBackendApp({ store: f.store, host: '0.0.0.0', publicUrl: 'https://backend.example/' }), /Entra authentication/);
    assert.throws(() => createBackendApp({ store: f.store, publicUrl: 'http://backend.example/' }), /HTTPS/);
  } finally { await f.close(); }
});

test('SQLite data survives process restarts, concurrent initialization is atomic, and corruption is not replaced', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'workshop-api-store-'));
  const path = join(directory, 'business.sqlite');
  try {
    const stores = await Promise.all([createBackendStore(path), createBackendStore(path)]);
    for (const store of stores) { assert.equal(store.tickets().length, 3); store.close(); }
    assert.deepEqual(await readdir(directory), ['business.sqlite']);
    const SQL = await initSqlJs();
    const database = new SQL.Database(await readFile(path));
    database.run('UPDATE tickets SET status = ? WHERE id = ?', ['resolved', 'CT-1001']);
    await writeFile(path, database.export());
    database.close();
    const reopened = await createBackendStore(path);
    assert.equal(reopened.ticket('CT-1001')?.status, 'resolved');
    reopened.close();
    await writeFile(path, 'not a SQLite database');
    await assert.rejects(createBackendStore(path));
    assert.equal(await readFile(path, 'utf8'), 'not a SQLite database');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('protected REST API rejects missing or invalid service credentials', async () => {
  const f = await fixture({
    verifyToken: async (token) => {
      if (token !== 'synthetic-service-reader') throw new AuthenticationError(403, 'INSUFFICIENT_PERMISSION');
      return { userId: 'synthetic-service', canReadPii: false };
    },
  });
  try {
    const path = `${f.url}/contoso-tickets/tickets/CT-1001`;
    const missing = await fetch(path);
    assert.equal(missing.status, 401);
    assert.match(missing.headers.get('www-authenticate') ?? '', /^Bearer/);
    assert.equal((await fetch(path, { headers: { Authorization: 'Bearer wrong-token' } })).status, 403);
    const authorized = await fetch(path, { headers: { Authorization: 'Bearer synthetic-service-reader' } });
    assert.equal(authorized.status, 200);
    assert.equal((await authorized.json()).id, 'CT-1001');
    const spec = await (await fetch(`${f.url}/openapi/contoso-tickets.json`)).json();
    assert.deepEqual(spec.security, [{ bearerAuth: [] }]);
    assert.equal(JSON.stringify(f.logs).includes('synthetic-service-reader'), false);
    assert.ok(f.logs.some((entry) => entry.status === 403));
  } finally { await f.close(); }
});

test('REST rate overflow returns a problem response and Retry-After', async () => {
  const f = await fixture({ requestLimit: 2 });
  try {
    for (let index = 0; index < 2; index++) {
      assert.equal((await fetch(`${f.url}/contoso-tickets/tickets`)).status, 200);
    }
    const response = await fetch(`${f.url}/contoso-tickets/tickets`);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '60');
    assert.equal((await response.json()).title, 'RATE_LIMITED');
  } finally { await f.close(); }
});

test('MCP adapter calls the ticket API over HTTP with the service credential and maps 404 to a clear error', async () => {
  const f = await fixture();
  const paths: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://backend.example');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-test-token');
    paths.push(url.pathname);
    return fetch(f.url + url.pathname + url.search, init);
  };
  const sources = await createSources('https://backend.example', fetcher, async () => 'synthetic-test-token');
  try {
    assert.equal((await sources.listTickets()).length, 3);
    assert.equal((await sources.ticket('CT-1002')).service, 'storage');
    await assert.rejects(sources.ticket('CT-9999'), { code: 'TICKET_NOT_FOUND' });
    assert.deepEqual(paths, ['/contoso-tickets/tickets', '/contoso-tickets/tickets/CT-1002', '/contoso-tickets/tickets/CT-9999']);
    await assert.rejects(createSources('https://backend.example'), /service authentication/);
    await assert.rejects(createSources('http://backend.example'), /service authentication/);
  } finally { sources.close(); await f.close(); }
});

test('App Service native identity acquisition uses its local protected endpoint, validates results and deduplicates token requests', async () => {
  const clientId = '22222222-2222-4222-8222-222222222222';
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('resource'), `api://${clientId}`);
    assert.equal(url.searchParams.get('api-version'), '2019-08-01');
    assert.equal(new Headers(init?.headers).get('X-IDENTITY-HEADER'), 'synthetic-platform-header');
    assert.equal(init?.redirect, 'error');
    return Response.json({ access_token: 'synthetic-access-token', expires_on: String(Math.floor(Date.now() / 1000) + 3600), token_type: 'Bearer', resource: `api://${clientId}` });
  };
  const token = appServiceAccessToken({ clientId, endpoint: 'http://169.254.129.2/msi/token', identityHeader: 'synthetic-platform-header', fetcher });
  assert.deepEqual(await Promise.all([token(), token(), token()]), Array(3).fill('synthetic-access-token'));
  assert.equal(calls, 1);
  assert.throws(() => appServiceAccessToken({ clientId, endpoint: 'https://external.example/token', identityHeader: 'synthetic-platform-header' }), /local HTTP/);
  const invalid = appServiceAccessToken({ clientId, endpoint: 'http://127.0.0.1/msi/token', identityHeader: 'synthetic-platform-header', fetcher: async () => Response.json({ access_token: 'invalid' }) });
  await assert.rejects(invalid(), /invalid or expired/);
});

test('backend authorization requires its own application role, not a participant MCP scope', async () => {
  const tenant = '11111111-1111-4111-8111-111111111111';
  const audience = '22222222-2222-4222-8222-222222222222';
  const pair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(pair.publicKey);
  const verify = createEntraVerifier(tenant, audience, createLocalJWKSet({ keys: [{ ...jwk, kid: 'backend', alg: 'RS256' }] }), 'Mcp.Backend.Read');
  const signed = (claims: object) => new SignJWT({ oid: '33333333-3333-4333-8333-333333333333', tid: tenant, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'backend' }).setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
    .setAudience(audience).setIssuedAt().setExpirationTime('5m').sign(pair.privateKey);
  await assert.rejects(verify(await signed({ scp: 'Mcp.Read' })), /MISSING_BACKEND_READ_PERMISSION/);
  await assert.rejects(verify(await signed({ scp: 'Mcp.Backend.Read' })), /MISSING_BACKEND_READ_PERMISSION/);
  assert.equal((await verify(await signed({ roles: ['Mcp.Backend.Read'] }))).canReadPii, false);
});
