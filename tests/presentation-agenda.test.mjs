import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeAgenda } from '../sessions/01-mcp-fondamentaux/presentation-agenda.mjs';

class Element extends EventTarget {
  attributes = new Map();
  children = [];
  hidden = false;
  id = '';
  append(child) { this.children.push(child); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  after(element) { this.nextElement = element; }
}

test('each session can be collapsed and reopened without navigating or hiding its lesson', () => {
  const items = [1, 2, 3].map((number) => {
    const row = new Element();
    const chapters = new Element();
    const dataset = { key: `session-${number}`, short: `Session ${number}` };
    return { dataset, row, chapters, querySelector: (selector) => selector === '.agenda-row' ? row : chapters };
  });
  items[1].chapters.id = 'existing-chapters';
  const root = {
    querySelectorAll: (selector) => {
      assert.equal(selector, '.agenda li[data-nested]');
      return items;
    },
    createElement: () => new Element(),
  };
  initializeAgenda(root);
  for (const { row, chapters, dataset } of items) {
    const button = row.nextElement;
    assert.equal(button.type, 'button');
    assert.equal(button.className, 'agenda-toggle');
    assert.equal(button.getAttribute('aria-controls'), chapters.id);
    assert.equal(button.children[0].textContent, dataset.short);
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    const click = new Event('click', { cancelable: true });
    button.dispatchEvent(click);
    assert.equal(click.defaultPrevented, false);
    assert.equal(chapters.hidden, true);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(button.getAttribute('aria-label'), `Expand chapters for ${dataset.short}`);
    assert.equal(items.filter(({ chapters }) => chapters.hidden).length, 1, 'other sessions stay open');
    button.dispatchEvent(new Event('click'));
    assert.equal(chapters.hidden, false);
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    button.dispatchEvent(new Event('click'));
    row.dispatchEvent(new Event('click'));
    assert.equal(chapters.hidden, false, 'selecting the session reopens its chapters');
    assert.equal(button.getAttribute('aria-label'), `Collapse chapters for ${dataset.short}`);
  }
  assert.equal(items[1].chapters.id, 'existing-chapters');
});

test('both presentations use the same accessible agenda controls and cache version', () => {
  const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const main = read('sessions/01-mcp-fondamentaux/presentation.js');
  const architecture = read('sessions/02-architecture/architecture.js');
  const version = main.match(/presentation-agenda\.mjs\?v=([\w-]+)/)[1];
  for (const script of [main, architecture]) {
    assert.match(script, new RegExp(`presentation-agenda\\.mjs\\?v=${version}`));
    assert.match(script, /initializeAgenda\(\)/);
    assert.match(script, /\.agenda-sub:not\(\[hidden\]\) a\[aria-current="step"\]/);
  }
});

test('both agendas place the morning break after Session 2 without shifting later sessions', () => {
  const pages = ['01-mcp-fondamentaux', '02-architecture'].map((session) =>
    readFileSync(new URL(`../sessions/${session}/presentation.html`, import.meta.url), 'utf8'));
  for (const html of pages) {
    const entries = [...html.matchAll(/data-key="([^"]+)"[^>]*data-start="([^"]+)" data-end="([^"]+)"[^>]*>\s*<a class="agenda-row"[^>]*><time>([^<]+)<\/time>/g)]
      .map(([, key, start, end, label]) => ({ key, start, end, label }));
    assert.equal(entries.length, 12);
    assert.deepEqual(entries.slice(2, 6), [
      { key: 'session-1', start: '09:45', end: '10:15', label: '09:45' },
      { key: 'session-2', start: '10:15', end: '10:45', label: '10:15' },
      { key: 'break-morning', start: '10:45', end: '11:00', label: '10:45' },
      { key: 'session-3', start: '11:00', end: '11:15', label: '11:00' },
    ]);
    for (let index = 1; index < entries.length; index++) {
      assert.equal(entries[index].start, entries[index - 1].end, 'the agenda stays contiguous');
    }
  }
  const panel = (id) => pages[0].match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`))[0];
  assert.match(panel('day-break-morning'), /10:45–11:00 · 15 min/);
  assert.match(panel('day-break-morning'), /Up next at 11:00:[^<]*Session 3/);
  assert.match(panel('day-session-2'), /10:15–10:45 · 30 min/);
  assert.match(panel('day-session-2'), /Up next at 10:45:[^<]*Break/);
});

test('both agendas show the abbreviated presenter names in their rows and Now labels', () => {
  for (const session of ['01-mcp-fondamentaux', '02-architecture']) {
    const html = readFileSync(new URL(`../sessions/${session}/presentation.html`, import.meta.url), 'utf8');
    for (const [key, name] of [['session-4', 'Younes K.'], ['engineering-rex', 'Fethi D.']]) {
      const entry = html.match(new RegExp(`<li data-key="${key}"[\\s\\S]*?</li>`))[0];
      assert.ok(entry.match(/data-short="([^"]+)"/)[1].includes(name));
      assert.ok(entry.match(/<small>([^<]+)<\/small>/)[1].includes(name));
    }
    assert.doesNotMatch(html, /Fethi Dilmi/);
  }
});
