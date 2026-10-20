import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parkingLotEndpoint } from '../sessions/01-mcp-fondamentaux/parking-lot.mjs';

test('parking lot uses the selected public MCP server without credentials', () => {
  assert.equal(parkingLotEndpoint('http://127.0.0.1:4173/presentation.html?endpoint=http://127.0.0.1:4174/mcp'), 'http://127.0.0.1:4174/parking-lot');
  assert.throws(() => parkingLotEndpoint('https://example.com?endpoint=https://user:password@example.com/mcp'));
});

test('parking lot renders untrusted questions as text, not HTML, in an accessible dialog', () => {
  const source = readFileSync(new URL('../sessions/01-mcp-fondamentaux/parking-lot.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.html', import.meta.url), 'utf8');
  assert.match(source, /question\.textContent = note\.question/);
  assert.doesNotMatch(source, /innerHTML|localStorage/);
  assert.match(source, /credentials: 'omit'/);
  assert.match(html, /<dialog id="parking-lot"[^>]+aria-labelledby="parking-title"/);
  assert.match(html, /id="parking-question"[^>]+maxlength="500" required/);
});

test('note colors use an accessible dot palette and the archive checkbox has inline alignment', () => {
  const source = readFileSync(new URL('../sessions/01-mcp-fondamentaux/parking-lot.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.css', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /createElement\('select'\)|createElement\('option'\)/);
  assert.match(source, /createElement\('details'\)/);
  assert.match(source, /createElement\('summary'\)/);
  assert.match(source, /swatch\.setAttribute\('aria-pressed'/);
  assert.match(source, /event\.key === 'Escape' && picker/);
  assert.match(css, /\.parking-toolbar>label \{[^}]*display:inline-flex; align-items:center/);
  assert.match(css, /\.parking-toolbar input\[type="checkbox"\] \{[^}]*min-height:0; margin:0; padding:0/);
});
