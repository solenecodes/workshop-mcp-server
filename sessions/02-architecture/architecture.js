import { demoCommands, doorEdges, doorSteps } from './architecture-steps.mjs?v=session-2-1';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';
const controllers = [];

// Front-door walk-through: one step at a time, Play advances on its own, never starts by itself.
function createDoor(root) {
  const diagram = $('.door-diagram', root);
  const svg = $('.flow-lines', root);
  const base = $('[data-paths]', svg);
  const active = $('[data-active-path]', svg);
  const packet = $('[data-packet]', svg);
  const nodes = Object.fromEntries($$('[data-node]', root).map((node) => [node.dataset.node, node]));
  const play = $('[data-play]', root);
  const dots = $('.flow-dots', root);
  let index = 0;
  let timer;
  let frame;
  const center = (name) => {
    const box = nodes[name].getBoundingClientRect();
    const frameBox = diagram.getBoundingClientRect();
    return { x: box.left - frameBox.left + box.width / 2, y: box.top - frameBox.top + box.height / 2 };
  };
  const curve = (from, to) => {
    const a = center(from), b = center(to);
    const bend = Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? [(a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y] : [a.x, (a.y + b.y) / 2, b.x, (a.y + b.y) / 2];
    return `M${a.x} ${a.y} C${bend[0]} ${bend[1]} ${bend[2]} ${bend[3]} ${b.x} ${b.y}`;
  };
  function redraw() {
    if (!diagram.offsetParent) return;
    const box = diagram.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    base.replaceChildren(...doorEdges.map(([from, to]) => {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', curve(from, to));
      return path;
    }));
    const step = doorSteps[index];
    active.setAttribute('d', step.path.slice(1).map((name, position) => curve(step.path[position], name)).join(' '));
  }
  function animatePacket() {
    cancelAnimationFrame(frame);
    packet.setAttribute('visibility', 'hidden');
    if (motion.matches || !active.getTotalLength) return;
    const length = active.getTotalLength();
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / 1100);
      const point = active.getPointAtLength(length * progress);
      packet.setAttribute('cx', point.x);
      packet.setAttribute('cy', point.y);
      packet.setAttribute('visibility', progress < 1 ? 'visible' : 'hidden');
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  function show(next, animate = true) {
    index = Math.max(0, Math.min(doorSteps.length - 1, next));
    const step = doorSteps[index];
    Object.entries(nodes).forEach(([name, node]) => {
      node.classList.toggle('active', step.nodes.includes(name));
      node.classList.toggle('dim', !step.nodes.includes(name));
      node.classList.toggle('blocked', Boolean(step.blocked) && name === 'gateway');
    });
    active.classList.toggle('blocked', Boolean(step.blocked));
    $('[data-step-title]', root).textContent = `${index + 1}. ${step.title}`;
    $('[data-step-plain]', root).textContent = step.plain;
    $('[data-step-detail]', root).textContent = step.detail;
    $('.flow-count', root).textContent = `${index + 1} / ${doorSteps.length}`;
    $$('button', dots).forEach((dot, position) => dot.setAttribute('aria-pressed', String(position === index)));
    $('[data-prev]', root).disabled = index === 0;
    $('[data-next]', root).disabled = index === doorSteps.length - 1;
    redraw();
    if (!timer) playLabel();
    if (animate) animatePacket();
  }
  function playLabel() {
    $('span', play).textContent = index === doorSteps.length - 1 ? 'Replay' : index ? 'Resume' : 'Play';
    $('use', play).setAttribute('href', '#i-play');
  }
  function pause() {
    clearInterval(timer);
    timer = undefined;
    play.setAttribute('aria-pressed', 'false');
    playLabel();
  }
  function start() {
    if (index === doorSteps.length - 1) show(0);
    play.setAttribute('aria-pressed', 'true');
    $('span', play).textContent = 'Pause';
    $('use', play).setAttribute('href', '#i-pause');
    timer = setInterval(() => {
      if (index === doorSteps.length - 1) { pause(); return; }
      show(index + 1);
    }, 4200);
  }
  doorSteps.forEach((step, position) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.textContent = String(position + 1);
    dot.setAttribute('aria-label', `Step ${position + 1}: ${step.title}`);
    dot.addEventListener('click', () => { pause(); show(position); });
    dots.append(dot);
  });
  play.addEventListener('click', () => (timer ? pause() : start()));
  $('[data-prev]', root).addEventListener('click', () => { pause(); show(index - 1); });
  $('[data-next]', root).addEventListener('click', () => { pause(); show(index + 1); });
  $('[data-reset]', root).addEventListener('click', () => { pause(); show(0); });
  const note = $('.motion-note', root);
  const updateMotion = () => { note.hidden = !motion.matches; };
  motion.addEventListener('change', updateMotion);
  updateMotion();
  new IntersectionObserver((entries) => { if (!entries[0].isIntersecting) pause(); }).observe(root);
  window.addEventListener('resize', () => redraw());
  show(0, false);
  return { pause, redraw };
}

$$('[data-door]').forEach((root) => controllers.push(createDoor(root)));
$$('.flow-fallback').forEach((element) => { element.open = false; });

const commands = demoCommands();
$('#demo-anonymous').textContent = commands.anonymous;
$('#demo-metadata').textContent = commands.metadata;
$('#demo-signed-in').textContent = commands.signedIn;

const chapters = $$('.chapter:not(.agenda-panel)');
const navigation = $$('.chapters a:not(.agenda-row)');
const lessons = chapters.length - 1;
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
  const currentLink = $('.chapters a[aria-current="step"]');
  const menu = $('.chapters');
  if (currentLink && menu.scrollHeight > menu.clientHeight) {
    const top = currentLink.getBoundingClientRect().top - menu.getBoundingClientRect().top + menu.scrollTop;
    menu.scrollTo({ top: Math.max(0, top - menu.clientHeight / 3) });
  }
  $('#chapter-prev').disabled = chapterIndex === 0;
  $('#chapter-prev').textContent = chapterIndex === lessons ? '← Back to course' : '← Previous lesson';
  $('#chapter-next').textContent = chapterIndex < lessons - 1 ? 'Next lesson →' : chapterIndex === lessons - 1 ? 'Start the demo →' : 'Next: security →';
  $('#chapter-count').textContent = chapterIndex < lessons ? `Course · Lesson ${chapterIndex + 1} of ${lessons}` : 'Demo · Presenter';
  requestAnimationFrame(() => controllers.forEach((controller) => controller.redraw()));
  if (focus) {
    $('h1,h2', chapters[chapterIndex]).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
function changeChapter(direction) {
  const next = chapters[chapterIndex + direction];
  if (next) location.hash = next.id;
  else if (direction > 0) location.href = '../01-mcp-fondamentaux/presentation.html#auth';
}
$('#chapter-prev').addEventListener('click', () => changeChapter(-1));
$('#chapter-next').addEventListener('click', () => changeChapter(1));
window.addEventListener('hashchange', () => showChapter(true));
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof Element)) return;
  if (event.target.closest('input,select,textarea,button,[contenteditable],summary')) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    changeChapter(event.key === 'ArrowRight' ? 1 : -1);
  }
});

let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  $('#copy-status').textContent = message;
  toastTimer = setTimeout(() => { $('#copy-status').textContent = ''; }, 6000);
}
$$('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).textContent);
    notify('Copied. Replace the placeholders, then paste into your Bash terminal in the workshop folder.');
  } catch {
    notify('Clipboard unavailable. Select the visible code and copy it manually.');
  }
}));

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
$('.chapter-pagination').hidden = false;

// Day strip, as on the Session 1 page: where the day should be now in Paris, previous and next steps greyed out.
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
