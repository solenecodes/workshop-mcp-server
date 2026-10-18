import { defaultEndpoint, labStep, shareUrl, validateEndpoint } from './presentation-lab.mjs';

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
const claimsArgs = { claimId: 'CLM-1001' };
const noteArgs = { ...claimsArgs, note: 'Workshop: evidence requested.' };

function callSteps(mode) {
  const write = mode === 'write';
  return [
    step('Connect the client.', 'The host creates an MCP client. It initializes the connection and negotiates the supported capabilities.', 'app', 'server',
      request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Workshop client', version: '1.0' } }, 1)),
    step('Discover the tool contracts.', 'tools/list returns names, descriptions and input schemas. No claim has been read or changed.', 'server', 'app',
      { request: request('tools/list', {}, 2), responseExcerpt: { tools: [
        { name: write ? 'create_claim_note' : 'check_missing_documents', inputSchema: {
          type: 'object', properties: { claimId: { type: 'string' }, ...(write ? { note: { type: 'string' } } : {}) },
          required: write ? ['claimId', 'note'] : ['claimId'],
        } },
      ] } }),
    step(write ? 'Ask to add a note.' : 'Ask about the missing documents.', 'The AI app interprets the request and selects a published tool. The model does not directly modify the database.', 'user', 'app',
      write ? 'Add "Workshop: evidence requested." to CLM-1001.' : 'What is missing from claim CLM-1001?'),
    step('Send structured arguments.', 'After any required client confirmation, the MCP client sends tools/call. The sentence becomes a typed request.', 'app', 'server',
      request('tools/call', { name: write ? 'create_claim_note' : 'check_missing_documents', arguments: write ? noteArgs : claimsArgs })),
    step(write ? 'Check access. Prepare a proposal.' : 'Check access. Read the data.', write
      ? 'The protected server checks the adjuster’s rights and queues an approval proposal. It does not append the note to the claim.'
      : 'The server checks the caller and claim assignment, then runs its business code against the synthetic dataset.', 'server', 'data',
      write ? { claimId: 'CLM-1001', claimMutation: false, pendingAction: 'create_claim_note' }
        : { claimId: 'CLM-1001', missingDocuments: ['proof_of_payment', 'incident_report'] }),
    step('Return an observed result.', write
      ? 'The result says requiresApproval. A human with a different supervisor/admin identity must review and confirm the exact proposal.'
      : 'The server returns the documents it actually found. The MCP client gives this result back to the host.', 'server', 'app',
      { jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: JSON.stringify(write
        ? { requiresApproval: true, proposedAction: { actionId: '<generated UUID>', toolName: 'create_claim_note', claimId: 'CLM-1001', payload: noteArgs.note } }
        : { claimId: 'CLM-1001', missingDocuments: ['proof_of_payment', 'incident_report'], redactedFields: [] }) }] } }),
    step(write ? '“The note is awaiting review.”' : '“Proof of payment and incident report are missing.”', write
      ? 'A proposal is not a completed write. Stop here; do not let the initiating agent approve its own request.'
      : 'The AI app answers using the tool result. Inspector can make the same protocol calls without any model.', 'app', 'user',
      write ? 'Claim unchanged. A separate, human-controlled approval is still required.' : 'Answer grounded in the tool result, not model memory.'),
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
    for (const [from, to] of [['user', 'app'], ['app', 'server'], ['server', 'data']]) {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', route(from, to));
      pathGroup.append(path);
    }
    const current = steps[index];
    const path = route(current.from, current.to);
    activePath.setAttribute('d', path);
    activePath.classList.toggle('blocked', Boolean(current.blocked));
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
      accent.textContent = write ? 'to claim CLM-1001.”' : 'from claim CLM-1001?”';
      heading.replaceChildren(document.createTextNode(write ? '“Add a note' : '“What is missing'), document.createElement('br'), accent);
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
  navigation.forEach((link, index) => {
    if (index === chapterIndex) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  });
  $('#chapter-prev').disabled = chapterIndex === 0;
  $('#chapter-next').disabled = chapterIndex === chapters.length - 1;
  $('#chapter-count').textContent = `${chapterIndex + 1} / ${chapters.length}`;
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
  const paths = $$('.integration-lines path', board);
  const packet = $('.integration-packet', board);
  const apps = $$('.integration-side:not(.systems)>div', board);
  const systems = $$('.systems>div', board);
  const play = $('#integration-play');
  const caption = $('#integration-caption');
  let index = 0;
  let elapsed = 0;
  let previousTime;
  let frame;
  let playing = false;
  let complete = false;

  function phases() {
    return board.dataset.integration === 'mcp'
      ? ['tools/list', 'tool schemas', 'tools/call', 'tool result']
      : ['custom request', 'custom response'];
  }
  function updatePlay() {
    $('span', play).textContent = playing ? 'Pause' : complete ? 'Replay' : 'Play';
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
    paths.forEach((path) => path.classList.remove('is-active'));
    [...apps, ...systems].forEach((element) => element.classList.remove('is-active'));
    packet.setAttribute('visibility', 'hidden');
  }
  function idleCaption() {
    return board.dataset.integration === 'mcp'
      ? 'Same connections. One shared protocol: reusable clients, a server per system.'
      : 'Each app-to-system pair needs its own integration code.';
  }
  function draw() {
    clear();
    if (complete || motion.matches || !board.getBoundingClientRect().width) return;
    const messages = phases();
    const pair = Math.floor(index / messages.length);
    const phase = index % messages.length;
    const path = paths[pair];
    const app = apps[Math.floor(pair / systems.length)];
    const system = systems[pair % systems.length];
    const returning = phase % 2 === 1;
    path.classList.add('is-active');
    app.classList.add('is-active');
    system.classList.add('is-active');
    const progress = Math.min(elapsed / 900, 1);
    const point = path.getPointAtLength(path.getTotalLength() * (returning ? 1 - progress : progress));
    // Compensate for the stretched viewBox so packets stay round at every viewport width.
    const scale = 300 / $('.integration-lines', board).getBoundingClientRect().width;
    packet.setAttribute('transform', `translate(${point.x} ${point.y}) scale(${scale} 1)`);
    packet.setAttribute('visibility', 'visible');
    caption.textContent = `${$('strong', app).textContent} ${returning ? '←' : '→'} ${$('strong', system).textContent} · ${messages[phase]}`;
    board.dataset.exchange = String(index + 1);
  }
  function tick(time) {
    if (!playing) return;
    if (previousTime !== undefined) elapsed += time - previousTime;
    previousTime = time;
    if (elapsed >= 1150) {
      elapsed = 0;
      index++;
      if (index === paths.length * phases().length) {
        complete = true;
        pause();
        clear();
        caption.textContent = idleCaption();
        return;
      }
    }
    draw();
    frame = requestAnimationFrame(tick);
  }
  play.addEventListener('click', () => {
    if (playing) { pause(); return; }
    controllers.forEach((controller) => controller.pause());
    if (complete) { index = 0; elapsed = 0; complete = false; }
    playing = true;
    updatePlay();
    draw();
    frame = requestAnimationFrame(tick);
  });
  $$('[data-integration-mode]').forEach((button) => button.addEventListener('click', () => {
    pause();
    clear();
    index = 0;
    elapsed = 0;
    complete = false;
    delete board.dataset.exchange;
    board.dataset.integration = button.dataset.integrationMode;
    $$('[data-integration-mode]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    caption.textContent = idleCaption();
    updatePlay();
  }));
  function updateMotion() {
    pause();
    if (motion.matches) clear();
    play.disabled = motion.matches;
    play.title = motion.matches ? 'Reduced motion: compare the two static diagrams.' : 'Animate illustrative exchanges; no network calls.';
    caption.textContent = idleCaption();
  }
  motion.addEventListener('change', updateMotion);
  if ('ResizeObserver' in window) new ResizeObserver(() => {
    if (playing || elapsed > 0) draw();
  }).observe(board);
  if ('IntersectionObserver' in window) new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) pause();
  }).observe(board);
  updateMotion();
  return { pause, redraw: () => { if (elapsed > 0) draw(); } };
}
controllers.push(createIntegrationAnimation());

let settings;
let labIndex = 0;
const endpointInput = $('#endpoint');
const accessInput = $('#access');
const codeTargets = ['lab-code', 'terminal-code', 'inspector-code'];
function renderLab() {
  if (!settings) return;
  const current = labStep(labIndex, settings);
  $('#lab-step-title').textContent = current.title;
  $('#lab-instruction').textContent = current.instruction;
  $('#copy-label').textContent = current.label;
  $('#lab-code').textContent = current.code;
  $('#terminal-code').textContent = current.terminalCode;
  $('#inspector-code').textContent = current.inspectorCode;
  $('#lab-expected').textContent = current.expected;
  $('#lab-progress').textContent = `Step ${labIndex + 1} / 6`;
  $$('[data-lab-step]').forEach((button, index) => button.setAttribute('aria-pressed', String(index === labIndex)));
  $('#lab-prev').disabled = labIndex === 0;
  $('#lab-next').disabled = labIndex === 5;
  $('#lab-completion').textContent = labIndex === 5 ? 'Compare the actual result with your pair.' : 'Advance after checking your client’s result.';
}
function applyEndpoint() {
  try {
    settings = validateEndpoint(endpointInput.value.trim(), accessInput.value);
    endpointInput.value = settings.endpoint;
    $('#endpoint-error').hidden = true;
    $('#endpoint-status').textContent = settings.local
      ? 'Local endpoint: each participant must run their own server. Availability is not checked by this page.'
      : 'HTTPS endpoint configured. Credentials are shared separately; availability and hosting controls must be verified by the facilitator.';
    $$('[data-copy],#share').forEach((button) => { button.disabled = false; });
    renderLab();
    return true;
  } catch (error) {
    settings = undefined;
    codeTargets.forEach((id) => { document.getElementById(id).textContent = 'Apply a valid endpoint to generate this command.'; });
    $('#participant-link')?.remove();
    $('#endpoint-error').textContent = error.message;
    $('#endpoint-error').hidden = false;
    $('#endpoint-status').textContent = 'Endpoint not applied. Fix the URL or access mode before copying commands.';
    $$('[data-copy],#share').forEach((button) => { button.disabled = true; });
    return false;
  }
}
function markEndpointDirty() {
  settings = undefined;
  codeTargets.forEach((id) => { document.getElementById(id).textContent = 'Apply the endpoint changes to regenerate this command.'; });
  $('#participant-link')?.remove();
  $('#endpoint-status').textContent = 'Changes not applied. Select “Use endpoint” to regenerate all commands.';
  $$('[data-copy],#share').forEach((button) => { button.disabled = true; });
}
$('#endpoint-form').addEventListener('submit', (event) => { event.preventDefault(); applyEndpoint(); });
endpointInput.addEventListener('input', markEndpointDirty);
accessInput.addEventListener('change', markEndpointDirty);
$$('[data-lab-step]').forEach((button) => button.addEventListener('click', () => {
  labIndex = Number(button.dataset.labStep);
  renderLab();
}));
$('#lab-prev').addEventListener('click', () => { labIndex = Math.max(0, labIndex - 1); renderLab(); });
$('#lab-next').addEventListener('click', () => { labIndex = Math.min(5, labIndex + 1); renderLab(); });

const params = new URLSearchParams(location.search);
endpointInput.value = params.get('endpoint') ?? defaultEndpoint;
const access = params.get('access') ?? 'bearer';
if (['bearer', 'oauth', 'open'].includes(access)) accessInput.value = access;
else {
  const invalid = document.createElement('option');
  invalid.value = access;
  invalid.textContent = 'Unsupported access mode';
  accessInput.append(invalid);
  accessInput.value = access;
}
applyEndpoint();

let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  $('#copy-status').textContent = message;
  toastTimer = setTimeout(() => { $('#copy-status').textContent = ''; }, 6000);
}
async function copy(text, message = 'Copied. Paste into your MCP client.') {
  try {
    await navigator.clipboard.writeText(text);
    notify(message);
  } catch {
    notify('Clipboard unavailable. Select the visible code and copy it manually.');
  }
}
$$('[data-copy]').forEach((button) => button.addEventListener('click', () => {
  if (!settings || !codeTargets.includes(button.dataset.copy)) return;
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
