import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createContosoTickets } from '../src/data/contosoTickets.js';
import { backendOpenApi } from '../src/backend/api.js';

const read = (path: string) => readFileSync(new URL(`../infra/gateway/${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bicep = read('main.bicep');
const restApi = read('policies/rest-api.xml');
const mcpServer = read('policies/mcp-server.xml');
const metadata = read('policies/protected-resource-metadata.xml');
const policies = { restApi, mcpServer, metadata };
const responses = (xml: string) => [...xml.matchAll(/<set-status code="(\d+)"[\s\S]*?<set-body>([\s\S]*?)<\/set-body>/g)]
  .map(([, status = '', body = '']) => ({ status: Number(status), body }));
const problem = (status: number) => responses(restApi).find((response) => response.status === status)?.body ?? '';

test('the gateway answers with exactly the synthetic tickets of the workshop API, and the ticket that was asked for', () => {
  const tickets = createContosoTickets();
  const ok = responses(restApi).filter((response) => response.status === 200).map((response) => JSON.parse(response.body));
  assert.deepEqual(ok[0], tickets, 'list-tickets returns the full list');
  assert.deepEqual(ok.slice(1), tickets, 'get-ticket returns each ticket once, in order');
  for (const ticket of tickets) {
    assert.match(restApi, new RegExp(`\\(string\\)context\\.Variables\\["ticket-id"\\] == "${ticket.id}"\\)">[\\s\\S]*?"id":"${ticket.id}"`),
      `${ticket.id} is returned only for its own identifier`);
  }
  assert.doesNotMatch(restApi, /<mock-response/, 'a mock-response would return the first example for every identifier');
  for (const { id, title, severity, status, service } of tickets) {
    assert.ok(bicep.includes(`{ id: '${id}', title: '${title}', severity: '${severity}', status: '${status}', service: '${service}' }`),
      `${id} operation example matches src/data/contosoTickets.ts`);
  }
});

test('errors follow the workshop API contract: 400 INVALID_ID, 404 TICKET_NOT_FOUND, 403 without Mcp.Read', () => {
  const problems = responses(restApi).filter((r) => r.status >= 400).map((r) => r.body);
  assert.match(problem(400), /"title\\":\\"INVALID_ID\\"/);
  assert.match(problem(404), /"title\\":\\"TICKET_NOT_FOUND\\"/);
  assert.match(problem(403), /MISSING_MCP_READ_PERMISSION/);
  for (const body of problems) assert.match(body, /urn:workshop:problem:/);
  assert.match(restApi, /application\/problem\+json/);
  const pattern = new RegExp(restApi.match(/IsMatch\(\(string\)context\.Variables\["ticket-id"\], "([^"]+)"\)/)?.[1] ?? 'missing');
  const api = /^CT-\d{4}$/;
  for (const id of ['CT-1001', 'CT-9999', 'CT-12', 'ct-1001', "CT-1001' OR 1=1", '']) {
    assert.equal(pattern.test(id), api.test(id), `${JSON.stringify(id)} is classified like src/backend/api.ts`);
  }
});

test('tools map to the operations of the published OpenAPI contract', () => {
  const contract = backendOpenApi('https://example.invalid') as { paths: Record<string, { get: { operationId: string } }> };
  const operations = Object.fromEntries(Object.entries(contract.paths).map(([path, item]) => [item.get.operationId, path]));
  assert.deepEqual(operations, { 'list-tickets': '/tickets', 'get-ticket': '/tickets/{ticketId}' });
  assert.match(bicep, /var toolOperations = \{ list_tickets: 'list-tickets', get_ticket: 'get-ticket' \}/);
  for (const [operation, path] of Object.entries(operations)) {
    assert.match(bicep, new RegExp(`'${operation}': \\{[\\s\\S]*?urlTemplate: '${path.replace(/[{}]/g, '\\$&')}'`));
  }
  assert.match(bicep, /path: 'contoso-tickets'\n/);
});

test('every MCP call needs a v2 token for this API and Mcp.Read, like the protected sandbox', () => {
  for (const xml of [restApi, mcpServer]) {
    assert.match(xml, /<validate-azure-ad-token tenant-id="__TENANT_ID__"/);
    assert.match(xml, /<audiences>\s*<audience>__CLIENT_ID__<\/audience>\s*<\/audiences>/);
    assert.match(xml, /Array\.IndexOf\(scopes, "Mcp\.Read"\) < 0 && Array\.IndexOf\(roles, "Mcp\.Read"\) < 0/);
  }
  assert.match(bicep, /var issuer = '\$\{environment\(\)\.authentication\.loginEndpoint\}\$\{entraTenantId\}\/v2\.0'/);
  assert.match(bicep, /var scope = 'api:\/\/\$\{entraClientId\}\/Mcp\.Read'/);
  assert.match(mcpServer, /<value>Bearer resource_metadata="__PRM_URL__"<\/value>/);
  assert.match(mcpServer, /<rate-limit-by-key calls="__RATE_LIMIT_CALLS__" renewal-period="__RATE_LIMIT_PERIOD__" counter-key="@\("__MCP_PATH__-" \+ \(string\)context\.Variables\["mcp-caller-oid"\]\)"/);
  assert.doesNotMatch(bicep, /subscriptionRequired: true|@secure\(\)|listKeys\(|listSecrets\(/);
  assert.equal([...bicep.matchAll(/subscriptionRequired: false/g)].length, 4);
});

test('policies never read message bodies and every placeholder is replaced by the template', () => {
  for (const [name, xml] of Object.entries(policies)) {
    assert.doesNotMatch(xml, /context\.(Request|Response)\.Body/, `${name} must not buffer MCP streams`);
    const placeholders = new Set([...xml.matchAll(/__[A-Z_]+__/g)].map(([value]) => value));
    for (const placeholder of placeholders) assert.ok(bicep.includes(`'${placeholder}'`), `${name}: ${placeholder} is replaced`);
  }
  assert.match(bicep, /loadTextContent\('policies\/rest-api\.xml'\)/);
  assert.match(bicep, /loadTextContent\('policies\/mcp-server\.xml'\)/);
  assert.match(bicep, /loadTextContent\('policies\/protected-resource-metadata\.xml'\)/);
  assert.match(bicep, /'Microsoft\.ApiManagement\/service\/apis@2025-09-01-preview'/);
});

test('gateway telemetry goes to Application Insights with the gateway identity, never bodies or tokens', () => {
  assert.match(bicep, /identity: \{ type: 'SystemAssigned' \}/);
  assert.match(bicep, /DisableLocalAuth: true/);
  assert.match(bicep, /identityClientId: 'SystemAssigned'/);
  assert.match(bicep, /'3913510d-42f4-4e42-8a64-420c390055eb'/, 'Monitoring Metrics Publisher for the gateway identity');
  assert.match(bicep, /var noBody = \{ headers: \[\], body: \{ bytes: 0 \} \}/);
  assert.match(bicep, /frontend: \{ request: noBody, response: noBody \}\n\s+backend: \{ request: noBody, response: noBody \}/);
  assert.match(bicep, /logClientIp: false/);
  assert.doesNotMatch(bicep, /InstrumentationKey|instrumentationKey/);
  const trace = mcpServer.match(/<trace [\s\S]*?<\/trace>/)?.[0] ?? '';
  assert.match(trace, /name="caller\.oid" value="@\(\(string\)context\.Variables\["mcp-caller-oid"\]\)"/);
  assert.doesNotMatch(trace, /Authorization|Body|Arguments/i);
  assert.ok(mcpServer.indexOf('<trace ') > mcpServer.indexOf('<validate-azure-ad-token'), 'the caller is traced only after token validation');
});
