import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultEndpoint, defaultProtectedEndpoint, labStep, securityCode, setupCode, shareUrl, validateEndpoint } from '../sessions/01-mcp-fondamentaux/presentation-lab.mjs';

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

test('exactly three terminal exercises discover, read and aggregate; public calls never send a token', () => {
  const settings = { endpoint: 'https://sandbox.example.org/mcp' };
  const commands = Array.from({ length: 3 }, (_, index) => labStep(index, settings));
  assert.match(commands[0].code, /--anonymous tools$/);
  assert.match(commands[1].code, /--anonymous get_customer_file/);
  assert.match(commands[2].code, /--anonymous get_customer_overview/);
  assert.match(commands[2].expected, /three sources/);
  for (const step of commands) {
    assert.ok(step.title && step.instruction && step.expected);
    assert.match(step.code, /--url 'https:\/\/sandbox.example.org\/mcp'/);
    assert.doesNotMatch(step.code, /MCP_TOKEN|demo-.*-token|Copilot|Inspector/);
  }
  for (const index of [-1, 3, 8]) assert.throws(() => labStep(index, settings));
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

test('shell-quoted endpoints cannot become shell expansion and static markup contains the three commands', () => {
  const step = labStep(0, { endpoint: "https://sandbox.example.org/a'b" });
  assert.match(step.code, /a'\\''b/);
  const html = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.html', import.meta.url), 'utf8');
  assert.equal((html.match(/class="terminal-exercise"/g) ?? []).length, 3);
  assert.equal((html.match(/id="lab-code-[0-2]"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /data-lab-step|id="lab-prev"|id="access"/);
  for (const command of ['--anonymous tools', '--anonymous get_customer_file', '--anonymous get_customer_overview']) assert.ok(html.includes(command));
});
