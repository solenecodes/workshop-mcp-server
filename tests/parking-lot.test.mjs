import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeParkingLot, parkingLotEndpoint, parkingLotTime } from '../sessions/01-mcp-fondamentaux/parking-lot.mjs';

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

test('posting times use the original timestamp in Paris, including daylight saving and date rollover', () => {
  assert.equal(parkingLotTime('2026-01-15T08:05:00.000Z'), '09:05');
  assert.equal(parkingLotTime('2026-07-15T08:05:00.000Z'), '10:05');
  assert.equal(parkingLotTime('2026-10-20T23:10:00.000Z'), '01:10');
  assert.throws(() => parkingLotTime('not a timestamp'), RangeError);
});

function boardFixture(t) {
  class Element extends EventTarget {
    children = [];
    dataset = {};
    className = '';
    textContent = '';
    disabled = false;
    checked = false;
    open = false;
    value = '';
    attributes = new Map();
    constructor(tagName) { super(); this.tagName = tagName; }
    get childNodes() { return this.children; }
    get firstElementChild() { return this.children[0]; }
    get classList() { return { add: (name) => { this.className += ` ${name}`; } }; }
    append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
    insertBefore(node, before) {
      node.remove();
      this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, node);
      node.parentElement = this;
    }
    remove() {
      if (this.parentElement) {
        const siblings = this.parentElement.children;
        siblings.splice(siblings.indexOf(this), 1);
        this.parentElement = undefined;
      }
    }
    replaceChildren(...nodes) { [...this.children].forEach((node) => node.remove()); this.append(...nodes); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    querySelectorAll(selector) {
      const descendants = this.children.flatMap((node) => [node, ...node.querySelectorAll('*')]);
      return descendants.filter((node) => selector === '*' ||
        (selector.startsWith('.') ? node.className.split(' ').includes(selector.slice(1).replace('[open]', '')) &&
          (!selector.endsWith('[open]') || node.open) : node.tagName === selector));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
  }
  const ids = ['parking-lot', 'parking-open', 'parking-form', 'parking-question', 'parking-notes',
    'parking-status', 'parking-archived', 'parking-refresh', 'parking-close', 'parking-count'];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element('div')]));
  const submit = new Element('button');
  elements['parking-form'].append(submit);
  const root = new EventTarget();
  root.querySelector = (selector) => elements[selector.slice(1)];
  root.createElement = (tagName) => new Element(tagName);
  root.hidden = false;
  const previousDocument = globalThis.document;
  const previousLocation = globalThis.location;
  globalThis.document = root;
  globalThis.location = { href: 'https://example.com/presentation.html' };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  });
  const requests = [];
  t.mock.method(globalThis, 'fetch', (url, options) => new Promise((resolve) => {
    requests.push({ method: options.method, reply: (notes, status = 200) => resolve({
      ok: status === 200, status, json: async () => status === 200 ? { notes } : { message: 'Write failed.' },
    }) });
  }));
  let poll;
  t.mock.method(globalThis, 'setInterval', (callback) => { poll = callback; return 1; });
  initializeParkingLot();
  return { elements, submit, requests, root, poll: () => poll(), flush: () => new Promise(setImmediate) };
}

const firstNote = { id: 'first', question: 'A shared question', color: 'yellow',
  archived: false, createdAt: '2026-10-20T23:10:00.000Z' };

test('background sync preserves controls, card identity, focus and open palettes when other notes change', async (t) => {
  const { elements, submit, requests, root, poll, flush } = boardFixture(t);
  elements['parking-open'].dispatchEvent(new Event('click'));
  assert.equal(submit.disabled, false);
  requests[0].reply([firstNote]);
  await flush();
  const list = elements['parking-notes'];
  const card = list.children[0];
  const toggle = card.querySelector('summary');
  const picker = card.querySelector('.parking-color-picker');
  picker.open = true;
  toggle.focus();
  assert.equal(card.querySelector('time').dateTime, firstNote.createdAt);
  assert.equal(card.querySelector('time').textContent, '01:10');
  assert.match(card.querySelector('time').title, /21 Oct 2026.*Paris time/);
  poll();
  assert.equal(submit.disabled, false);
  assert.ok(list.querySelectorAll('button').every((button) => !button.disabled));
  requests[1].reply([{ ...firstNote }]);
  await flush();
  assert.equal(list.children[0], card);
  poll();
  requests[2].reply([firstNote, { ...firstNote, id: 'second', question: 'Another question' }]);
  await flush();
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0], card);
  assert.equal(root.activeElement, toggle);
  assert.equal(picker.open, true);
  poll();
  requests[3].reply([{ ...firstNote, color: 'blue' }]);
  await flush();
  assert.equal(list.children[0], card);
  assert.equal(card.dataset.color, 'blue');
  assert.equal(root.activeElement, toggle);
  assert.equal(picker.open, true);
});

test('posting during a background read succeeds and a stale read cannot undo the write', async (t) => {
  const { elements, submit, requests, poll, flush } = boardFixture(t);
  elements['parking-open'].dispatchEvent(new Event('click'));
  requests[0].reply([firstNote]);
  await flush();
  poll();
  elements['parking-question'].value = 'A new question';
  elements['parking-form'].dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(requests[2].method, 'POST');
  assert.equal(submit.disabled, true);
  const second = { ...firstNote, id: 'second', question: 'A new question' };
  requests[2].reply([firstNote, second]);
  await flush();
  assert.equal(elements['parking-question'].value, '');
  assert.equal(submit.disabled, false);
  requests[1].reply([firstNote]);
  await flush();
  assert.equal(elements['parking-notes'].children.length, 2);
  assert.equal(elements['parking-count'].textContent, '2');
  elements['parking-question'].value = 'Keep this draft';
  elements['parking-form'].dispatchEvent(new Event('submit', { cancelable: true }));
  requests[3].reply([], 500);
  await flush();
  assert.equal(elements['parking-question'].value, 'Keep this draft');
  assert.match(elements['parking-status'].textContent, /Write failed/);
  assert.equal(elements['parking-notes'].children.length, 2);
  assert.equal(submit.disabled, false);
});

test('obsolete read failures do not replace a successful write and invalid timestamps are reported', async (t) => {
  const { elements, requests, poll, flush } = boardFixture(t);
  elements['parking-open'].dispatchEvent(new Event('click'));
  elements['parking-question'].value = 'A shared question';
  elements['parking-form'].dispatchEvent(new Event('submit', { cancelable: true }));
  requests[1].reply([firstNote]);
  await flush();
  requests[0].reply([], 500);
  await flush();
  assert.equal(elements['parking-status'].dataset.error, 'false');
  const card = elements['parking-notes'].children[0];
  poll();
  requests[2].reply([{ ...firstNote, createdAt: 'invalid' }]);
  await flush();
  assert.match(elements['parking-status'].textContent, /invalid board/);
  assert.equal(elements['parking-notes'].children[0], card);
});
