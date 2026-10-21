// "Slides" button in the top bar: opens the presenter deck of the current module, at the slide of the current chapter.
(() => {
  const link = document.getElementById('slides-open');
  if (!link) return;
  const routes = {
    why: ['session-1', 'why'], connector: ['session-1', 'connector'], anatomy: ['session-1', 'anatomy'],
    mcp: ['session-1', 'mcp'], history: ['session-1', 'history'], api: ['session-1', 'api'], lab: ['session-1', 'lab'],
    rights: ['session-3', 'rights'], 'mcp-threats': ['session-3', 'mcp-threats'], 'agent-identities': ['session-3', 'agent-identities'],
    decisions: ['session-2', 'decisions'], hosting: ['session-2', 'hosting'], 'front-door': ['session-2', 'front-door'],
    token: ['session-2', 'token'], patterns: ['session-2', 'patterns'], discover: ['session-2', 'discover'], demo: ['session-2', 'demo'],
    'day-session-2': ['session-2', ''],
  };
  const base = new URL(link.dataset.base, document.baseURI);
  const update = () => {
    const [deck, slide] = routes[location.hash.slice(1)] ?? [link.dataset.deck, ''];
    link.href = new URL(`${deck}.html${slide ? `#/${slide}` : ''}`, base).href;
  };
  update();
  addEventListener('hashchange', update);
  // Chapter changes may use history.replaceState: refresh just before the link is used.
  for (const type of ['pointerenter', 'focus', 'click']) link.addEventListener(type, update);
})();
