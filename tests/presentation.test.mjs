import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultEndpoint, defaultProtectedEndpoint, labCommand, labSteps, parseCommandRequest, securityCode, setupCode, shareUrl, validateEndpoint } from '../sessions/01-mcp-fondamentaux/presentation-lab.mjs';
import { jsonTokens } from '../sessions/01-mcp-fondamentaux/mcp-console.mjs';

const html = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.html', import.meta.url), 'utf8');

test('six foundations take 15 minutes and lead directly to the existing 15-minute live lab', () => {
  const chapters = [...html.matchAll(/<section id="([^"]+)" class="chapter" data-course="fundamentals" data-minutes="(\d+)"/g)]
    .map(([, id, minutes]) => ({ id, minutes: Number(minutes) }));
  assert.deepEqual(chapters, [
    { id: 'why', minutes: 2 }, { id: 'connector', minutes: 2 },
    { id: 'anatomy', minutes: 3 }, { id: 'mcp', minutes: 3 },
    { id: 'history', minutes: 2 }, { id: 'api', minutes: 3 },
  ]);
  assert.equal(chapters.reduce((sum, chapter) => sum + chapter.minutes, 0), 15);
  const intro = html.slice(html.indexOf('<main'), html.indexOf('<section id="lab"'));
  assert.deepEqual([...intro.matchAll(/<section id="([^"]+)"/g)].map(([, id]) => id), chapters.map(({ id }) => id));
  for (const [index, { id, minutes }] of chapters.entries()) {
    const section = intro.slice(intro.indexOf(`<section id="${id}"`), intro.indexOf('</section>', intro.indexOf(`<section id="${id}"`)));
    assert.ok(section.includes(`Lesson ${index + 1} of 6 · ${minutes} minutes`));
    assert.ok(html.includes(`<a href="#${id}">`));
    assert.match(section, new RegExp(`>${index + 1}\\. `), `${id} keeps the numbered source heading`);
    assert.doesNotMatch(section, /<br><span>/, 'headings wrap naturally instead of using forced line breaks');
  }
  assert.match(html, /Your turn · Live lab · 15 minutes/);
  assert.doesNotMatch(intro, /data-flow="call"|integration-play|Follow a tool call|How is MCP different from an API/);
});

test('the introductory visuals separate the model from MCP and do not invent extra demo capabilities', () => {
  const intro = html.slice(html.indexOf('<main'), html.indexOf('<section id="lab"'));
  for (const text of [
    'Model Context Protocol', 'USB-C', 'one per server connection',
    'model API, not MCP', 'JSON-RPC 2.0', 'Streamable HTTP', 'stdio',
    'tools/list → tools/call', 'resources/list → resources/read',
    'prompts/list → prompts/get', 'No LLM required to speak MCP',
    'implements tools only', 'A proposal is not execution',
    'no model or APIM is needed',
  ]) assert.ok(intro.includes(text), text);
  assert.doesNotMatch(intro, /<img\b|<iframe\b|https:\/\/cours-et-fiches\.com\//);
  assert.match(html, /English adaptation of the participant-provided excerpts/);
  assert.match(intro, /N × M/);
  assert.match(intro, /N \+ M/);
  const analogy = intro.slice(intro.indexOf('<section id="connector"'), intro.indexOf('<section id="anatomy"'));
  assert.equal([...analogy.matchAll(/<article(?: class="accent")?>/g)].length, 4);
  for (const title of ['Before USB-C', 'With USB-C', 'Before MCP', 'With MCP']) {
    assert.ok(analogy.includes(`<h3>${title}</h3>`));
  }
  assert.doesNotMatch(analogy, /class="accent"|class="tag"|class="comparison/);
  const overview = intro.slice(intro.indexOf('<section id="why"'), intro.indexOf('<section id="connector"'));
  assert.equal([...overview.matchAll(/<p(?: class="intro")?>/g)].length, 2);
  assert.doesNotMatch(overview, /foundation-formula|class="notice"|class="one-liner"/);
});

test('architecture, primitives and function calling use accessible tables, not replacement cards', () => {
  for (const [id, rows] of [['anatomy', 3], ['mcp', 3], ['api', 6]]) {
    const start = html.indexOf(`<section id="${id}"`);
    const section = html.slice(start, html.indexOf('</section>', start));
    assert.match(section, /<table class="foundation-table">/);
    assert.equal([...section.matchAll(/<tr>/g)].length, rows + 1);
    assert.equal([...section.matchAll(/<th scope="col">/g)].length, 3);
    assert.equal([...section.matchAll(/<th scope="row">/g)].length, rows);
    const caption = section.match(/class="foundation-table-scroll" role="region" aria-labelledby="([^"]+)" tabindex="0"/)?.[1];
    assert.ok(caption, `${id} table region is named and keyboard-focusable`);
    assert.ok(section.includes(`<caption id="${caption}">`));
    assert.doesNotMatch(section, /foundation-figure|foundation-primitives|foundation-sequence|class="comparison"/);
  }
  const script = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.css', import.meta.url), 'utf8');
  assert.match(script, /event\.target\.closest\('[^']*\.foundation-table-scroll'\)/, 'arrow keys scroll a focused table instead of changing lessons');
  assert.match(css, /\.foundation-table-scroll \{[^}]*max-width:100%; overflow-x:auto/);
  assert.match(css, /\.foundation-table \{[^}]*width:100%; min-width:0; table-layout:fixed/, 'tables fit the available window width');
  assert.match(css, /\.foundation-table caption \{[^}]*clip-path:inset\(50%\)/, 'captions stay accessible without an extra visible title row');
  assert.match(css, /\.foundation-analogy \{[^}]*grid-template-columns:minmax\(0,1fr\)/, 'all four panels stay stacked even on desktop');
  assert.match(css, /\.foundation-timeline li \{[^}]*border-left:2px/, 'history remains a vertical timeline');
  assert.match(css, /\.foundation-timeline time \{[^}]*display:block/, 'dates sit above descriptions');
  assert.doesNotMatch(css, /\.foundation-timeline li \{[^}]*grid-template-columns/);
});

test('the timeline uses the supplied February figures and sourced Microsoft milestones in chronological order', () => {
  const start = html.indexOf('<section id="history"');
  const history = html.slice(start, html.indexOf('</section>', start));
  const historyText = history.replace(/<\/?strong>/g, '');
  assert.deepEqual([...history.matchAll(/<time datetime="([^"]+)">/g)].map(([, date]) => date), [
    '2024-11', '2025-03-19', '2025-03-26', '2025-07-14', '2025-11-25', '2025-12-09', '2026-02', '2026-09',
  ]);
  const notes = readFileSync(new URL('../sessions/01-mcp-fondamentaux/README.md', import.meta.url), 'utf8');
  for (const url of [
    'https://www.anthropic.com/news/model-context-protocol',
    'https://modelcontextprotocol.io/specification/2025-03-26/changelog',
    'https://www.microsoft.com/en-us/copilot/blog/copilot-studio/introducing-model-context-protocol-mcp-in-copilot-studio-simplified-integration-with-ai-apps-and-agents/',
    'https://github.blog/changelog/2025-07-14-model-context-protocol-mcp-support-in-vs-code-is-generally-available/',
    'https://modelcontextprotocol.io/specification/2025-11-25/changelog',
    'https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation',
  ]) assert.ok(notes.includes(url), `${url} remains documented off-slide`);
  assert.equal([...history.matchAll(/<li>/g)].length, 8);
  assert.doesNotMatch(history, /<h3>|<a\b|<b\b|340%|specification v2|Workshop checkpoint|256\.8M|500M|2026-10/);
  assert.deepEqual([...history.matchAll(/<strong>([^<]+)<\/strong>/g)].map(([, text]) => text), [
    'open standard', 'Copilot Studio', 'Streamable HTTP', 'VS Code 1.102',
    'experimental tasks', 'Agentic AI Foundation (AAIF)',
    '97 million monthly SDK downloads', '1,200+ public MCP servers', '1,000+ connectors',
  ]);
  const december = history.slice(history.indexOf('<time datetime="2025-12-09">'), history.indexOf('<time datetime="2026-02">'));
  assert.match(december, /Agentic AI Foundation \(AAIF\)/);
  assert.doesNotMatch(december, /downloads|public MCP servers/);
  const februaryStart = history.indexOf('<time datetime="2026-02">');
  const septemberStart = history.indexOf('<time datetime="2026-09">');
  assert.ok(februaryStart < septemberStart);
  assert.match(historyText, /97 million monthly SDK downloads\. 1,200\+ public MCP servers\. MCP is the de facto standard for AI connectivity\./);
  const september = history.slice(septemberStart);
  assert.match(september, /Foundry catalog snapshot, checked October 20, 2026/);
  assert.doesNotMatch(september, /Microsoft Fabric Core MCP Server becomes generally available/);
  assert.match(historyText, /Microsoft introduces MCP support in Copilot Studio/);
  assert.doesNotMatch(html.slice(html.indexOf('<main'), html.indexOf('<section id="lab"')), /Google|Gemini|10,000\+/);
  assert.match(notes, /figures supplied by the presenter/);
});

test('the Foundry snapshot replaces September text without duplicate paragraphs or the removed caveat', () => {
  const start = html.indexOf('<section id="history"');
  const history = html.slice(start, html.indexOf('</section>', start));
  const snapshot = history.slice(history.indexOf('<time datetime="2026-09">'), history.indexOf('</ol>')).replace(/<\/?strong>/g, '');
  assert.match(history, /Timeline: from launch to October 2026/);
  assert.match(snapshot, /checked October 20, 2026: 1,000\+ connectors/);
  assert.match(snapshot, /Microsoft \(SharePoint, Teams, Dynamics 365\)/);
  assert.match(snapshot, /verified third-party publishers \(Docusign, Databricks, Box\), and independent publishers/);
  assert.equal([...history.matchAll(/Foundry catalog snapshot/g)].length, 1);
  assert.doesNotMatch(history.slice(history.indexOf('</ol>')), /<p>/);
  assert.doesNotMatch(history, /This is a connector count|Only validated connectors|does not publish a separate total/);
  assert.doesNotMatch(history, /1,000\+ (?:validated|verified|certified) MCP servers/);
  const notes = readFileSync(new URL('../sessions/01-mcp-fondamentaux/README.md', import.meta.url), 'utf8');
  assert.ok(notes.includes('https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/connectors'));
});

test('pagination derives the new course length and changed modules share one cache suffix', () => {
  const script = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation.js', import.meta.url), 'utf8');
  const security = readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation-security.mjs', import.meta.url), 'utf8');
  assert.match(script, /const courseChapters = chapters\.filter\(\(chapter\) => chapter\.dataset\.course === 'fundamentals'\)/);
  assert.match(script, /courseChapters\.length - 1 \? 'Start live examples/);
  assert.match(script, /const isLab = currentChapter\.id === 'lab'/);
  assert.doesNotMatch(script, /chapterIndex (?:===|<) [34]\b|function callSteps|createIntegrationAnimation/);
  const version = html.match(/presentation\.js\?v=([\w-]+)/)[1];
  assert.ok(html.includes(`presentation.css?v=${version}`));
  for (const module of ['presentation-lab', 'mcp-console', 'presentation-security']) {
    assert.ok(script.includes(`./${module}.mjs?v=${version}`));
  }
  assert.doesNotMatch(security, /presentation-lab\.mjs/, 'static session-three slides do not depend on a second lab');
});

test('JSON highlighting preserves actual formatted data and classifies JSON values without HTML', () => {
  const value = { 'escaped"key': '</span><script>alert("demo")</script>', count: -1.25e20, enabled: true, disabled: false, empty: null, nested: ['line\nbreak', {}] };
  const tokens = jsonTokens(value);
  assert.equal(tokens.map(({ text }) => text).join(''), JSON.stringify(value, null, 2));
  for (const kind of ['key', 'string', 'number', 'boolean', 'null', 'plain']) {
    assert.ok(tokens.some((token) => token.kind === kind));
  }
  assert.equal(tokens.find(({ text }) => text === '"enabled"').kind, 'key');
  assert.equal(tokens.find(({ text }) => text === 'null').kind, 'null');
  assert.equal(tokens.find(({ text }) => text.includes('<script>')).kind, 'string');
  assert.ok(tokens.every(({ focus }) => focus === false));
});

test('focused keys highlight only their own line, values included', () => {
  const tokens = jsonTokens({ customer: { customerName: 'Alex', customerId: 'ID' }, rate: 1.1 }, ['customerName', 'rate']);
  const focused = tokens.filter(({ focus }) => focus).map(({ text }) => text).join('');
  assert.match(focused, /"customerName": "Alex",?/);
  assert.match(focused, /"rate": 1\.1/);
  assert.doesNotMatch(focused, /customerId/);
});

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

test('three guided steps build one copyable curl request each and mark only what changed', () => {
  const settings = { endpoint: 'https://sandbox.example.org/mcp' };
  const commands = labSteps.map((_, index) => labCommand(index, settings));
  assert.equal(commands.length, 3);
  assert.deepEqual(commands.map((step) => step.request.params?.name ?? step.request.method), [
    'tools/list', 'list_tickets', 'get_ticket']);
  for (const step of commands) {
    assert.ok(step.title && step.why && step.notice && step.focus.length);
    assert.match(step.code, /^curl -s 'https:\/\/sandbox.example.org\/mcp' \\\n/);
    assert.ok(step.code.includes(`-d '${JSON.stringify(step.request)}'`));
    assert.equal(step.segments.map(({ text }) => text).join(''), step.code);
    assert.ok(step.segments.some(({ changed }) => changed), 'each step highlights something');
    assert.doesNotMatch(step.code, /MCP_TOKEN|Authorization|demo-.*-token/i);
  }
  assert.deepEqual(commands[2].segments.filter(({ changed }) => changed).map(({ text }) => text), ['get_ticket', '{"ticketId":"CT-1001"}']);
  assert.deepEqual(commands[1].request.params, { name: 'list_tickets', arguments: {} });
  for (const index of [-1, 3, 8]) assert.throws(() => labCommand(index, settings));
  assert.match(setupCode, /npm ci/);
});

test('protected commands contrast no identity and prompted identity without putting tokens in a URL', () => {
  const commands = securityCode('https://protected.example.org/mcp');
  assert.match(commands.anonymous, /--anonymous get_ticket/);
  assert.match(commands.authenticated, /read -r -s/);
  assert.match(commands.authenticated, /unset MCP_TOKEN$/);
  assert.doesNotMatch(commands.authenticated, /--anonymous|demo-.*-token/);
  assert.throws(() => securityCode('http://protected.example.org/mcp'));
});

test('shell-quoted endpoints cannot become shell expansion and the page contains the guided lab and no French', () => {
  const step = labCommand(0, { endpoint: "https://sandbox.example.org/a'b" });
  assert.match(step.code, /a'\\''b/);
  for (const id of ['lab-tabs', 'lab-command', 'lab-output', 'lab-run', 'lab-copy', 'scenario-title']) assert.ok(html.includes(`id="${id}"`));
  assert.doesNotMatch(html, /id="console-(form|operation)"|class="terminal-exercise"/);
  const visible = [html, readFileSync(new URL('../sessions/01-mcp-fondamentaux/presentation-lab.mjs', import.meta.url), 'utf8')].join('\n');
  assert.doesNotMatch(visible, /[àâçéèêëîïôûùüœ]|\b(?:le|la|les|des|pour|avec|votre|vous|une?)\b(?=\s+[a-z])/i);
  for (const word of ['list_tickets', 'get_ticket', 'Contoso Tickets API']) assert.ok(html.includes(word));
  assert.doesNotMatch(html.slice(0, html.indexOf('<section id="rights"')), /claim|customer|weather|DEMO-PERSON/i);
});

test('an edited command is parsed back into a JSON-RPC request, never into a new endpoint', () => {
  const generated = labCommand(2, { endpoint: 'https://sandbox.example.org/mcp' });
  assert.deepEqual(parseCommandRequest(generated.code), generated.request);
  const edited = generated.code.replace('CT-1001', 'CT-1002').replace('sandbox.example.org', 'attacker.example');
  assert.equal(parseCommandRequest(edited).params.arguments.ticketId, 'CT-1002');
  assert.deepEqual(parseCommandRequest(`curl -s x -d "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"tools/list\\"}"`), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.throws(() => parseCommandRequest('curl -s x'), /after -d/);
  assert.throws(() => parseCommandRequest("curl -s x -d '{not json}'"), /not valid/);
  assert.throws(() => parseCommandRequest("curl -s x -d '[1]'"), /not valid/);
});
