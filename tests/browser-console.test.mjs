import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSandboxApp } from '../src/sandbox/server.ts';
import { createSources, startInternalApi } from '../src/sandbox/sources.ts';
import { callMcp } from '../sessions/01-mcp-fondamentaux/mcp-console.mjs';
import { labCommand } from '../sessions/01-mcp-fondamentaux/presentation-lab.mjs';

const stepRequest = (index) => labCommand(index, { endpoint: 'https://public.example/mcp' }).request;
const tool = (name, args) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

const origin = 'https://workshop.example';
async function fixture() {
  const internal = await startInternalApi();
  let internetCalls = 0;
  const sources = await createSources(internal.url, async (input, init) => {
    if (new URL(String(input)).hostname === '127.0.0.1') return fetch(input, init);
    internetCalls++;
    return Response.json({ date: '2026-10-16', base: 'EUR', quote: 'USD', rate: 1.1 });
  });
  const app = createSandboxApp({ sources, consoleOrigin: origin, log: () => {} });
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  const browserFetch = (input, init) => {
    assert.equal(init.credentials, 'omit');
    const headers = new Headers(init.headers);
    assert.equal(headers.has('authorization'), false);
    headers.set('Origin', origin);
    return fetch(input, { ...init, headers });
  };
  return {
    sources, url, browserFetch, internetCalls: () => internetCalls,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      sources.close();
      await internal.close();
    },
  };
}

test('the six guided requests run against the real stateless server and only read-only requests can be sent', async () => {
  const f = await fixture();
  try {
    const replies = [];
    for (let index = 0; index < 6; index++) replies.push(await callMcp(f.url, stepRequest(index), f.browserFetch));
    assert.equal(replies[0].result.tools.length, 4);
    for (const reply of replies.slice(1)) assert.notEqual(reply.result.isError, true);
    assert.equal(replies[1].result.structuredContent.customer.customerId, 'DEMO-PERSON-1');
    assert.equal(replies[2].result.structuredContent.customer.customerId, 'DEMO-PERSON-2');
    assert.equal(replies[3].result.structuredContent.claims[0].currency, 'EUR');
    assert.equal(replies[4].result.structuredContent.exchangeRate.quote, 'USD');
    assert.equal(replies[5].result.structuredContent.sources.length, 3);
    await assert.rejects(callMcp(f.url, tool('escalate_claim', {})), /read-only/);
    await assert.rejects(callMcp(f.url, { jsonrpc: '2.0', id: 1, method: 'resources/list' }), /read-only/);
    const invalid = await callMcp(f.url, tool('get_customer_file', { customerId: 'DEMO-PERSON-99' }), f.browserFetch);
    assert.equal(invalid.result.isError, true);
  } finally { await f.close(); }
});

test('console CORS is exact-origin, rejects credentials and leaves protected endpoint browser access disabled', async () => {
  const f = await fixture();
  try {
    const preflight = await fetch(f.url, { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,mcp-protocol-version',
    } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
    for (const bad of ['https://workshop.example.attacker.test', 'null', 'https://untrusted.example']) {
      assert.equal((await fetch(f.url, { method: 'OPTIONS', headers: { Origin: bad } })).status, 403);
    }
    assert.equal((await fetch(f.url, { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization',
    } })).status, 403);
    assert.throws(() => createSandboxApp({ sources: f.sources, consoleOrigin: origin, verifyToken: async () => ({ userId: 'reader', canReadPii: false }) }), /public read-only/);
    assert.throws(() => createSandboxApp({ sources: f.sources, consoleOrigin: `${origin}/path` }), /exact HTTPS origin/);
    assert.throws(() => createSandboxApp({ sources: f.sources, consoleOrigin: 'http://workshop.example' }), /exact HTTPS origin/);
  } finally { await f.close(); }
});

test('twenty concurrent browser participants get complete results with one shared Internet fetch', async t => {
  const f = await fixture();
  try {
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      callMcp(f.url, tool('get_customer_overview', { customerId: `DEMO-PERSON-${index % 5 + 1}`, targetCurrency: 'USD' }), f.browserFetch)));
    assert.ok(results.every(reply => reply.result.isError !== true && reply.result.structuredContent.sources.length === 3));
    assert.equal(f.internetCalls(), 1);
    const times = results.map(reply => reply.elapsedMs).sort((a, b) => a - b);
    const p95 = times[Math.ceil(times.length * 0.95) - 1];
    assert.ok(p95 < 5000, `Local 20-participant p95 ${p95} ms exceeds 5 seconds`);
    t.diagnostic(`20/20 successful, p95 ${p95} ms, one shared FX fetch`);
  } finally { await f.close(); }
});

test('console surfaces HTTP limits, invalid protocol responses and transport failures explicitly', async () => {
  const call = (fetcher) => callMcp('https://public.example/mcp', stepRequest(0), fetcher);
  await assert.rejects(call(async () => new Response('', { status: 429, headers: { 'Retry-After': '12' } })), /12 seconds/);
  await assert.rejects(call(async () => Response.json({ jsonrpc: '2.0', id: 99, result: {} })), /invalid MCP response/);
  await assert.rejects(call(async () => { throw new Error('Network offline'); }), /Network offline/);
  await assert.rejects(call(async () => { throw new DOMException('signal timed out', 'TimeoutError'); }), /within 60 seconds.*starting/);
});
