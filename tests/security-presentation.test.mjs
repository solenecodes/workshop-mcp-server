import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { securityAliases, securityChapters } from '../sessions/01-mcp-fondamentaux/presentation-security.mjs';

const html = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.js', import.meta.url), 'utf8');
const notes = readFileSync(new URL('../sessions/03-security/README.md', import.meta.url), 'utf8');
const chapter = (id) => {
  const start = html.indexOf(`<section id="${id}"`);
  assert.ok(start >= 0, `Missing slide ${id}`);
  return html.slice(start, html.indexOf('</section>', start));
};
const text = (value) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

test('session 3 is exactly four concise slides, timed 3/4/4/4, with the old content removed', () => {
  assert.deepEqual(securityChapters, [
    { id: 'rights', minutes: 3 }, { id: 'token-hops', minutes: 4 },
    { id: 'mcp-threats', minutes: 4 }, { id: 'agent-identities', minutes: 4 },
  ]);
  assert.equal(securityChapters.reduce((sum, slide) => sum + slide.minutes, 0), 15);
  assert.deepEqual([...html.matchAll(/<section id="([^"]+)" class="chapter security-slide" data-session="session-3"/g)].map(([, id]) => id), securityChapters.map(({ id }) => id));
  let totalWords = 0;
  for (const [index, { id, minutes }] of securityChapters.entries()) {
    const slide = chapter(id);
    assert.match(slide, new RegExp(`Slide ${index + 1} of 4 · ${minutes} minutes`));
    const words = text(slide).split(/\s+/).length;
    assert.ok(words <= 115, `${id}: ${words} words exceeds the 115-word slide budget`);
    totalWords += words;
    assert.doesNotMatch(slide, /<details\b|<form\b|<select\b|<input\b|<pre\b|contenteditable|data-flow=/);
  }
  assert.ok(totalWords <= 400, `${totalWords} words exceeds the 400-word course budget`);
  assert.doesNotMatch(html + script, /identity-case|identity-feedback|policy-output|security-tabs|security-observation|teachingToken|decodeTeachingToken/);
  assert.doesNotMatch(script, /identityFeedback|securityPractice|renderPolicyInspection|authSteps|createFlow/);
});

test('each slide answers the assigned questions and labels implemented versus illustrative behavior', () => {
  const rights = chapter('rights');
  assert.equal((rights.match(/<article>/g) ?? []).length, 3);
  for (const phrase of ['Delegated access', 'Dedicated application identity', 'Agent user account', 'Optional · prerequisites apply', 'LLM does not grant permissions']) {
    assert.ok(rights.includes(phrase), phrase);
  }
  const hops = chapter('token-hops');
  assert.equal((hops.match(/class="security-route"/g) ?? []).length, 2);
  for (const phrase of ['Design option', "enforce Alice's rights", 'Managed identity', 'Mcp.Backend.Read', 'A token for MCP is not a token for a separate API', 'No OBO or per-ticket ACLs']) {
    assert.ok(hops.includes(phrase), phrase);
  }
  const threats = chapter('mcp-threats');
  assert.equal((threats.match(/<dt>/g) ?? []).length, 4);
  for (const phrase of ['Data, not an instruction', 'Least privilege + record checks', 'human approval + audit', 'Approved servers + dependency review', 'get_ticket', 'Read · implemented', 'close_ticket', 'Write · not implemented']) {
    assert.ok(threats.includes(phrase), phrase);
  }
  const agents = chapter('agent-identities');
  assert.equal((agents.match(/<article>/g) ?? []).length, 4);
  for (const phrase of ['Blueprint', 'Agent identity', 'Sponsor', 'Lifecycle', 'shared credentials', 'An identity is not a data-access policy', 'no Agent ID deployment', '#day-session-4']) {
    assert.ok(agents.includes(phrase), phrase);
  }
  for (const phrase of ['Frontier', 'consent', 'approval', 'issued tokens', 'blueprint']) assert.ok(notes.includes(phrase), `Presenter notes retain ${phrase}`);
});

test('old links resolve to the four slides without retaining old lessons in navigation', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `Unresolved #${id}`);
  assert.deepEqual(securityAliases, {
    auth: 'rights', 'security-lab': 'rights', tokens: 'token-hops', 'tool-policy': 'mcp-threats',
  });
  for (const [oldId, target] of Object.entries(securityAliases)) {
    assert.ok(ids.includes(oldId));
    assert.ok(securityChapters.some(({ id }) => id === target));
    assert.ok(!html.includes(`href="#${oldId}"`), `Removed lesson ${oldId} is not advertised`);
  }
  assert.match(script, /securityAliases\[requestedId\] \?\? requestedId/);
  assert.match(script, /history\.replaceState/);
  assert.match(script, /Session 3 · Slide/);
  assert.doesNotMatch(script, /Optional practice|Session 2 reference/);
});

test('the original timetable, session-one lab and browser-only-public boundary remain intact', () => {
  const agenda = [...html.matchAll(/data-key="([^"]+)"[^>]*data-start="([^"]+)" data-end="([^"]+)"/g)].map(([, key, start, end]) => [key, start, end]);
  assert.deepEqual(agenda, [
    ['welcome', '09:00', '09:30'], ['introductions', '09:30', '09:45'], ['session-1', '09:45', '10:15'],
    ['session-2', '10:15', '10:45'], ['break-morning', '10:45', '11:00'], ['session-3', '11:00', '11:15'],
    ['session-4', '11:15', '12:00'], ['engineering-rex', '12:00', '12:30'],
    ['lunch', '12:30', '14:00'], ['parking-review', '14:00', '14:30'],
    ['hands-on', '14:30', '16:00'], ['use-cases', '16:00', '16:30'],
  ]);
  for (const id of ['why', 'connector', 'anatomy', 'mcp', 'history', 'api', 'lab', 'lab-command', 'lab-output']) assert.ok(html.includes(`id="${id}"`));
  assert.match(script, /callMcp\(endpoint, parseCommandRequest/);
  assert.doesNotMatch(script, /callMcp\([^)]*protectedEndpoint|\.innerHTML|localStorage|sessionStorage/);
  assert.match(html, /id="day-engineering-rex"/);
  assert.match(html, /<strong>Fethi Dilmi<\/strong>/);
});
