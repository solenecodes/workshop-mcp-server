import { defaultEndpoint, validateEndpoint } from './presentation-lab.mjs?v=parking-lot-4';

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris', dateStyle: 'medium', timeStyle: 'short',
});

export function parkingLotTime(createdAt) {
  return timeFormatter.format(new Date(createdAt));
}

export function parkingLotEndpoint(pageUrl) {
  const url = new URL(pageUrl);
  const endpoint = validateEndpoint(url.searchParams.get('endpoint') ?? defaultEndpoint).endpoint;
  return new URL('/parking-lot', endpoint).href;
}

export function initializeParkingLot() {
  const dialog = document.querySelector('#parking-lot');
  const opener = document.querySelector('#parking-open');
  const count = document.querySelector('#parking-count');
  const form = document.querySelector('#parking-form');
  const input = document.querySelector('#parking-question');
  const list = document.querySelector('#parking-notes');
  const status = document.querySelector('#parking-status');
  const archived = document.querySelector('#parking-archived');
  const refresh = document.querySelector('#parking-refresh');
  let endpoint;
  let notes = [];
  let busy = false;
  let loading = false;
  let revision = 0;
  const colors = ['yellow', 'pink', 'blue', 'green', 'purple'];
  const message = (text, error = false) => {
    if (status.textContent !== text) status.textContent = text;
    if (status.dataset.error !== String(error)) status.dataset.error = String(error);
  };
  function button(text, label, action) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'button';
    element.textContent = text;
    element.setAttribute('aria-label', label);
    element.title = label;
    element.disabled = busy;
    element.addEventListener('click', action);
    return element;
  }
  function updateCount() {
    const total = String(notes.filter((note) => !note.archived).length);
    if (count.textContent !== total) count.textContent = total;
    const label = `${total} active question${total === '1' ? '' : 's'}`;
    if (count.getAttribute('aria-label') !== label) count.setAttribute('aria-label', label);
    if (count.title !== 'Active questions') count.title = 'Active questions';
  }
  function render() {
    const visible = notes.filter((note) => note.archived === archived.checked);
    if (!visible.length) {
      const empty = list.querySelector('.parking-empty') ?? document.createElement('p');
      empty.className = 'parking-empty';
      const text = archived.checked ? 'No archived questions.' : 'No questions yet. Leave the first sticky note!';
      if (empty.textContent !== text) empty.textContent = text;
      if (list.firstElementChild !== empty || list.children.length !== 1) list.replaceChildren(empty);
      return;
    }
    const cards = new Map([...list.children].map((card) => [card.dataset.noteId, card]));
    const visibleIds = new Set(visible.map((note) => note.id));
    for (const card of [...list.children]) {
      if (!visibleIds.has(card.dataset.noteId)) card.remove();
    }
    for (const note of visible) {
      let card = cards.get(note.id);
      if (!card) card = createCard(note);
      const question = card.querySelector('p');
      if (question.textContent !== note.question) question.textContent = note.question;
      if (card.dataset.color !== note.color) {
        card.dataset.color = note.color;
        const toggle = card.querySelector('summary');
        toggle.dataset.color = note.color;
        toggle.setAttribute('aria-label', `Change note color (${note.color})`);
        card.querySelectorAll('.parking-swatch').forEach((swatch) => {
          swatch.setAttribute('aria-pressed', String(swatch.dataset.color === note.color));
        });
      }
      const postedAt = card.querySelector('time');
      if (postedAt.dateTime !== note.createdAt) {
        postedAt.dateTime = note.createdAt;
        postedAt.textContent = parkingLotTime(note.createdAt);
        postedAt.title = `Posted ${dateFormatter.format(new Date(note.createdAt))} (Paris time)`;
        postedAt.setAttribute('aria-label', postedAt.title);
      }
      cards.set(note.id, card);
    }
    visible.forEach((note, index) => {
      const card = cards.get(note.id);
      if (list.children[index] !== card) list.insertBefore(card, list.children[index] ?? null);
    });
  }
  function createCard(note) {
    const card = document.createElement('article');
    card.className = 'parking-note';
    card.dataset.noteId = note.id;
    const question = document.createElement('p');
    question.textContent = note.question;
    const remove = button('×', 'Delete question', () => {
      if (confirm('Delete this question for everyone?')) void request('DELETE', note.id, {});
    });
    remove.classList.add('parking-delete');
    const actions = document.createElement('div');
    actions.className = 'parking-note-actions';
    const archive = button(note.archived ? 'Restore' : 'Archive', note.archived ? 'Restore question' : 'Archive question',
      () => void request('PATCH', note.id, { archived: !note.archived }));
    const postedAt = document.createElement('time');
    postedAt.className = 'parking-note-time';
    const picker = document.createElement('details');
    picker.className = 'parking-color-picker';
    const toggle = document.createElement('summary');
    toggle.dataset.color = note.color;
    toggle.setAttribute('aria-label', `Change note color (${note.color})`);
    toggle.title = 'Change note color';
    const palette = document.createElement('div');
    palette.className = 'parking-palette';
    palette.setAttribute('role', 'group');
    palette.setAttribute('aria-label', 'Note color');
    for (const color of colors) {
      const swatch = button('', `${color[0].toUpperCase() + color.slice(1)} note`, async () => {
        picker.open = false;
        await request('PATCH', note.id, { color });
        const updated = [...list.children].find((card) => card.dataset.noteId === note.id);
        updated?.querySelector('summary')?.focus();
      });
      swatch.className = 'parking-swatch';
      swatch.dataset.color = color;
      swatch.setAttribute('aria-pressed', String(color === note.color));
      palette.append(swatch);
    }
    picker.append(toggle, palette);
    actions.append(archive, postedAt, picker);
    card.append(remove, question, actions);
    return card;
  }
  function disableControls(disabled) {
    form.querySelector('button').disabled = disabled;
    refresh.disabled = disabled;
    list.querySelectorAll('button').forEach((element) => { element.disabled = disabled; });
  }
  async function request(method = 'GET', id = '', body) {
    const writing = method !== 'GET';
    if (busy || (!writing && loading)) return;
    if (writing) {
      busy = true;
      revision += 1;
      disableControls(true);
    } else {
      loading = true;
    }
    const requestRevision = revision;
    try {
      endpoint ??= parkingLotEndpoint(location.href);
      const response = await fetch(`${endpoint}${id ? `/${encodeURIComponent(id)}` : ''}`, {
        method, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000),
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!writing && requestRevision !== revision) return;
      if (!response.ok) throw new Error(data.message ?? `Parking lot request failed (HTTP ${response.status}).`);
      if (!Array.isArray(data.notes) || data.notes.some((note) =>
        typeof note.id !== 'string' || typeof note.question !== 'string' || typeof note.archived !== 'boolean' ||
        !colors.includes(note.color) || typeof note.createdAt !== 'string' || !Number.isFinite(Date.parse(note.createdAt)))) {
        throw new Error('The parking lot server returned an invalid board.');
      }
      const changed = JSON.stringify(notes) !== JSON.stringify(data.notes);
      notes = data.notes;
      updateCount();
      if (method === 'POST') input.value = '';
      if (changed || !list.childNodes.length) render();
      message('Shared with everyone · refreshes every 3 seconds. Anyone can archive, recolor or delete notes. No sensitive information.');
    } catch (error) {
      if (!writing && requestRevision !== revision) return;
      const detail = error instanceof Error ? error.message : 'Unknown error.';
      if (!writing) {
        count.textContent = '?';
        count.setAttribute('aria-label', 'Question count unavailable');
        count.title = `Unable to sync the question count. ${detail}`;
      }
      message(`Unable to sync the parking lot. ${detail} Your question has not been cleared. Check the server and retry.`, true);
    } finally {
      if (writing) {
        busy = false;
        disableControls(false);
      } else {
        loading = false;
      }
    }
  }
  opener.addEventListener('click', () => {
    dialog.showModal();
    void request();
  });
  document.querySelector('#parking-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener.focus());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void request();
  });
  dialog.addEventListener('click', (event) => {
    list.querySelectorAll('.parking-color-picker[open]').forEach((picker) => {
      if (!picker.contains(event.target)) picker.open = false;
    });
  });
  dialog.addEventListener('keydown', (event) => {
    event.stopPropagation();
    const picker = list.querySelector('.parking-color-picker[open]');
    if (event.key === 'Escape' && picker) {
      event.preventDefault();
      picker.open = false;
      picker.querySelector('summary').focus();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) { input.setCustomValidity('Enter a question.'); input.reportValidity(); return; }
    void request('POST', '', { question: input.value.trim() });
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
  archived.addEventListener('change', render);
  refresh.addEventListener('click', () => void request());
  setInterval(() => { if (!document.hidden) void request(); }, 3000);
  if (!document.hidden) void request();
}
