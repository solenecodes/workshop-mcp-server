import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientConfig, labStep, shareUrl, validateEndpoint } from '../sessions/01-mcp-fondamentaux/presentation-lab.mjs';

test('participant URLs accept HTTPS or loopback but reject embedded secrets and public open mode', () => {
  assert.equal(validateEndpoint('https://claims.example.org/mcp', 'bearer').local, false);
  for (const endpoint of ['http://127.0.0.1:3102/mcp', 'http://localhost:3102/mcp', 'http://[::1]:3102/mcp']) {
    assert.equal(validateEndpoint(endpoint, 'open').local, true);
  }
  for (const endpoint of [
    'javascript:alert(1)', 'http://claims.example.org/mcp', 'not a URL',
    'https://user:secret@claims.example.org/mcp', 'https://claims.example.org/mcp?token=secret',
    'https://claims.example.org/mcp#secret', 'file:///etc/passwd',
  ]) assert.throws(() => validateEndpoint(endpoint, 'bearer'));
  assert.throws(() => validateEndpoint('https://claims.example.org/mcp', 'open'));
  assert.throws(() => validateEndpoint('https://claims.example.org/mcp', 'unknown'));
});

test('VS Code config prompts for bearer tokens and does not claim a demo OAuth flow', () => {
  const bearer = clientConfig({ endpoint: 'https://claims.example.org/mcp', access: 'bearer' });
  assert.equal(bearer.servers['claims-workshop'].headers.Authorization, 'Bearer ${input:claimsWorkshopToken}');
  assert.equal(bearer.inputs[0].password, true);
  for (const access of ['oauth', 'open']) {
    const config = clientConfig({ endpoint: 'http://localhost:3102/mcp', access });
    assert.equal(config.inputs, undefined);
    assert.equal(config.servers['claims-workshop'].headers, undefined);
  }
});

test('shared links contain endpoint/access only and land directly in the practice chapter', () => {
  const url = new URL(shareUrl('https://pages.example.org/lesson.html?token=must-not-propagate#why', {
    endpoint: 'https://claims.example.org/mcp', access: 'bearer',
  }));
  assert.deepEqual([...url.searchParams.keys()], ['endpoint', 'access']);
  assert.equal(url.hash, '#lab');
  assert.equal(url.searchParams.get('endpoint'), 'https://claims.example.org/mcp');
  assert.doesNotMatch(url.href, /must-not-propagate/);
});

test('all six practice steps produce endpoint-specific commands and correct secure/open expectations', () => {
  for (const access of ['bearer', 'open', 'oauth']) {
    const settings = { endpoint: 'http://127.0.0.1:3102/mcp', access };
    for (let i = 0; i < 6; i++) {
      const step = labStep(i, settings);
      assert.ok(step.code && step.expected && step.inspectorCode && step.terminalCode);
      if (access === 'bearer') {
        assert.match(step.terminalCode, /export MCP_URL='http:\/\/127.0.0.1:3102\/mcp'/);
        assert.match(step.terminalCode, /read -r -s/);
        assert.doesNotMatch(step.terminalCode, /demo-admin-token|demo-supervisor-token/);
      }
      if (access === 'oauth') assert.match(step.terminalCode, /Use VS Code or Inspector/);
    }
    const write = labStep(3, settings);
    assert.equal(write.tool, 'create_claim_note');
    assert.equal(write.args.claimId, 'CLM-1001');
    assert.match(write.expected, access === 'open' ? /immediately stored/ : /NOT been stored/);
  }
  assert.throws(() => labStep(8, { endpoint: 'http://127.0.0.1/mcp', access: 'open' }));
});

test('shell-quoted endpoints cannot become command substitution', () => {
  const step = labStep(1, { endpoint: "https://claims.example.org/a'b", access: 'bearer' });
  assert.match(step.terminalCode, /a'\\''b/);
});
