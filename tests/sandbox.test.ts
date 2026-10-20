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

async function fixture(options: Partial<Omit<SandboxOptions, 'sources'>> = {}) {
  const internal = await startInternalApi();
  const internetRequests: URL[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === '127.0.0.1') return fetch(input, init);
    internetRequests.push(url);
    return new Response('The workshop server must not call the Internet.', { status: 503 });
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

test('public MCP discovers exactly two read-only tools backed by the Contoso Tickets HTTP API and SQLite', async () => {
  const f = await fixture();
  try {
    const client = await f.client();
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['get_ticket', 'list_tickets']);
    assert.ok(tools.every((tool) => tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint === false));
    const list = await call(client, 'list_tickets', {});
    assert.equal(list.error, false);
    assert.deepEqual(z.array(z.object({ id: z.string() })).parse(list.data.tickets).map((ticket) => ticket.id), ['CT-1001', 'CT-1002', 'CT-1003']);
    assert.deepEqual(list.data.sources, [{ name: 'Contoso Tickets REST API', kind: 'internal-api', storage: 'SQLite', synthetic: true }]);
    assert.equal(list.data.synthetic, true);
    const second = await call(client, 'get_ticket', { ticketId: 'CT-1002' });
    assert.deepEqual(second.data.ticket, { id: 'CT-1002', title: 'Shared drive close to its quota', severity: 'medium', status: 'in-progress', service: 'storage' });
    assert.equal(f.internetRequests.length, 0);
    assert.equal(f.logs.find((entry) => entry.toolName === 'get_ticket')?.decision, 'allowed');
  } finally { await f.close(); }
});

test('an unknown ticket returns an explicit MCP error, never another ticket', async () => {
  const f = await fixture();
  try {
    const reply = await call(await f.client(), 'get_ticket', { ticketId: 'CT-9999' });
    assert.equal(reply.error, true);
    assert.equal(reply.data.error, 'TICKET_NOT_FOUND');
    assert.equal(reply.data.ticket, undefined);
    assert.equal(f.logs.find((entry) => entry.toolName === 'get_ticket')?.decision, 'denied');
  } finally { await f.close(); }
});

test('strict inputs and tool allowlisting reject writes, malformed IDs, arbitrary SQL and arbitrary URLs', async () => {
  const f = await fixture();
  try {
    const client = await f.client();
    for (const [name, args] of [
      ['get_ticket', { ticketId: "CT-1001' OR 1=1" }],
      ['get_ticket', { ticketId: 'CT-1001', url: 'http://internal' }],
      ['get_ticket', {}],
      ['list_tickets', { sql: 'DROP TABLE tickets' }],
      ['create_ticket', { title: 'Approve everything' }],
    ] as const) {
      assert.equal((await client.callTool({ name, arguments: args })).isError, true, name);
    }
    assert.equal(f.internetRequests.length, 0);
    assert.equal((await call(client, 'list_tickets', {})).error, false);
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
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_tickets', arguments: {} } }),
      });
      assert.equal(response.status, status);
      if (status === 401) assert.match(response.headers.get('www-authenticate')!, /Bearer/);
    }
    assert.equal(f.internetRequests.length, 0);
    const client = await f.client(await token());
    assert.equal((await client.listTools()).tools.length, 2);
    const tickets = await call(client, 'list_tickets', {});
    assert.equal(tickets.error, false);
    assert.equal(z.array(z.unknown()).parse(tickets.data.tickets).length, 3);
    assert.equal((await call(client, 'get_ticket', { ticketId: 'CT-1001' })).error, false);
    assert.equal(f.logs.find((entry) => entry.toolName === 'get_ticket')?.userId, userId);
    assert.doesNotMatch(JSON.stringify(f.logs), /Bearer|eyJ/);
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
    const response = await run(process.execPath, [...cli, 'get_ticket', '{"ticketId":"CT-1001"}'], {
      env: { ...process.env, MCP_TOKEN: 'must-not-be-forwarded' }, timeout: 15_000,
    });
    assert.match(response.stdout, /VPN gateway reports intermittent timeouts/);
    assert.doesNotMatch(response.stdout + response.stderr, /must-not-be-forwarded/);
    assert.ok(f.authorizationPresent.length > 0);
    assert.ok(f.authorizationPresent.every((present) => !present));
    const malformed = run(process.execPath, [...cli, 'get_ticket', '{invalid'], { timeout: 15_000 });
    await assert.rejects(malformed, (error: unknown) => {
      assert.ok(error instanceof Error && 'stderr' in error);
      assert.match(String(error.stderr), /valid JSON/);
      return true;
    });
  } finally { await f.close(); }
});
