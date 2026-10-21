import { defaultEndpoint, defaultProtectedEndpoint, labCommand, labSteps, parseCommandRequest, shareUrl, validateEndpoint } from './presentation-lab.mjs?v=security-three-slides-1';
import { callMcp, jsonTokens } from './mcp-console.mjs?v=security-three-slides-1';
import { securityAliases, securityChapters } from './presentation-security.mjs?v=security-three-slides-1';
import { initializeAgenda } from './presentation-agenda.mjs?v=agenda-collapse-1';
import { initializeParkingLot } from './parking-lot.mjs?v=parking-lot-4';

initializeParkingLot();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
function renderJson(element, value, focus = []) {
  element.replaceChildren(...jsonTokens(value, focus).map(({ text, kind, focus: focused }) => {
    const token = document.createElement('span');
    token.className = `json-${kind}${focused ? ' json-focus' : ''}`;
    token.textContent = text;
    return token;
  }));
}
$$('svg.icon').forEach((icon) => {
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
});
$$('.lab-fallback').forEach((element) => { element.open = false; });

const chapters = $$('.chapter:not(.agenda-panel)');
const courseChapters = chapters.filter((chapter) => chapter.dataset.course === 'fundamentals');
const securityCourse = securityChapters;
const agendaPanels = $$('.agenda-panel');
const navigation = $$('.chapters a:not(.agenda-row)');
initializeAgenda();
let activePanel;
let chapterIndex = 0;
function showChapter(focus = false) {
  const requestedId = location.hash.slice(1);
  const targetId = securityAliases[requestedId] ?? requestedId;
  if (targetId !== requestedId) history.replaceState(null, '', `#${targetId}`);
  const target = chapters.findIndex((chapter) => chapter.id === targetId);
  chapterIndex = target === -1 ? 0 : target;
  activePanel = agendaPanels.find((panel) => `#${panel.id}` === location.hash);
  chapters.forEach((chapter, index) => { chapter.hidden = Boolean(activePanel) || index !== chapterIndex; });
  agendaPanels.forEach((panel) => { panel.hidden = panel !== activePanel; });
  $('.chapter-pagination').hidden = Boolean(activePanel);
  navigation.forEach((link) => {
    if (link.getAttribute('href') === `#${chapters[chapterIndex].id}`) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  });
  const securityIndex = securityChapters.findIndex(({ id }) => id === chapters[chapterIndex].id);
  const securityLesson = securityCourse.findIndex(({ id }) => id === chapters[chapterIndex].id);
  const agendaKey = activePanel ? activePanel.id.replace('day-', '') : securityIndex >= 0 ? 'session-3' : 'session-1';
  $$('.agenda li[data-key]').forEach((item) => {
    const active = item.dataset.key === agendaKey;
    item.classList.toggle('current', active);
    if (active) item.setAttribute('aria-current', 'true');
    else item.removeAttribute('aria-current');
  });
  const currentLink = $('.agenda-sub:not([hidden]) a[aria-current="step"]') ?? $('.agenda li.current .agenda-row');
  const menu = $('.chapters');
  if (currentLink && menu.scrollHeight > menu.clientHeight) {
    const top = currentLink.getBoundingClientRect().top - menu.getBoundingClientRect().top + menu.scrollTop;
    menu.scrollTo({ top: Math.max(0, top - menu.clientHeight / 3) });
  }
  $('#chapter-prev').disabled = chapterIndex === 0;
  $('#chapter-next').disabled = chapterIndex === chapters.length - 1;
  const currentChapter = chapters[chapterIndex];
  const courseIndex = courseChapters.indexOf(currentChapter);
  const isLab = currentChapter.id === 'lab';
  $('#chapter-prev').textContent = isLab ? '← Back to course' : securityIndex === 0 ? '← Back to exercises' : '← Previous lesson';
  $('#chapter-next').textContent = chapterIndex === chapters.length - 1 ? 'Session complete'
    : courseIndex === courseChapters.length - 1 ? 'Start live examples →' : isLab ? 'Next: security →'
      : 'Next lesson →';
  $('#chapter-count').textContent = courseIndex >= 0 ? `Course · Lesson ${courseIndex + 1} of ${courseChapters.length}`
    : isLab ? 'Your turn · Live lab'
      : `Session 3 · Slide ${securityLesson + 1} of ${securityCourse.length}`;
  if (focus) {
    $('h1,h2', activePanel ?? chapters[chapterIndex]).focus({ preventScroll: true });
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
  if (event.target.closest('input,select,textarea,button,[contenteditable],summary,.foundation-table-scroll')) return;
  if (activePanel) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    changeChapter(event.key === 'ArrowRight' ? 1 : -1);
  }
});

let settings;
let consoleBusy = false;
let currentStep = 0;
let stepResults = [];
let stepEdits = [];
const endpointInput = $('#endpoint');
const protectedInput = $('#protected-endpoint');

const tabs = $('#lab-tabs');
labSteps.forEach((step, index) => {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'step-tab';
  const number = document.createElement('span');
  number.textContent = String(index + 1);
  tab.append(number, document.createTextNode(step.short));
  tab.addEventListener('click', () => { currentStep = index; renderStep(); });
  tabs.append(tab);
});
function renderStep() {
  const step = labSteps[currentStep];
  $$('.step-tab', tabs).forEach((tab, index) => {
    tab.setAttribute('aria-pressed', String(index === currentStep));
    tab.classList.toggle('done', stepResults[index] !== undefined);
  });
  $('#lab-count').textContent = `Step ${currentStep + 1} of ${labSteps.length}`;
  $('#lab-step-title').textContent = step.title;
  $('#lab-why').textContent = step.why;
  $('#lab-notice').textContent = step.notice;
  $('#lab-changed-legend').textContent = currentStep === 0
    ? 'is the request: ask the server for its list of tools.' : 'is what changes from the previous step.';
  $('#lab-prev').disabled = currentStep === 0;
  $('#lab-next').disabled = currentStep === labSteps.length - 1;
  const command = $('#lab-command');
  const edited = stepEdits[currentStep];
  if (settings && edited !== undefined) {
    command.textContent = edited;
  } else if (settings) {
    const { segments } = labCommand(currentStep, settings);
    command.replaceChildren(...segments.map(({ text, changed }) => {
      const part = document.createElement(changed ? 'mark' : 'span');
      if (changed) part.className = 'hl';
      part.textContent = text;
      return part;
    }));
  } else {
    command.textContent = 'Apply a valid endpoint to generate this command.';
  }
  command.contentEditable = settings ? 'plaintext-only' : 'false';
  $('#lab-reset').hidden = edited === undefined;
  $('#lab-copy').disabled = !settings;
  $('#lab-run').disabled = !settings || consoleBusy;
  const stored = stepResults[currentStep];
  const output = $('#lab-output');
  $('#lab-timing').textContent = stored ? `· ${stored.elapsedMs} ms` : '';
  if (stored) renderJson(output, stored.result.structuredContent ?? stored.result, step.focus);
  else output.textContent = 'Run this step to see the real response.';
  const status = $('#lab-status');
  if (settings && !consoleBusy) {
    const failed = stored?.result.isError === true;
    status.dataset.error = String(failed);
    status.textContent = !stored ? 'Ready. Copy the command, or run it from this page.'
      : failed ? `The server returned a tool error (${stored.elapsedMs} ms). See the actual response.`
        : `Response received in ${stored.elapsedMs} ms.`;
  }
}
$('#lab-prev').addEventListener('click', () => { currentStep = Math.max(0, currentStep - 1); renderStep(); });
$('#lab-next').addEventListener('click', () => { currentStep = Math.min(labSteps.length - 1, currentStep + 1); renderStep(); });
function renderLab() {
  if (!settings) return;
  $('#lab-status').textContent = consoleBusy ? 'Finishing the current call...' : 'Ready. Copy the command, or run it from this page.';
  $('#lab-status').dataset.error = 'false';
  renderStep();
}
function applyEndpoint() {
  try {
    const validated = validateEndpoint(endpointInput.value.trim());
    const protectedEndpoint = protectedInput.value.trim()
      ? validateEndpoint(protectedInput.value.trim()).endpoint : undefined;
    if (protectedEndpoint === validated.endpoint) throw new Error('Use separate public and protected endpoints.');
    settings = { ...validated, protectedEndpoint };
    stepResults = [];
    stepEdits = [];
    endpointInput.value = settings.endpoint;
    protectedInput.value = protectedEndpoint ?? '';
    $('#endpoint-error').hidden = true;
    $('#endpoint-status').textContent = settings.local
      ? `Local sandbox: ${settings.endpoint}. Start npm run start:sandbox in a second terminal. This is not a public workshop endpoint.`
      : `Public workshop endpoint: ${settings.endpoint}. The three steps below call this server.`;
    $('#share').disabled = false;
    renderLab();
    return true;
  } catch (error) {
    settings = undefined;
    stepResults = [];
    stepEdits = [];
    renderStep();
    $('#participant-link')?.remove();
    $('#endpoint-error').textContent = error.message;
    $('#endpoint-error').hidden = false;
    $('#endpoint-status').textContent = 'Commands disabled. Correct the URLs, then apply endpoints.';
    $('#share').disabled = true;
    return false;
  }
}
function markEndpointDirty() {
  settings = undefined;
  stepResults = [];
  stepEdits = [];
  renderStep();
  $('#participant-link')?.remove();
  $('#endpoint-status').textContent = 'Changes not applied. Select “Apply endpoints” to regenerate all commands.';
  $('#share').disabled = true;
}
$('#endpoint-form').addEventListener('submit', (event) => { event.preventDefault(); applyEndpoint(); });
endpointInput.addEventListener('input', markEndpointDirty);
protectedInput.addEventListener('input', markEndpointDirty);

const params = new URLSearchParams(location.search);
endpointInput.value = params.get('endpoint') ?? defaultEndpoint;
protectedInput.value = params.get('protectedEndpoint') ?? defaultProtectedEndpoint;
applyEndpoint();

// The command is editable: the default is the generated command until the user types.
const currentCommandText = () => stepEdits[currentStep] ?? labCommand(currentStep, settings).code;
$('#lab-command').addEventListener('input', () => {
  if (!settings) return;
  stepEdits[currentStep] = $('#lab-command').innerText.replace(/\r/g, '').replace(/\n$/, '');
  $('#lab-reset').hidden = false;
});
$('#lab-reset').addEventListener('click', () => { delete stepEdits[currentStep]; renderStep(); });
$('#lab-copy').addEventListener('click', () => {
  if (settings) void copy(currentCommandText(), 'Copied. Paste it into a Bash terminal (Git Bash or WSL on Windows).');
});
$('#lab-run').addEventListener('click', async () => {
  if (!settings || consoleBusy) return;
  consoleBusy = true;
  const endpoint = settings.endpoint;
  const index = currentStep;
  const status = $('#lab-status');
  $('#lab-run').disabled = true;
  status.dataset.error = 'false';
  status.textContent = 'Sending the request. If the server is starting, this may take up to 60 seconds...';
  $('#lab-output').textContent = 'Waiting for the server...';
  let failed = false;
  try {
    const reply = await callMcp(endpoint, parseCommandRequest(stepEdits[index] ?? labCommand(index, settings).code));
    if (settings?.endpoint !== endpoint) throw new Error('The endpoint changed. Apply it and run the call again.');
    stepResults[index] = reply;
  } catch (error) {
    failed = true;
    status.dataset.error = 'true';
    status.textContent = 'The call failed. No demo response was substituted.';
    if (currentStep === index) $('#lab-output').textContent = error.message;
  } finally {
    consoleBusy = false;
    if (failed) $('#lab-run').disabled = !settings;
    else renderStep();
  }
});

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

let printState;
function preparePrint() {
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
$('.chapter-pagination').hidden = false;
// Day strip in the top bar: where the day should be now in Paris, with the previous and next steps greyed out.
// Add ?time=HH:MM to the page address to preview a moment of the day (the clock then stays frozen).
const toMinutes = (value) => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; };
const previewTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(new URLSearchParams(location.search).get('time') ?? '')
  ? new URLSearchParams(location.search).get('time') : undefined;
const dayItems = $$('.agenda li[data-start]').map((item) => ({
  emoji: $('.agenda-emoji', item).textContent, short: item.dataset.short, href: $('.agenda-row', item).getAttribute('href'),
  start: item.dataset.start, end: item.dataset.end,
}));
function parisClock() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return `${parts.hour}:${parts.minute}`;
}
const formatLeft = (minutes) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} left` : `${minutes} min left`;
function dayChip(kind, { label, title, detail, href, progress }) {
  const chip = document.createElement(href ? 'a' : 'div');
  chip.className = `day-chip ${kind}`;
  if (href) chip.href = href;
  if (kind === 'is-now') chip.setAttribute('aria-current', 'time');
  if (label) { const tag = document.createElement('span'); tag.className = 'day-label'; tag.textContent = label; chip.append(tag); }
  const name = document.createElement('b');
  name.textContent = title;
  const small = document.createElement('small');
  small.textContent = detail;
  chip.append(name, small);
  if (progress !== undefined) {
    const bar = document.createElement('span');
    bar.className = 'day-progress';
    const fill = document.createElement('i');
    fill.style.width = `${progress}%`;
    bar.append(fill);
    chip.append(bar);
  }
  return chip;
}
function updateDayStrip() {
  const clock = previewTime ?? parisClock();
  const now = toMinutes(clock);
  const index = dayItems.findIndex((item) => now >= toMinutes(item.start) && now < toMinutes(item.end));
  const label = (item) => `${item.emoji} ${item.short}`;
  const chips = [];
  const clockText = document.createElement('span');
  clockText.className = 'day-clock';
  clockText.textContent = previewTime ? `Preview ${clock}` : `Paris ${clock}`;
  chips.push(clockText);
  if (index >= 0) {
    const [before, current, after] = [dayItems[index - 1], dayItems[index], dayItems[index + 1]];
    const length = toMinutes(current.end) - toMinutes(current.start);
    if (before) chips.push(dayChip('is-before', { title: label(before), detail: before.start, href: before.href }));
    chips.push(dayChip('is-now', {
      label: 'Now', title: label(current), detail: `${current.start}–${current.end} · ${formatLeft(toMinutes(current.end) - now)}`,
      href: current.href, progress: Math.round((now - toMinutes(current.start)) / length * 100),
    }));
    if (after) chips.push(dayChip('is-after', { title: label(after), detail: after.start, href: after.href }));
  } else if (now < toMinutes(dayItems[0].start)) {
    chips.push(dayChip('is-now', { label: 'Today', title: `Starts at ${dayItems[0].start}`, detail: 'Paris time' }));
    chips.push(dayChip('is-after', { title: label(dayItems[0]), detail: dayItems[0].start, href: dayItems[0].href }));
  } else {
    const last = dayItems[dayItems.length - 1];
    chips.push(dayChip('is-before', { title: label(last), detail: last.start, href: last.href }));
    chips.push(dayChip('is-now', { label: 'Today', title: 'The day is over', detail: `Ended at ${last.end}` }));
  }
  $('#day-strip').replaceChildren(...chips);
}
updateDayStrip();
if (!previewTime) {
  setInterval(() => { if (!document.hidden) updateDayStrip(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDayStrip(); });
}
document.documentElement.classList.add('enhanced');
showChapter();
