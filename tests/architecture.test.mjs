import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultClientId, defaultGateway, demoCommands, demoSettings, doorEdges, doorNodes, doorSteps, gatewayPath, tokenEdges, tokenNodes, tokenSteps } from '../sessions/02-architecture/architecture-steps.mjs';
const handsOn = 'https://web-mcp-host01-f80ce789cb05568a-portal.azurewebsites.net/?lang=en#/tracks';

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
    if (key === 'hands-on') { assert.equal(href, handsOn, 'the 14:30 hands-on opens the self-paced guide'); continue; }
    const [page, id] = href.split('#');
    assert.equal(page, '../01-mcp-fondamentaux/presentation.html', `${key} opens the Session 1 page`);
    assert.match(sessionOne, new RegExp(`id="${id}"`), `${key} links to an existing chapter or agenda panel`);
  }
  const sessionTwo = theirs.find(({ key }) => key === 'session-2');
  assert.equal(sessionTwo.href, '../02-architecture/presentation.html#decisions', 'the Session 1 agenda opens this page');
  assert.equal(mine.find(({ key }) => key === 'session-3').href, '../01-mcp-fondamentaux/presentation.html#rights', 'the next session starts with identity choices, not the optional authentication reminder');
  assert.equal(theirs.find(({ key }) => key === 'hands-on').href, handsOn, 'the Session 1 agenda opens the hands-on guide');
  assert.match(sessionOne, new RegExp(`id="day-hands-on"[\\s\\S]*?href="${handsOn.replace(/[?.]/g, '\\$&')}">Open the hands-on guide`));
});

test('the page is in English, on the workshop tickets only, and never handles a token', () => {
  const visible = [html, read('sessions/02-architecture/architecture-steps.mjs')].join('\n');
  assert.doesNotMatch(visible, /[àâçéèêëîïôûùüœ]|\b(?:le|la|les|des|pour|avec|votre|vous|une?)\b(?=\s+[a-z])/i);
  assert.doesNotMatch(html.replace(/href="[^"]*"/g, ''), /claim|customer|weather|DEMO-PERSON/i, 'no words from the older Claims demo in the visible text');
  assert.doesNotMatch(visible, /Bearer (?!<)|access_token=|-H 'Authorization/, 'only placeholder tokens such as Bearer <token> appear');
  assert.match(html, /This page never runs these commands and never asks for a token/);
  for (const chapter of ['decisions', 'hosting', 'front-door', 'token', 'patterns', 'discover', 'demo']) {
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

test('the presenter link fills the demo with a real gateway and client ID, and rejects anything else', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(demoSettings(`?gateway=apim-mcp-abc.azure-api.net&clientId=${id}`), ['apim-mcp-abc.azure-api.net', id]);
  assert.deepEqual(demoSettings('?gateway=evil.example.org/x&clientId=nope'), [undefined, undefined]);
  assert.deepEqual(demoSettings(`?gateway=a'$(id).azure-api.net&clientId=${id}'`), [undefined, undefined]);
  assert.deepEqual(demoSettings(''), [undefined, undefined]);
  assert.match(demoCommands(...demoSettings('')).anonymous, new RegExp(`https://${defaultGateway.replace(/\./g, '\\.')}/`));
  assert.match(demoCommands(...demoSettings('')).signedIn, new RegExp(`api://${defaultClientId}/Mcp\\.Read`));
  assert.match(defaultGateway, /^[a-z0-9-]+\.azure-api\.net$/);
  assert.match(defaultClientId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('cache suffixes match between the page and its module import', () => {
  const version = html.match(/architecture\.js\?v=([\w-]+)/)[1];
  assert.match(html, new RegExp(`architecture\\.css\\?v=${version}`));
  assert.match(script, new RegExp(`architecture-steps\\.mjs\\?v=${version}`));
  const sharedVersion = sessionOne.match(/presentation\.css\?v=([\w-]+)/)[1];
  assert.match(html, new RegExp(`\\.\\./01-mcp-fondamentaux/presentation\\.css\\?v=${sharedVersion}`), 'both pages use the same shared stylesheet version');
});

test('the token walk-through shows one badge per hop with placeholder fields only', () => {
  assert.equal(tokenSteps.length, 8);
  for (const step of tokenSteps) {
    assert.ok(step.plain.length <= 120 && !/`|\{/.test(step.plain), `"${step.title}" opens with one short plain sentence`);
    assert.ok(step.fields && !/eyJ|[0-9a-f]{8}-[0-9a-f]{4}-/i.test(step.fields), `"${step.title}" shows placeholder fields, never a real token or ID`);
    for (const node of step.nodes) assert.ok(tokenNodes[node], `${node} exists`);
    step.path.slice(1).forEach((to, index) => {
      const from = step.path[index];
      assert.ok(tokenEdges.some(([a, b]) => (a === from && b === to) || (a === to && b === from)), `${from} → ${to} is a drawn link`);
    });
  }
  for (const [name, node] of Object.entries(tokenNodes)) {
    assert.match(html, new RegExp(`<article data-node="${name}">.*<h3>${node.title}</h3><span>${node.detail}</span></article>`));
  }
  assert.ok(tokenSteps.some((step) => /never forwarded/.test(step.detail)), 'the caller token is never forwarded to the API');
  assert.ok(tokenSteps.some((step) => /Mcp\.Backend\.Read/.test(step.fields)), 'the server uses its own role for the API');
  const fallback = html.match(/<section id="token"[\s\S]*?<details class="flow-fallback" open><summary>Read the sequence<\/summary><ol>([\s\S]*?)<\/ol>/)[1];
  assert.equal([...fallback.matchAll(/<li>/g)].length, tokenSteps.length);
});

test('every lesson ends with direct Microsoft Learn links, and the page states the Learn limits exactly', () => {
  for (const chapter of ['decisions', 'hosting', 'front-door', 'token', 'patterns', 'discover', 'demo']) {
    const section = html.match(new RegExp(`<section id="${chapter}"[\\s\\S]*?</section>`))[0];
    const links = [...(section.match(/<p class="learn-links">[\s\S]*?<\/p>/)?.[0] ?? '').matchAll(/<a href="([^"]+)"/g)].map(([, href]) => href);
    assert.ok(links.length >= 2, `${chapter} has Learn links`);
    for (const href of links) assert.match(href, /^https:\/\/learn\.microsoft\.com\/(azure|entra)\//);
  }
  assert.match(html, /API Management passes its tools and resources; MCP prompts are not supported yet\./);
  assert.match(html, /Tools only, one operation per tool\./);
  assert.match(html, /MCP version 2025-06-18 or later, over Streamable HTTP or SSE/);
  assert.match(html, /log 0 bytes of the front-end response body/);
});
test('the demo carries presenter notes and the deployed-architecture diagram generated from its drawio source', () => {
  for (const ext of ['drawio', 'svg', 'png']) assert.ok(readFileSync(new URL(`../sessions/02-architecture/diagrams/deployed-architecture.${ext}`, import.meta.url)).length > 1000, `${ext} exists`);
  const drawio = read('sessions/02-architecture/diagrams/deployed-architecture.drawio');
  for (const name of ['contoso-tickets-mcp', 'contoso-tickets-existing', 'ca-mcp-public-', 'ca-mcp-auth-', 'ca-mcp-apis-', 'apim-mcp-', 'Mcp.Backend.Read']) assert.ok(drawio.includes(name), `diagram names ${name}`);
  const svg = read('sessions/02-architecture/diagrams/deployed-architecture.svg');
  assert.doesNotMatch(svg, /<script|<image[^>]+href="https?:/);
  assert.match(html, /class="presenter-notes"[\s\S]*never reaches the Container Apps[\s\S]*isError: false/);
  assert.match(html, /src="diagrams\/deployed-architecture\.svg"/);
});
