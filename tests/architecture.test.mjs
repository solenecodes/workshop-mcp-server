import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demoCommands, doorEdges, doorNodes, doorSteps, gatewayPath } from '../sessions/02-architecture/architecture-steps.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const html = read('sessions/02-architecture/presentation.html');
const script = read('sessions/02-architecture/architecture.js');
const sessionOne = read('sessions/01-mcp-fondamentaux/presentation.html');
const agenda = (page) => [...page.matchAll(/<li[^>]*data-key="([^"]+)" data-short="([^"]+)" data-start="([^"]+)" data-end="([^"]+)"[^>]*>\s*<a class="agenda-row" href="([^"]+)"/g)]
  .map(([, key, short, start, end, href]) => ({ key, short, start, end, href }));

test('the Session 2 page keeps the day agenda of Session 1 and links back to its real chapters', () => {
  const mine = agenda(html);
  const theirs = agenda(sessionOne);
  assert.deepEqual(mine.map(({ href, ...item }) => item), theirs.map(({ href, ...item }) => item));
  for (const { key, href } of mine) {
    if (key === 'session-2') { assert.equal(href, '#decisions'); continue; }
    const [page, id] = href.split('#');
    assert.equal(page, '../01-mcp-fondamentaux/presentation.html', `${key} opens the Session 1 page`);
    assert.match(sessionOne, new RegExp(`id="${id}"`), `${key} links to an existing chapter or agenda panel`);
  }
  const sessionTwo = theirs.find(({ key }) => key === 'session-2');
  assert.equal(sessionTwo.href, '../02-architecture/presentation.html#decisions', 'the Session 1 agenda opens this page');
});

test('the page is in English, on the workshop tickets only, and never handles a token', () => {
  const visible = [html, read('sessions/02-architecture/architecture-steps.mjs')].join('\n');
  assert.doesNotMatch(visible, /[àâçéèêëîïôûùüœ]|\b(?:le|la|les|des|pour|avec|votre|vous|une?)\b(?=\s+[a-z])/i);
  assert.doesNotMatch(html, /claim|customer|weather|DEMO-PERSON/i);
  assert.doesNotMatch(visible, /Bearer ey|Authorization:|access_token=|-H 'Authorization/);
  assert.match(html, /This page never runs these commands and never asks for a token/);
  for (const chapter of ['decisions', 'hosting', 'front-door', 'patterns', 'discover', 'demo']) {
    assert.match(html, new RegExp(`<section id="${chapter}" class="chapter"`), `${chapter} chapter`);
    assert.match(html, new RegExp(`<a href="#${chapter}">`), `${chapter} in the menu`);
  }
});

test('every walk-through step says one plain sentence, then the detail, on nodes and links that exist', () => {
  assert.equal(doorSteps.length, 8);
  for (const step of doorSteps) {
    assert.ok(step.plain.length <= 120 && !/`|\{/.test(step.plain), `"${step.title}" opens with one short plain sentence`);
    assert.ok(step.detail.length > step.plain.length / 2, `"${step.title}" has presenter detail`);
    for (const node of step.nodes) assert.ok(doorNodes[node], `${node} exists`);
    step.path.slice(1).forEach((to, index) => {
      const from = step.path[index];
      assert.ok(doorEdges.some(([a, b]) => a === from && b === to), `${from} → ${to} is a drawn link`);
    });
  }
  for (const [name, node] of Object.entries(doorNodes)) {
    assert.match(html, new RegExp(`<article data-node="${name}">.*<h3>${node.title}</h3><span>${node.detail}</span></article>`));
  }
  const fallback = html.match(/<details class="flow-fallback" open><summary>Read the sequence<\/summary><ol>([\s\S]*?)<\/ol>/)[1];
  assert.equal([...fallback.matchAll(/<li>/g)].length, doorSteps.length, 'the no-JavaScript sequence has every step');
  for (const [term, label] of [['REST API as MCP', 'Preview'], ['Azure API Center', 'Preview'], ['Built-in MCP', 'Preview']]) {
    assert.match(html, new RegExp(`${term}[\\s\\S]{0,120}${label}`), `${term} is labeled ${label}`);
  }
});

test('the demo reuses the Session 1 client against the deployed gateway path, with the token kept off screen', () => {
  const bicep = read('infra/gateway/main.bicep');
  assert.match(bicep, new RegExp(`rest: \\{ path: '${gatewayPath}' \\}`));
  const commands = demoCommands('gw.example.org', '11111111-1111-4111-8111-111111111111');
  assert.equal(commands.anonymous, `npm run workshop -- --url 'https://gw.example.org/${gatewayPath}/mcp' --anonymous tools`);
  assert.equal(commands.metadata, `curl -s 'https://gw.example.org/.well-known/oauth-protected-resource/${gatewayPath}/mcp'`);
  const lines = commands.signedIn.split('\n');
  assert.equal(lines[1], `export MCP_TOKEN="$(az account get-access-token --scope 'api://11111111-1111-4111-8111-111111111111/Mcp.Read' --query accessToken -o tsv)"`);
  assert.match(lines.at(-2), /get_ticket '\{"ticketId":"CT-1002"\}'$/);
  assert.equal(lines.at(-1), 'unset MCP_TOKEN');
  assert.doesNotMatch(commands.signedIn, /--anonymous|echo|printf/);
});

test('cache suffixes match between the page and its module import', () => {
  const version = html.match(/architecture\.js\?v=([\w-]+)/)[1];
  assert.match(html, new RegExp(`architecture\\.css\\?v=${version}`));
  assert.match(script, new RegExp(`architecture-steps\\.mjs\\?v=${version}`));
  assert.match(html, /\.\.\/01-mcp-fondamentaux\/presentation\.css\?v=day-strip-2/);
  assert.match(sessionOne, /presentation\.css\?v=day-strip-2/, 'the shared stylesheet version exists on Session 1');
});
