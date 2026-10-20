export function initializeAgenda(root = document) {
  for (const item of root.querySelectorAll('.agenda li[data-nested]')) {
    const row = item.querySelector('.agenda-row');
    const chapters = item.querySelector('.agenda-sub');
    chapters.id ||= `agenda-${item.dataset.key}-chapters`;
    const button = root.createElement('button');
    button.type = 'button';
    button.className = 'agenda-toggle';
    button.setAttribute('aria-controls', chapters.id);
    const label = root.createElement('span');
    label.textContent = item.dataset.key.replace('session-', 'Session ');
    button.append(label);
    function setExpanded(expanded) {
      chapters.hidden = !expanded;
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} chapters for ${item.dataset.short}`);
      button.title = button.getAttribute('aria-label');
    }
    button.addEventListener('click', () => setExpanded(chapters.hidden));
    row.addEventListener('click', () => setExpanded(true));
    row.after(button);
    setExpanded(!chapters.hidden);
  }
}
