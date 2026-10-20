import { defaultEndpoint, validateEndpoint } from './presentation-lab.mjs?v=parking-lot-2';

export function parkingLotEndpoint(pageUrl) {
  const url = new URL(pageUrl);
  const endpoint = validateEndpoint(url.searchParams.get('endpoint') ?? defaultEndpoint).endpoint;
  return new URL('/parking-lot', endpoint).href;
}

export function initializeParkingLot() {
  const dialog = document.querySelector('#parking-lot');
  const opener = document.querySelector('#parking-open');
  const form = document.querySelector('#parking-form');
  const input = document.querySelector('#parking-question');
  const list = document.querySelector('#parking-notes');
  const status = document.querySelector('#parking-status');
  const archived = document.querySelector('#parking-archived');
  const refresh = document.querySelector('#parking-refresh');
  let endpoint;
  let notes = [];
  let busy = false;
  let timer;
  const colors = ['yellow', 'pink', 'blue', 'green', 'purple'];
  const message = (text, error = false) => {
    status.textContent = text;
    status.dataset.error = String(error);
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
  function render() {
    list.replaceChildren();
    const visible = notes.filter((note) => note.archived === archived.checked);
    document.querySelector('#parking-count').textContent = String(notes.filter((note) => !note.archived).length);
    for (const note of visible) {
      const card = document.createElement('article');
      card.className = 'parking-note';
      card.dataset.color = note.color;
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
      actions.append(archive, picker);
      card.append(remove, question, actions);
      list.append(card);
    }
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.textContent = archived.checked ? 'No archived questions.' : 'No questions yet. Leave the first sticky note!';
      list.append(empty);
    }
  }
  async function request(method = 'GET', id = '', body) {
    if (busy) return;
    busy = true;
    form.querySelector('button').disabled = true;
    refresh.disabled = true;
    list.querySelectorAll('button').forEach((element) => { element.disabled = true; });
    try {
      endpoint ??= parkingLotEndpoint(location.href);
      const response = await fetch(`${endpoint}${id ? `/${encodeURIComponent(id)}` : ''}`, {
        method, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000),
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? `Parking lot request failed (HTTP ${response.status}).`);
      if (!Array.isArray(data.notes) || data.notes.some((note) =>
        typeof note.id !== 'string' || typeof note.question !== 'string' || typeof note.archived !== 'boolean' || !colors.includes(note.color))) {
        throw new Error('The parking lot server returned an invalid board.');
      }
      const changed = JSON.stringify(notes) !== JSON.stringify(data.notes);
      notes = data.notes;
      if (method === 'POST') input.value = '';
      if (changed || !list.childNodes.length) render();
      message('Shared with everyone · refreshes every 3 seconds. Anyone can archive, recolor or delete notes. No sensitive information.');
    } catch (error) {
      if (method !== 'GET') render();
      message(`Unable to sync the parking lot. ${error instanceof Error ? error.message : 'Unknown error.'} Your question has not been cleared. Check the server and retry.`, true);
    } finally {
      busy = false;
      form.querySelector('button').disabled = false;
      refresh.disabled = false;
      list.querySelectorAll('button').forEach((element) => { element.disabled = false; });
    }
  }
  opener.addEventListener('click', () => {
    dialog.showModal();
    void request();
    timer = setInterval(() => { if (!document.hidden) void request(); }, 3000);
  });
  document.querySelector('#parking-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { clearInterval(timer); opener.focus(); });
  document.addEventListener('visibilitychange', () => {
    if (dialog.open && !document.hidden) void request();
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
}
