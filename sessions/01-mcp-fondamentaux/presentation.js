import { defaultEndpoint, labStep, securityCode, setupCode, shareUrl, validateEndpoint } from './presentation-lab.mjs?v=console-sources-2';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const format = (value) => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';
$$('svg.icon').forEach((icon) => {
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
});
const controllers = [];
const request = (method, params = {}, id = 3) => ({ jsonrpc: '2.0', id, method, params });
const step = (title, text, from, to, wire, options = {}) => ({ title, text, from, to, wire, ...options });

function callSteps(mode) {
  const write = mode === 'write';
  const name = write ? 'propose_document_update' : 'search_documents';
  const args = write ? { path: 'deployment.md', text: 'Draft: add the rollback checklist.' } : { query: 'deployment guide' };
  return [
    step(write ? 'You ask for a change.' : 'You ask a question.', 'The application needs a capability outside the model. Assume you have already connected a trusted document server.', 'user', 'app',
      write ? 'Propose a rollback checklist for the deployment guide.' : 'Find the deployment guide.'),
    step('The app discovers what the server can do.', 'The server describes its available tools and the information each needs. Reading a tool description does not run it.', 'server', 'app',
      { request: request('tools/list', {}, 2), responseExcerpt: { tools: [
        { name, inputSchema: {
          type: 'object', properties: write ? { path: { type: 'string' }, text: { type: 'string' } } : { query: { type: 'string' } },
          required: Object.keys(args),
        } },
      ] } }),
    step('The app asks the LLM.', 'The agent sends the question and available tool descriptions to the model. This uses the model API, not an MCP connection.', 'app', 'model',
      { connection: 'Model API, not MCP', question: write ? 'Propose a rollback checklist.' : 'Find the deployment guide.', availableTools: [name] }),
    step('The LLM proposes a tool call.', 'The model suggests a tool name and arguments. This is a proposal, not an executed operation; the model does not call the MCP server directly.', 'model', 'app',
      { toolProposal: { name, arguments: args }, executed: false }),
    step('The agent checks, then calls.', 'The application validates the proposed call and applies its permissions and any required user confirmation. Its MCP client then sends the request.', 'app', 'server',
      request('tools/call', { name, arguments: args })),
    step(write ? 'The server prepares a proposal.' : 'The server searches the documents.', write
      ? 'In this example, the server checks access and saves a proposal for human review. Requiring review is an application policy, not automatic MCP behavior.'
      : 'The server checks access and runs its own search code. It can use files, an index or an existing API.', 'server', 'data',
      write ? { document: 'deployment.md', requiresApproval: true, published: false }
        : { results: [{ title: 'Deployment guide', path: 'deployment.md' }] }),
    step('The server returns what happened.', write
      ? 'The response says the proposal is awaiting review, not that the document was published.'
      : 'The client receives a matching document. The result comes from the external system, not model memory.', 'server', 'app',
      { jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: JSON.stringify(write
        ? { requiresApproval: true, document: 'deployment.md', published: false }
        : { title: 'Deployment guide', path: 'deployment.md' }) }] } }),
    step('The agent gives the result to the LLM.', 'The application sends the tool result back through the model API as external evidence, not as new instructions.', 'app', 'model',
      { connection: 'Model API, not MCP', toolResult: write ? { requiresApproval: true, published: false } : { title: 'Deployment guide', path: 'deployment.md' } }),
    step('The LLM drafts the answer.', 'The model uses the observed result to prepare a response. It must not invent a successful operation when the result only reports a proposal.', 'model', 'app',
      write ? 'Your proposal is ready for review. The document has not been published.' : 'Here is the deployment guide: deployment.md.'),
    step(write ? '“Your proposal is ready for review.”' : '“Here is the deployment guide.”', 'The application displays the answer. The LLM proposed and explained; the agent orchestrated; the MCP server ran the operation.', 'app', 'user',
      write ? 'The original document is unchanged until an authorized human approves.' : 'Found: deployment.md. Open and review the actual source.'),
  ];
}

function authSteps(mode) {
  const anonymous = mode === 'anonymous';
  const denied = mode === 'denied';
  const write = mode === 'write';
  const base = [
    step('Identify the caller.', anonymous ? 'No token was supplied. The protected endpoint must stop before running business logic.'
      : 'A credential maps to a server-trusted identity. The local demo uses a fixed token table, not Entra.', 'user', 'app',
    anonymous ? 'No Authorization header.' : { credential: '[not displayed]', userId: write ? 'adjuster-1' : 'reader-1' }),
  ];
  if (anonymous) return [...base,
    step('401. Nothing executes.', 'The client needs an appropriate credential. A successful network connection is not authentication.', 'app', 'user',
      { httpStatus: 401, error: 'UNAUTHENTICATED', claimWrites: 0 }, { blocked: true }),
  ];
  base.push(step('Check the tool allowlist.', 'Roles come from the server’s identity record, never from arguments such as role: admin.', 'app', 'server',
    { role: write ? 'claims_adjuster' : 'claims_reader', tool: write ? 'create_claim_note' : 'get_claim_summary', toolAllowed: true }));
  base.push(step('Check this specific claim.', denied ? 'The reader is assigned CLM-1001, not CLM-1002. Changing the ID does not change the caller’s rights.'
    : 'The caller is assigned CLM-1001. Tool permission alone is not enough; record access must also pass.', null, 'server',
    { assignedClaims: ['CLM-1001'], requestedClaim: denied ? 'CLM-1002' : 'CLM-1001', allowed: !denied }));
  if (denied) return [...base,
    step('Deny without reading the other record.', 'The server returns an MCP tool error. This application denial is not a claim that every MCP server returns HTTP 403.', 'server', 'user',
      { isError: true, error: 'CLAIM_ACCESS_DENIED', claimWrites: 0 }, { blocked: true }),
  ];
  return [...base,
    step(write ? 'Propose, do not execute.' : 'Minimize the returned data.', write
      ? 'The stored proposal expires in five minutes. Its payload cannot be replaced during confirmation.'
      : 'Mask personal and medical fields. Withhold arbitrary free text and report redactedFields.', 'server', 'data',
      write ? { requiresApproval: true, claimWrites: 0, expiresInMinutes: 5 }
        : { customerName: '[REDACTED]', dateOfBirth: '[REDACTED]', redactedFields: ['customerName', 'dateOfBirth', 'address', 'description', 'internalNotes', 'documents'] }),
    step(write ? 'A separate human reviews the action.' : 'Return only what this caller needs.', write
      ? 'Only a different supervisor/admin identity can call confirm_action. The initiating agent must not hold those credentials.'
      : 'Authentication, tool RBAC, claim assignment and redaction are distinct checks. Secure tool calls are also audited.', 'data', 'user',
      write ? 'Human reviews exact payload → confirm_action(actionId) → re-read → single-use action consumed.'
        : 'Reader gets an allowed, redacted result. No unrestricted PII access.'),
  ];
}

function createFlow(root) {
  const diagram = $('.flow-diagram', root);
  const nodes = new Map($$('[data-node]', root).map((element) => [element.dataset.node, element]));
  const pathGroup = $('[data-paths]', root);
  const activePath = $('[data-active-path]', root);
  const packet = $('[data-packet]', root);
  const play = $('[data-play]', root);
  const select = $('[data-scenario]', root);
  let steps = [];
  let index = 0;
  let playing = false;
  let timer;
  let frame;
  let picks = [];

  function route(from, to) {
    if (!from || !to) return '';
    const box = diagram.getBoundingClientRect();
    const a = nodes.get(from).getBoundingClientRect();
    const b = nodes.get(to).getBoundingClientRect();
    const x1 = a.left + a.width / 2 - box.left;
    const x2 = b.left + b.width / 2 - box.left;
    const y1 = a.top + a.height / 2 - box.top;
    const y2 = b.top + b.height / 2 - box.top;
    if (Math.abs(y1 - y2) < 16) {
      const direction = x2 > x1 ? 1 : -1;
      return `M ${x1 + direction * a.width / 2} ${y1} L ${x2 - direction * b.width / 2} ${y2}`;
    }
    if (Math.abs(x1 - x2) < 16) {
      const direction = y2 > y1 ? 1 : -1;
      return `M ${x1} ${y1 + direction * a.height / 2} L ${x2} ${y2 - direction * b.height / 2}`;
    }
    const start = (y2 > y1 ? a.bottom : a.top) - box.top;
    const end = (y2 > y1 ? b.top : b.bottom) - box.top;
    const middle = (start + end) / 2;
    return `M ${x1} ${start} L ${x1} ${middle} L ${x2} ${middle} L ${x2} ${end}`;
  }

  function stopPacket() {
    cancelAnimationFrame(frame);
    frame = undefined;
    packet.setAttribute('visibility', 'hidden');
  }

  function draw(animate = false) {
    stopPacket();
    if (!diagram.getBoundingClientRect().width) return;
    pathGroup.replaceChildren();
    const connections = [['user', 'app'], ['app', 'server'], ['server', 'data']];
    if (nodes.has('model')) connections.push(['app', 'model']);
    for (const [from, to] of connections) {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', route(from, to));
      if (from === 'model' || to === 'model') path.classList.add('model-connection');
      pathGroup.append(path);
    }
    const current = steps[index];
    const path = route(current.from, current.to);
    activePath.setAttribute('d', path);
    activePath.classList.toggle('blocked', Boolean(current.blocked));
    activePath.classList.toggle('model-connection', current.from === 'model' || current.to === 'model');
    if (!animate || motion.matches || !path) return;
    const length = activePath.getTotalLength();
    let started;
    function tick(time) {
      started ??= time;
      const progress = Math.min((time - started) / 1100, 1);
      const point = activePath.getPointAtLength(progress * length);
      packet.setAttribute('cx', point.x);
      packet.setAttribute('cy', point.y);
      packet.setAttribute('visibility', 'visible');
      if (progress < 1) frame = requestAnimationFrame(tick);
      else stopPacket();
    }
    frame = requestAnimationFrame(tick);
  }

  function updatePlay() {
    $('span', play).textContent = playing ? 'Pause' : index === steps.length - 1 ? 'Replay' : 'Play';
    $('use', play).setAttribute('href', playing ? '#i-pause' : '#i-play');
    play.setAttribute('aria-pressed', String(playing));
  }
  function pause() {
    clearTimeout(timer);
    playing = false;
    stopPacket();
    updatePlay();
  }
  function render(animate = false) {
    const current = steps[index];
    root.dataset.step = String(index + 1);
    $('[data-step-title]', root).textContent = `${index + 1}. ${current.title}`;
    $('[data-step-text]', root).textContent = current.text;
    $('[data-wire]', root).textContent = format(current.wire);
    $('.flow-count', root).textContent = `${index + 1} / ${steps.length}`;
    $('[data-prev]', root).disabled = index === 0;
    $('[data-next]', root).disabled = index === steps.length - 1;
    nodes.forEach((element, id) => {
      const active = id === current.from || id === current.to;
      element.classList.toggle('active', active);
      element.classList.toggle('blocked', active && Boolean(current.blocked));
    });
    picks.forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
    updatePlay();
    draw(animate);
  }
  function schedule() {
    timer = setTimeout(() => {
      if (!playing) return;
      index++;
      render(true);
      if (index === steps.length - 1) { playing = false; updatePlay(); }
      else schedule();
    }, 3200);
  }
  function rebuild() {
    pause();
    steps = root.dataset.flow === 'call' ? callSteps(select.value) : authSteps(select.value);
    index = 0;
    const dots = $('.flow-dots', root);
    dots.replaceChildren();
    picks = steps.map((item, position) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(position + 1);
      button.setAttribute('aria-label', `Step ${position + 1}: ${item.title}`);
      button.addEventListener('click', () => { pause(); index = position; render(true); });
      dots.append(button);
      return button;
    });
    if (root.dataset.flow === 'call') {
      const heading = $('#mcp-title');
      const accent = document.createElement('span');
      const write = select.value === 'write';
      accent.textContent = write ? 'to the deployment guide.”' : 'deployment guide.”';
      heading.replaceChildren(document.createTextNode(write ? '“Propose an update' : '“Find the'), document.createElement('br'), accent);
    }
    render();
  }
  play.addEventListener('click', () => {
    if (playing) { pause(); return; }
    controllers.forEach((controller) => controller.pause());
    if (index === steps.length - 1) index = 0;
    playing = true;
    render(true);
    schedule();
  });
  $('[data-next]', root).addEventListener('click', () => { pause(); index = Math.min(index + 1, steps.length - 1); render(true); });
  $('[data-prev]', root).addEventListener('click', () => { pause(); index = Math.max(0, index - 1); render(true); });
  $('[data-reset]', root).addEventListener('click', () => { pause(); index = 0; render(); });
  select.addEventListener('change', rebuild);
  function updateMotion() {
    pause();
    play.disabled = motion.matches;
    $('.motion-note', root).hidden = !motion.matches;
  }
  motion.addEventListener('change', updateMotion);
  rebuild();
  updateMotion();
  if ('ResizeObserver' in window) new ResizeObserver(() => draw(frame !== undefined)).observe(diagram);
  else window.addEventListener('resize', () => draw(frame !== undefined));
  if ('IntersectionObserver' in window) new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) pause();
  }).observe(root);
  return { pause, redraw: () => draw() };
}

$$('[data-flow]').forEach((root) => controllers.push(createFlow(root)));
$$('.flow-fallback,.lab-fallback').forEach((element) => { element.open = false; });

const chapters = $$('.chapter');
const navigation = $$('.chapters a');
let chapterIndex = 0;
function showChapter(focus = false) {
  const target = chapters.findIndex((chapter) => `#${chapter.id}` === location.hash);
  chapterIndex = target === -1 ? 0 : target;
  controllers.forEach((controller) => controller.pause());
  chapters.forEach((chapter, index) => { chapter.hidden = index !== chapterIndex; });
  navigation.forEach((link) => {
    if (link.getAttribute('href') === `#${chapters[chapterIndex].id}`) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  });
  const mode = chapterIndex < 4 ? 'course' : chapterIndex === 4 ? 'practice' : 'security';
  $$('[data-mode-link]').forEach((link) => {
    if (link.dataset.modeLink === mode) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  $('#chapter-prev').disabled = chapterIndex === 0;
  $('#chapter-next').disabled = chapterIndex === chapters.length - 1;
  $('#chapter-prev').textContent = chapterIndex === 4 ? '← Back to course' : chapterIndex === 5 ? '← Back to exercises' : '← Previous lesson';
  $('#chapter-next').textContent = chapterIndex < 3 ? 'Next lesson →' : chapterIndex === 3 ? 'Start hands-on →' : chapterIndex === 4 ? 'Next: security →' : 'End of workshop';
  $('#chapter-count').textContent = chapterIndex < 4 ? `Course · Lesson ${chapterIndex + 1} of 4`
    : chapterIndex === 4 ? 'Your turn · 3 commands' : 'Next session · Security';
  requestAnimationFrame(() => controllers.forEach((controller) => controller.redraw()));
  if (focus) {
    $('h1,h2', chapters[chapterIndex]).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
function changeChapter(direction) {
  const next = chapters[chapterIndex + direction];
  if (next) location.hash = next.id;
}
$('#chapter-prev').addEventListener('click', () => changeChapter(-1));
$('#chapter-next').addEventListener('click', () => changeChapter(1));
window.addEventListener('hashchange', () => showChapter(true));
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof Element)) return;
  if (event.target.closest('input,select,textarea,button,[contenteditable="true"],summary')) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    changeChapter(event.key === 'ArrowRight' ? 1 : -1);
  }
});

function createIntegrationAnimation() {
  const board = $('.integration-board');
  const panels = $$('.integration-panel', board).map((panel) => ({
    mcp: panel.dataset.integration === 'mcp',
    map: $('.integration-map', panel),
    svg: $('.integration-lines', panel),
    paths: $$('.integration-lines path', panel),
    packets: $$('.integration-dots>span', panel),
  }));
  const play = $('#integration-play');
  const caption = $('#integration-caption');
  let elapsed = 0;
  let previousTime;
  let frame;
  let playing = false;
  let complete = false;

  function updatePlay() {
    $('span', play).textContent = playing ? 'Pause' : complete ? 'Replay' : elapsed > 0 ? 'Resume' : 'Play';
    $('use', play).setAttribute('href', playing ? '#i-pause' : '#i-play');
    play.setAttribute('aria-pressed', String(playing));
    board.dataset.playing = String(playing);
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    previousTime = undefined;
    updatePlay();
  }
  function clear() {
    panels.forEach(({ packets }) => packets.forEach((packet) => { packet.hidden = true; }));
  }
  function draw() {
    if (complete || motion.matches || !board.getBoundingClientRect().width) return;
    const phase = Math.floor(elapsed / 1800);
    const returning = phase % 2 === 1;
    const progress = Math.min((elapsed % 1800) / 1500, 1);
    const position = returning ? 1 - progress : progress;
    board.dataset.direction = returning ? 'response' : 'request';
    panels.forEach(({ mcp, map, svg, paths, packets }) => {
      const bounds = map.getBoundingClientRect();
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      packets.forEach((packet, system) => {
        // Each side of the server is a separate exchange; do not cross the server card.
        const upstream = mcp && position < .4;
        const path = mcp ? paths[upstream ? 0 : system + 1] : paths[system];
        const fraction = mcp ? upstream ? position / .4 : (position - .4) / .6 : position;
        const point = path.getPointAtLength(path.getTotalLength() * fraction);
        const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        packet.hidden = false;
        packet.style.transform = `translate(${screenPoint.x - bounds.left}px, ${screenPoint.y - bounds.top}px) translate(-50%, -50%)`;
      });
    });
    caption.textContent = returning ? 'Results return to the application.' : 'Requests travel to your systems.';
    board.dataset.exchange = String(phase + 1);
  }
  function tick(time) {
    if (!playing) return;
    if (previousTime !== undefined) elapsed += time - previousTime;
    previousTime = time;
    if (elapsed >= 10800) {
      complete = true;
      pause();
      clear();
      caption.textContent = 'Same systems. A shared interface for AI applications.';
      return;
    }
    draw();
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (motion.matches) return;
    controllers.forEach((controller) => controller.pause());
    if (complete) { elapsed = 0; complete = false; }
    playing = true;
    updatePlay();
    draw();
    frame = requestAnimationFrame(tick);
  }
  play.addEventListener('click', () => {
    if (playing) pause();
    else start();
  });
  function updateMotion() {
    pause();
    if (motion.matches) clear();
    play.disabled = motion.matches;
    play.title = motion.matches ? 'Reduced motion: compare the two static diagrams.' : 'Animate illustrative exchanges; no network calls.';
    caption.textContent = 'Same systems. A shared interface for AI applications.';
  }
  motion.addEventListener('change', updateMotion);
  const redraw = () => {
    if (playing || elapsed > 0) draw();
  };
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(board);
  else window.addEventListener('resize', redraw);
  if ('IntersectionObserver' in window) new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) pause();
  }).observe(board);
  updateMotion();
  return { pause, redraw: () => { if (elapsed > 0) draw(); } };
}
controllers.push(createIntegrationAnimation());

let settings;
const endpointInput = $('#endpoint');
const protectedInput = $('#protected-endpoint');
const codeTargets = ['lab-code-0', 'lab-code-1', 'lab-code-2', 'anonymous-code', 'authenticated-code'];
$('#setup-code').textContent = setupCode;
function renderLab() {
  if (!settings) return;
  for (let index = 0; index < 3; index++) {
    const current = labStep(index, settings);
    $(`#lab-title-${index}`).textContent = current.title;
    $(`#lab-instruction-${index}`).textContent = current.instruction;
    $(`#lab-code-${index}`).textContent = current.code;
    $(`#lab-expected-${index}`).textContent = current.expected;
  }
  $('#protected-commands').hidden = !settings.protectedEndpoint;
  $('#protected-status').textContent = settings.protectedEndpoint
    ? `Configured protected endpoint: ${settings.protectedEndpoint}. Availability and Entra setup are not verified by this page.`
    : 'No protected endpoint configured. The presenter must configure Entra ID and supply this endpoint before session 3.';
  if (settings.protectedEndpoint) {
    const commands = securityCode(settings.protectedEndpoint);
    $('#anonymous-code').textContent = commands.anonymous;
    $('#authenticated-code').textContent = commands.authenticated;
  } else {
    $('#anonymous-code').textContent = '';
    $('#authenticated-code').textContent = '';
  }
}
function applyEndpoint() {
  try {
    const validated = validateEndpoint(endpointInput.value.trim());
    const protectedEndpoint = protectedInput.value.trim()
      ? validateEndpoint(protectedInput.value.trim()).endpoint : undefined;
    if (protectedEndpoint === validated.endpoint) throw new Error('Use separate public and protected endpoints.');
    settings = { ...validated, protectedEndpoint };
    endpointInput.value = settings.endpoint;
    protectedInput.value = protectedEndpoint ?? '';
    $('#endpoint-error').hidden = true;
    $('#endpoint-status').textContent = settings.local
      ? `Local sandbox: ${settings.endpoint}. Start npm run start:sandbox in a second terminal. This is not a public workshop endpoint.`
      : `Workshop sandbox: ${settings.endpoint}. Run the three commands below. This page does not test availability.`;
    $$('[data-copy],#share').forEach((button) => { button.disabled = false; });
    renderLab();
    return true;
  } catch (error) {
    settings = undefined;
    codeTargets.forEach((id) => { document.getElementById(id).textContent = 'Apply a valid endpoint to generate this command.'; });
    $('#participant-link')?.remove();
    $('#endpoint-error').textContent = error.message;
    $('#endpoint-error').hidden = false;
    $('#endpoint-status').textContent = 'Commands disabled. Correct the URLs, then apply endpoints.';
    $('#protected-commands').hidden = true;
    $$('[data-copy]:not([data-copy="setup-code"]),#share').forEach((button) => { button.disabled = true; });
    return false;
  }
}
function markEndpointDirty() {
  settings = undefined;
  codeTargets.forEach((id) => { document.getElementById(id).textContent = 'Apply the endpoint changes to regenerate this command.'; });
  $('#participant-link')?.remove();
  $('#endpoint-status').textContent = 'Changes not applied. Select “Apply endpoints” to regenerate all commands.';
  $('#protected-commands').hidden = true;
  $$('[data-copy]:not([data-copy="setup-code"]),#share').forEach((button) => { button.disabled = true; });
}
$('#endpoint-form').addEventListener('submit', (event) => { event.preventDefault(); applyEndpoint(); });
endpointInput.addEventListener('input', markEndpointDirty);
protectedInput.addEventListener('input', markEndpointDirty);

const params = new URLSearchParams(location.search);
endpointInput.value = params.get('endpoint') ?? defaultEndpoint;
protectedInput.value = params.get('protectedEndpoint') ?? '';
applyEndpoint();

let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  $('#copy-status').textContent = message;
  toastTimer = setTimeout(() => { $('#copy-status').textContent = ''; }, 6000);
}
async function copy(text, message = 'Copied. Paste into your Bash terminal in the workshop folder.') {
  try {
    await navigator.clipboard.writeText(text);
    notify(message);
  } catch {
    notify('Clipboard unavailable. Select the visible code and copy it manually.');
  }
}
$$('[data-copy]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.copy !== 'setup-code' && (!settings || !codeTargets.includes(button.dataset.copy))) return;
  void copy(document.getElementById(button.dataset.copy).textContent);
}));
$('#share').addEventListener('click', () => {
  if (!settings) return;
  const url = shareUrl(location.href, settings);
  // The link is visible too, so clipboard failure never strands the presenter.
  let link = $('#participant-link');
  if (!link) {
    link = document.createElement('a');
    link.id = 'participant-link';
    link.className = 'participant-link';
    $('#endpoint-form').after(link);
  }
  link.href = url;
  link.textContent = url;
  const localPage = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
  void copy(url, localPage
    ? 'Copied a local preview link. Publish this page before sharing outside your machine.'
    : settings.local ? 'Copied. This endpoint points to each participant’s own machine, not yours.' : 'Participant link copied. No credentials are included.');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) controllers.forEach((controller) => controller.pause());
});
window.addEventListener('pagehide', () => controllers.forEach((controller) => controller.pause()));
let printState;
function preparePrint() {
  controllers.forEach((controller) => controller.pause());
  if (printState) return;
  printState = $$('details').map((element) => ({ element, open: element.open }));
  printState.forEach(({ element }) => { element.open = true; });
}
function finishPrint() {
  if (!printState) return;
  printState.forEach(({ element, open }) => { element.open = open; });
  printState = undefined;
}
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', finishPrint);
matchMedia('print').addEventListener('change', (event) => event.matches ? preparePrint() : finishPrint());
$('#print').addEventListener('click', () => { preparePrint(); window.print(); });
$('#print').hidden = false;
$('.chapter-pagination').hidden = false;
document.documentElement.classList.add('enhanced');
showChapter();
