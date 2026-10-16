const menu = document.querySelector('.menu');
const navigation = document.querySelector('.nav-links');
const mobile = matchMedia('(max-width: 760px)');

function closeMenu(returnFocus = false) {
  navigation.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  if (returnFocus) menu.focus();
}

menu.addEventListener('click', () => {
  const open = navigation.classList.toggle('is-open');
  menu.setAttribute('aria-expanded', String(open));
});
navigation.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a');
  if (!link) return;
  closeMenu();
  if (mobile.matches) {
    const target = document.querySelector(link.hash);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navigation.classList.contains('is-open')) closeMenu(true);
});
mobile.addEventListener('change', () => {
  const focusWillBeHidden = mobile.matches
    ? navigation.contains(document.activeElement)
    : document.activeElement === menu;
  closeMenu();
  if (focusWillBeHidden) (mobile.matches ? menu : navigation.querySelector('a')).focus();
});

document.querySelectorAll('[data-journey]').forEach((journey) => {
  const controls = journey.querySelector('.steps');
  const buttons = [...controls.querySelectorAll('button')];
  const panels = buttons.map((button) => document.getElementById(button.getAttribute('aria-controls')));
  function select(index) {
    buttons.forEach((button, position) => {
      button.setAttribute('aria-pressed', String(position === index));
      panels[position].hidden = position !== index;
    });
  }
  buttons.forEach((button, index) => button.addEventListener('click', () => select(index)));
  select(0);
  controls.hidden = false;
});

const feedback = document.getElementById('quiz-feedback');
const answers = [...document.querySelectorAll('[data-answer]')];
answers.forEach((button) => {
  button.addEventListener('click', () => {
    answers.forEach((answer) => answer.setAttribute('aria-pressed', String(answer === button)));
    feedback.textContent = button.dataset.answer === 'no'
      ? 'Exact. Masquer l’outil ne concerne que ce client. Le serveur doit vérifier les droits, même pour un appel provenant d’un autre client.'
      : 'Pas tout à fait. Ce réglage ne protège pas le serveur contre un autre client. La confirmation locale et l’autorisation côté serveur ont des rôles différents.';
    feedback.hidden = false;
  });
});
document.querySelector('.quiz [role="group"]').hidden = false;

document.querySelectorAll('[data-copy]').forEach((button) => {
  const copyStatus = document.createElement('p');
  copyStatus.className = 'caption';
  copyStatus.setAttribute('role', 'status');
  button.closest('.actions').after(copyStatus);
  button.addEventListener('click', async () => {
    const source = document.getElementById(button.dataset.copy);
    if (!navigator.clipboard?.writeText) {
      copyStatus.textContent = 'Copie indisponible dans ce navigateur ou ce contexte. Sélectionnez le texte du prompt et copiez-le manuellement.';
      return;
    }
    try {
      await navigator.clipboard.writeText(source.textContent.trim());
      copyStatus.textContent = 'Prompt copié dans le presse-papiers.';
    } catch (error) {
      console.error('Impossible de copier le prompt.', error);
      copyStatus.textContent = 'La copie a été refusée. Sélectionnez le texte du prompt et copiez-le manuellement.';
    }
  });
  button.hidden = false;
});
const printButton = document.getElementById('print-button');
printButton.addEventListener('click', () => window.print());
printButton.hidden = false;

const motion = matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !motion.matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.remove('is-pending');
      target.classList.add('is-visible');
      observer.unobserve(target);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach((element) => {
    const group = element.closest('.grid');
    if (group) element.style.setProperty('--i', [...group.children].indexOf(element));
    observer.observe(element);
    element.classList.add('is-pending');
  });
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    observer.disconnect();
    document.querySelectorAll('.is-pending').forEach((element) => element.classList.remove('is-pending'));
  });
}

if ('IntersectionObserver' in window) {
  const links = [...navigation.querySelectorAll('a')];
  const activeObserver = new IntersectionObserver((entries) => {
    const active = entries.find((entry) => entry.isIntersecting);
    if (!active) return;
    links.forEach((link) => {
      if (link.hash === `#${active.target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-10% 0px -65% 0px', threshold: 0 });
  links.forEach((link) => activeObserver.observe(document.querySelector(link.hash)));
}

menu.hidden = false;
document.documentElement.classList.add('enhanced');
