import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const deckDir = new URL('../decks/', import.meta.url);
const read = (name) => readFileSync(new URL(name, deckDir), 'utf8');
const decks = ['session-1.html', 'session-2.html', 'session-3.html'];

test('the three decks load only local files, so they work offline and from file://', () => {
  for (const deck of ['index.html', ...decks]) {
    const html = read(deck);
    const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]);
    for (const ref of refs.filter((r) => !/^(https?:|mailto:)/.test(r))) {
      assert.ok(existsSync(new URL(ref, new URL(deck, deckDir))), `${deck}: ${ref} exists`);
    }
    assert.doesNotMatch(html, /<(script|link|img)[^>]+(src|href)="https?:/, `${deck}: no remote script, stylesheet or image`);
  }
  assert.doesNotMatch(read('assets/deck.css'), /url\(\s*['"]?https?:|@import/);
  assert.ok(existsSync(new URL('vendor/reveal/LICENSE', deckDir)));
});

test('every slide has speaker notes and session 3 keeps its French notes with accents', () => {
  for (const deck of decks) {
    const sections = read(deck).split('<section').slice(1);
    assert.ok(sections.length >= 6, `${deck} has slides`);
    sections.forEach((s, i) => assert.match(s, /<aside class="notes">/, `${deck} slide ${i + 1} has notes`));
  }
  const notes = [...read('session-3.html').matchAll(/<aside class="notes">([\s\S]*?)<\/aside>/g)].map((m) => m[1]).join(' ');
  assert.match(notes, /accès|déléguée|à l'échelle/);
  assert.doesNotMatch(notes, /\bacces\b|\bdelegue\b/);
});

test('the decks hold no tenant, subscription or deployment identifier', () => {
  for (const deck of decks) {
    assert.doesNotMatch(read(deck), /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, `${deck}: no GUID`);
    assert.doesNotMatch(read(deck), /apim-mcp-[a-z0-9]{8,}|ca-mcp-\w+-[a-z0-9]{8,}/, `${deck}: placeholders, not deployed names`);
  }
});

test('the session 2 deck explains the virtual MCP server with the Microsoft Learn limits', () => {
  const html = read('session-2.html');
  assert.match(html, /A <span>virtual MCP server<\/span> from an API you already have/);
  assert.match(html, /Tools only, no resources or prompts/);
  assert.match(html, /Not in workspaces/);
  assert.match(html, /learn|Learn/);
});
