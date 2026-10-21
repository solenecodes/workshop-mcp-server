import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const script = read('sessions/slides-link.js');
const routes = Object.fromEntries([...script.matchAll(/'?([\w-]+)'?: \['(session-\d)', '([\w-]*)'\]/g)].map(([, chapter, deck, slide]) => [chapter, { deck, slide }]));
const decks = Object.fromEntries(['session-1', 'session-2', 'session-3'].map((d) => [d, read(`decks/${d}.html`)]));
const slideIds = (deck) => [...decks[deck].matchAll(/<section id="([\w-]+)"/g)].map((m) => m[1]);
const pages = {
  'sessions/01-mcp-fondamentaux/presentation.html': read('sessions/01-mcp-fondamentaux/presentation.html'),
  'sessions/02-architecture/presentation.html': read('sessions/02-architecture/presentation.html'),
};
const chapters = (html) => [...html.matchAll(/<section id="([\w-]+)" class="chapter(?! agenda-panel)/g)].map((m) => m[1]);

test('each session page has a Slides button that opens its deck in a new tab', () => {
  for (const [path, html] of Object.entries(pages)) {
    const button = html.match(/<a class="button slides-open" id="slides-open"[^>]*>/)?.[0] ?? '';
    assert.match(button, /data-deck="session-[12]"/, `${path}: default deck`);
    assert.match(button, /data-base="\.\.\/\.\.\/decks\/"/);
    assert.match(button, /target="_blank" rel="noopener"/);
    assert.match(html, /<script src="\.\.\/slides-link\.js" defer><\/script>/);
    assert.match(html, /<link rel="stylesheet" href="\.\.\/slides-link\.css">/);
  }
});

test('every lesson chapter opens an existing slide of the right deck', () => {
  for (const html of Object.values(pages)) {
    for (const chapter of chapters(html)) {
      const route = routes[chapter];
      assert.ok(route, `${chapter} has a route`);
      if (route.slide) assert.ok(slideIds(route.deck).includes(route.slide), `${chapter} → ${route.deck}#/${route.slide} exists`);
    }
  }
  assert.equal(routes.rights.deck, 'session-3', 'Session 3 chapters on the Session 1 page open the Session 3 deck');
  assert.deepEqual(routes.decisions, { deck: 'session-2', slide: 'decisions' });
  assert.deepEqual(routes.hosting, { deck: 'session-2', slide: 'hosting' });
});

test('the script resolves the relative deck folder against the page URL', async () => {
  const { runInNewContext } = await import('node:vm');
  const link = { dataset: { deck: 'session-2', base: '../../decks/' }, href: '', addEventListener() {} };
  const location = { hash: '#front-door' };
  const page = 'http://127.0.0.1:8080/sessions/02-architecture/presentation.html';
  runInNewContext(script, { URL, location, addEventListener() {}, document: { baseURI: page, getElementById: () => link } });
  assert.equal(link.href, 'http://127.0.0.1:8080/decks/session-2.html#/front-door');
});

test('every slide has a unique id and links back to an existing chapter of its page', () => {
  for (const [deck, html] of Object.entries(decks)) {
    const ids = slideIds(deck);
    assert.equal(new Set(ids).size, ids.length, `${deck}: unique slide ids`);
    assert.equal([...html.matchAll(/<section\b/g)].length, ids.length, `${deck}: every slide has an id`);
    const page = html.match(/<body data-page="\.\.\/([^"]+)">/)?.[1];
    assert.ok(page && pages[page], `${deck}: data-page points to a session page`);
    for (const [, chapter] of html.matchAll(/<section id="[\w-]+" data-chapter="([\w-]+)"/g)) {
      assert.ok(chapters(pages[page]).includes(chapter), `${deck}: ${chapter} is a chapter of ${page}`);
    }
  }
  assert.match(read('decks/assets/deck.js'), /className = 'back-to-page'/);
});
