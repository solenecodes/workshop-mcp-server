import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { securityChapters, securityPractice } from '../sessions/01-mcp-fondamentaux/presentation-security.mjs';
import { parseCommandRequest, securityCode } from '../sessions/01-mcp-fondamentaux/presentation-lab.mjs';

const html = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.js', import.meta.url), 'utf8');
const settings = { endpoint: 'https://public.example/mcp', protectedEndpoint: 'https://protected.example/mcp' };

test('the 30-minute course starts with the experiment and preserves the website agenda', () => {
  assert.equal(securityChapters.reduce((sum, { minutes }) => sum + minutes, 0), 30);
  assert.equal(securityChapters[0].minutes, 10);
  const chapters = [...html.matchAll(/<section id="([^"]+)" class="chapter" data-session="session-3"/g)].map(([, id]) => id);
  assert.deepEqual(chapters, securityChapters.map(({ id }) => id));
  assert.equal(chapters[0], 'security-lab');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `Unresolved #${id}`);
  for (const { id } of securityChapters) assert.ok(html.includes(`href="#${id}"`));
  const agenda = [...html.matchAll(/data-key="([^"]+)"[^>]*data-start="([^"]+)" data-end="([^"]+)"/g)]
    .map(([, key, start, end]) => [key, start, end]);
  assert.deepEqual(agenda, [
    ['welcome', '09:00', '09:30'], ['introductions', '09:30', '09:45'], ['session-1', '09:45', '10:15'],
    ['break-morning', '10:15', '10:30'], ['session-2', '10:30', '11:00'], ['session-3', '11:00', '11:30'],
    ['session-4', '11:30', '12:15'], ['lunch', '12:15', '14:00'], ['parking-review', '14:00', '14:30'],
    ['hands-on', '14:30', '16:00'], ['use-cases', '16:00', '16:30'],
  ]);
  assert.match(html, /class="agenda-row" href="#security-lab"><time>11:00/);
  for (const id of ['why', 'anatomy', 'mcp', 'api', 'lab']) assert.ok(ids.includes(id));
});

test('explanations use the ticket experiment, without new animations or fictional JWT machinery', () => {
  assert.deepEqual([...html.matchAll(/data-flow="([^"]+)"/g)].map(([, id]) => id), ['call', 'auth']);
  assert.doesNotMatch(html + script, /data-flow="(?:rights|hops)"|teachingToken|decodeTeachingToken|token-decode|token-encoded/);
  assert.doesNotMatch(html, /<input[^>]*(?:id|name)="(?:token|bearer|credential)"/i);
  for (const text of [
    'Fictional claim excerpt', 'Reading claims is not verifying a token',
    'Roles can also appear in user tokens', 'does not implement per-ticket user ACLs',
    'OBO is explained here but is not implemented', 'local sandbox uses a synthetic loopback',
    'Microsoft Sherpa workshop', 'Test → observe → explain',
  ]) assert.ok(html.includes(text), `Missing teaching boundary: ${text}`);
  for (const id of ['security-observation', 'security-question', 'security-answer']) assert.ok(html.includes(`id="${id}"`));
  assert.match(script, /\$\('#security-observation'\)\.open = false/);
});

test('the same request progresses from public to 401, allowed and 403, with explicit observations', () => {
  const cases = securityPractice(settings);
  assert.equal(cases.length, 4);
  assert.equal(cases.filter(({ browser }) => browser).length, 1);
  assert.deepEqual(cases.map(({ short }) => short), ['Public', 'No token', 'Allowed', 'Not permitted']);
  assert.match(cases[0].code, /public\.example/);
  assert.doesNotMatch(cases[0].code, /Authorization|MCP_TOKEN/);
  assert.deepEqual(parseCommandRequest(cases[0].code).params, { name: 'get_ticket', arguments: { ticketId: 'CT-1001' } });
  assert.match(cases[1].code, /--anonymous get_ticket/);
  assert.match(cases[1].output, /401/);
  assert.match(cases[2].output, /CT-1001/);
  assert.match(cases[3].output, /403/);
  for (const item of cases) assert.ok(item.question && item.answer && item.why);
  for (const item of cases.slice(1)) {
    assert.match(item.code, /protected\.example/);
    assert.match(item.code, /get_ticket '\{"ticketId":"CT-1001"\}'/);
    assert.match(item.output, /Expected outcome/);
    assert.doesNotMatch(item.code, /demo-.*-token/);
  }
  assert.equal(cases[2].code, cases[3].code);
  for (const item of cases.slice(2)) {
    assert.match(item.code, /read -r -s/);
    assert.match(item.code, /unset MCP_TOKEN$/);
  }
  assert.match(cases[3].why, /fake, expired or wrong-audience token demonstrates 401/);
  assert.equal(securityPractice({ endpoint: settings.endpoint })[1].code, undefined);
  assert.throws(() => securityPractice({ ...settings, protectedEndpoint: settings.endpoint }), /separate/);
  assert.throws(() => securityPractice({ ...settings, protectedEndpoint: 'http://untrusted.example/mcp' }));
  assert.match(script, /callMcp\(config.endpoint, parseCommandRequest\(command\)\)/);
  assert.doesNotMatch(script, /callMcp\([^)]*protectedEndpoint|\.innerHTML|localStorage|sessionStorage/);
  assert.match(script, /securityIndex >= 0 \? 'session-3'/);
});

test('the approved acquisition path uses an exported token without prompting for it again', () => {
  const { withToken } = securityCode(settings.protectedEndpoint);
  assert.match(withToken, /--url 'https:\/\/protected\.example\/mcp' get_ticket '\{"ticketId":"CT-1001"\}'/);
  assert.match(withToken, /unset MCP_TOKEN$/);
  assert.doesNotMatch(withToken, /read |--anonymous|echo|printf/);
  assert.match(script, /const codeTargets = \['anonymous-code', 'authenticated-code', 'acquired-code'\]/);
  assert.match(script, /\$\('#acquired-code'\)\.textContent = commands\.withToken/);
  assert.match(html, /MCP_TOKEN=\$\(az account get-access-token/);
  assert.match(html, /After acquisition succeeds/);
});
