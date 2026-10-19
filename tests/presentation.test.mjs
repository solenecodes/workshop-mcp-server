import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultEndpoint, defaultProtectedEndpoint, labCommand, labSteps, securityCode, setupCode, shareUrl, validateEndpoint } from '../sessions/01-mcp-fondamentaux/presentation-lab.mjs';
import { jsonTokens } from '../sessions/01-mcp-fondamentaux/mcp-console.mjs';

test('JSON highlighting preserves actual formatted data and classifies JSON values without HTML', () => {
  const value = { 'escaped"key': '</span><script>alert("demo")</script>', count: -1.25e20, enabled: true, disabled: false, empty: null, nested: ['line\nbreak', {}] };
  const tokens = jsonTokens(value);
  assert.equal(tokens.map(({ text }) => text).join(''), JSON.stringify(value, null, 2));
  for (const kind of ['key', 'string', 'number', 'boolean', 'null', 'plain']) {
    assert.ok(tokens.some((token) => token.kind === kind));
  }
  assert.equal(tokens.find(({ text }) => text === '"enabled"').kind, 'key');
  assert.equal(tokens.find(({ text }) => text === 'null').kind, 'null');
  assert.equal(tokens.find(({ text }) => text.includes('<script>')).kind, 'string');
  assert.ok(tokens.every(({ focus }) => focus === false));
});

test('focused keys highlight only their own line, values included', () => {
  const tokens = jsonTokens({ customer: { customerName: 'Alex', customerId: 'ID' }, rate: 1.1 }, ['customerName', 'rate']);
  const focused = tokens.filter(({ focus }) => focus).map(({ text }) => text).join('');
  assert.match(focused, /"customerName": "Alex",?/);
  assert.match(focused, /"rate": 1\.1/);
  assert.doesNotMatch(focused, /customerId/);
});

test('public sandbox URLs allow HTTPS and loopback HTTP, but never credentials or remote HTTP', () => {
  assert.equal(validateEndpoint('https://sandbox.example.org/mcp').local, false);
  assert.equal(validateEndpoint(defaultEndpoint).local, false);
  assert.equal(validateEndpoint(defaultProtectedEndpoint).local, false);
  assert.notEqual(defaultEndpoint, defaultProtectedEndpoint);
  assert.match(defaultEndpoint, /\.azurecontainerapps\.io\/mcp$/);
  for (const endpoint of ['http://127.0.0.1:3201/mcp', 'http://localhost:3201/mcp', 'http://[::1]:3201/mcp']) {
    assert.equal(validateEndpoint(endpoint).local, true);
  }
  for (const endpoint of [
    'javascript:alert(1)', 'http://sandbox.example.org/mcp', 'not a URL',
    'https://user:secret@sandbox.example.org/mcp', 'https://sandbox.example.org/mcp?token=secret',
    'https://sandbox.example.org/mcp#secret', 'file:///etc/passwd',
  ]) assert.throws(() => validateEndpoint(endpoint));
});

test('shared links preserve both endpoints but never page parameters or credentials', () => {
  const url = new URL(shareUrl('https://pages.example.org/lesson.html?token=must-not-propagate#why', {
    endpoint: 'https://sandbox.example.org/mcp', protectedEndpoint: 'https://protected.example.org/mcp',
  }));
  assert.deepEqual([...url.searchParams.keys()], ['endpoint', 'protectedEndpoint']);
  assert.equal(url.hash, '#lab');
  assert.equal(url.searchParams.get('endpoint'), 'https://sandbox.example.org/mcp');
  assert.equal(url.searchParams.get('protectedEndpoint'), 'https://protected.example.org/mcp');
  assert.doesNotMatch(url.href, /must-not-propagate/);
  assert.throws(() => shareUrl(url.href, { endpoint: defaultEndpoint, protectedEndpoint: 'https://protected.example.org/?token=secret' }));
});

test('six guided steps build one copyable curl request each and mark only what changed', () => {
  const settings = { endpoint: 'https://sandbox.example.org/mcp' };
  const commands = labSteps.map((_, index) => labCommand(index, settings));
  assert.equal(commands.length, 6);
  assert.deepEqual(commands.map((step) => step.request.params?.name ?? step.request.method), [
    'tools/list', 'get_customer_file', 'get_customer_file', 'list_customer_claims', 'get_exchange_rate', 'get_customer_overview']);
  for (const step of commands) {
    assert.ok(step.title && step.why && step.notice && step.focus.length);
    assert.match(step.code, /^curl -s 'https:\/\/sandbox.example.org\/mcp' \\\n/);
    assert.ok(step.code.includes(`-d '${JSON.stringify(step.request)}'`));
    assert.equal(step.segments.map(({ text }) => text).join(''), step.code);
    assert.ok(step.segments.some(({ changed }) => changed), 'each step highlights something');
    assert.doesNotMatch(step.code, /MCP_TOKEN|Authorization|demo-.*-token/i);
  }
  // Step 3 differs from step 2 only by the customer.
  assert.deepEqual(commands[2].segments.filter(({ changed }) => changed).map(({ text }) => text), ['DEMO-PERSON-2']);
  assert.deepEqual(commands[5].segments.filter(({ changed }) => changed).map(({ text }) => text),
    ['get_customer_overview', '"targetCurrency":"USD"']);
  for (const index of [-1, 6, 8]) assert.throws(() => labCommand(index, settings));
  assert.match(setupCode, /npm ci/);
});

test('protected commands contrast no identity and prompted identity without putting tokens in a URL', () => {
  const commands = securityCode('https://protected.example.org/mcp');
  assert.match(commands.anonymous, /--anonymous get_customer_overview/);
  assert.match(commands.authenticated, /read -r -s/);
  assert.match(commands.authenticated, /unset MCP_TOKEN$/);
  assert.doesNotMatch(commands.authenticated, /--anonymous|demo-.*-token/);
  assert.throws(() => securityCode('http://protected.example.org/mcp'));
});

test('shell-quoted endpoints cannot become shell expansion and the page contains the guided lab and no French', () => {
  const step = labCommand(0, { endpoint: "https://sandbox.example.org/a'b" });
  assert.match(step.code, /a'\\''b/);
  const html = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.html', import.meta.url), 'utf8');
  for (const id of ['lab-tabs', 'lab-command', 'lab-output', 'lab-run', 'lab-copy', 'scenario-title']) assert.ok(html.includes(`id="${id}"`));
  assert.doesNotMatch(html, /id="console-(form|operation)"|class="terminal-exercise"/);
  const visible = [html, readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation-lab.mjs', import.meta.url), 'utf8')].join('\n');
  assert.doesNotMatch(visible, /[àâçéèêëîïôûùüœ]|\b(?:le|la|les|des|pour|avec|votre|vous|une?)\b(?=\s+[a-z])/i);
  for (const customer of ['DEMO-PERSON-1', 'DEMO-PERSON-5']) assert.ok(html.includes(customer));
});
