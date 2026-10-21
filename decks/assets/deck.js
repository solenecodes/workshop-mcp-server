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
})();
