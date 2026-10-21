// Shared reveal.js setup for the three workshop decks (offline, file:// friendly).
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Reveal.initialize({
    hash: true,
    width: 1280, height: 720, margin: 0.04,
    center: false,
    slideNumber: 'c/t',
    controlsLayout: 'edges',
    transition: reduced ? 'none' : 'slide',
    backgroundTransition: 'fade',
    autoAnimate: !reduced,
    autoAnimateEasing: 'cubic-bezier(.22,.61,.36,1)',
    autoAnimateDuration: 0.9,
    autoAnimateUnmatched: true,
    pdfSeparateFragments: false,
    plugins: [RevealNotes, RevealHighlight, RevealZoom]
  });

  // "← Page" returns to the chapter of the session page that matches the current slide (data-chapter).
  const page = document.body.dataset.page;
  if (!page) return;
  const back = document.createElement('a');
  back.className = 'back-to-page';
  back.innerHTML = '<span aria-hidden="true">←</span> Page';
  const update = () => {
    const chapter = Reveal.getCurrentSlide()?.dataset.chapter;
    back.href = new URL(page + (chapter ? `#${chapter}` : ''), location.href).href;
    back.title = chapter ? 'Open this chapter on the session page' : 'Open the session page';
  };
  document.body.append(back);
  Reveal.on('ready', update);
  Reveal.on('slidechanged', update);
  update();
})();
