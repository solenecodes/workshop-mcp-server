import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSandboxApp } from '../src/sandbox/server.ts';
import { createSources, startInternalApi } from '../src/sandbox/sources.ts';
import { callMcp } from '../sessions/01-mcp-fondamentaux/mcp-console.mjs';
import { labCommand, parseCommandRequest } from '../sessions/01-mcp-fondamentaux/presentation-lab.mjs';

const stepRequest = (index) => labCommand(index, { endpoint: 'https://public.example/mcp' }).request;
const tool = (name, args) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

const origin = 'https://workshop.example';
async function fixture() {
  const internal = await startInternalApi();
  let internetCalls = 0;
  const sources = await createSources(internal.url, async (input, init) => {
    if (new URL(String(input)).hostname === '127.0.0.1') return fetch(input, init);
    internetCalls++;
    return new Response('The workshop server must not call the Internet.', { status: 503 });
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

test('the three guided requests run against the real stateless server and only read-only requests can be sent', async () => {
  const f = await fixture();
  try {
    const replies = [];
    for (let index = 0; index < 3; index++) replies.push(await callMcp(f.url, stepRequest(index), f.browserFetch));
    assert.deepEqual(replies[0].result.tools.map((tool) => tool.name).sort(), ['get_ticket', 'list_tickets']);
    assert.deepEqual(replies[1].result.structuredContent.tickets.map((ticket) => ticket.id), ['CT-1001', 'CT-1002', 'CT-1003']);
    assert.equal(replies[2].result.structuredContent.ticket.id, 'CT-1001');
    for (const reply of replies) assert.notEqual(reply.result.isError, true);
    const unknown = await callMcp(f.url, parseCommandRequest(labCommand(2, { endpoint: f.url }).code.replace('CT-1001', 'CT-9999')), f.browserFetch);
    assert.equal(unknown.result.isError, true);
    assert.equal(unknown.result.structuredContent.error, 'TICKET_NOT_FOUND');
    const edited = parseCommandRequest(labCommand(2, { endpoint: f.url }).code.replace('CT-1001', 'CT-1002'));
    assert.equal((await callMcp(f.url, edited, f.browserFetch)).result.structuredContent.ticket.id, 'CT-1002');
    await assert.rejects(callMcp(f.url, tool('close_ticket', {})), /read-only/);
    await assert.rejects(callMcp(f.url, { jsonrpc: '2.0', id: 1, method: 'resources/list' }), /read-only/);
    const malformed = await callMcp(f.url, tool('get_ticket', { ticketId: 'not-an-id' }), f.browserFetch);
    assert.equal(malformed.result.isError, true);
    assert.equal(f.internetCalls(), 0);
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

test('the session 3 live inventory exposes the real strict read-only capability boundary, not approval or identity features', async () => {
  const f = await fixture();
  try {
    const request = labCommand(0, { endpoint: f.url }).request;
    const { result } = await callMcp(f.url, request, f.browserFetch);
    assert.deepEqual(result.tools.map(({ name }) => name).sort(), ['get_ticket', 'list_tickets']);
    for (const tool of result.tools) {
      assert.equal(tool.annotations.readOnlyHint, true);
      assert.equal(tool.inputSchema.additionalProperties, false);
    }
    assert.equal(result.tools.some(({ name }) => name === 'close_ticket'), false);
    assert.equal((await callMcp(f.url, stepRequest(2), f.browserFetch)).result.structuredContent.ticket.id, 'CT-1001');
    assert.equal(f.internetCalls(), 0);
  } finally { await f.close(); }
});

test('twenty concurrent browser participants get complete results without any Internet call', async t => {
  const f = await fixture();
  try {
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      callMcp(f.url, tool('get_ticket', { ticketId: `CT-100${index % 3 + 1}` }), f.browserFetch)));
    assert.ok(results.every((reply, index) => reply.result.isError !== true && reply.result.structuredContent.ticket.id === `CT-100${index % 3 + 1}`));
    assert.equal(f.internetCalls(), 0);
    const times = results.map(reply => reply.elapsedMs).sort((a, b) => a - b);
    const p95 = times[Math.ceil(times.length * 0.95) - 1];
    assert.ok(p95 < 5000, `Local 20-participant p95 ${p95} ms exceeds 5 seconds`);
    t.diagnostic(`20/20 successful, p95 ${p95} ms`);
  } finally { await f.close(); }
});

test('console surfaces HTTP limits, invalid protocol responses and transport failures explicitly', async () => {
  const call = (fetcher) => callMcp('https://public.example/mcp', stepRequest(0), fetcher);
  await assert.rejects(call(async () => new Response('', { status: 429, headers: { 'Retry-After': '12' } })), /12 seconds/);
  await assert.rejects(call(async () => Response.json({ jsonrpc: '2.0', id: 99, result: {} })), /invalid MCP response/);
  await assert.rejects(call(async () => { throw new Error('Network offline'); }), /Network offline/);
  await assert.rejects(call(async () => { throw new DOMException('signal timed out', 'TimeoutError'); }), /within 60 seconds.*starting/);
});
