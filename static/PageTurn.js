
/**
 * Editorial page-turn transition — hero to results.
 */
const EDITORIAL_EASE = (typeof CustomEase !== 'undefined')
  ? CustomEase.create('editorial', 'M0,0 C0.24,0 0.76,1 1,1')
  : 'power2.inOut';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function runPageTurnTransition(onCovered, onReveal) {
  if (typeof gsap === 'undefined' || prefersReducedMotion()) {
    return onCovered().then(() => {
      onReveal?.();
    });
  }

  const hero = document.getElementById('heroSection');
  const sheet = document.getElementById('pageTurnSheet');
  const wrap = document.getElementById('pageTurn');
  const resultsSection = document.getElementById('resultsSection');

  resultsSection.style.display = 'block';
  document.body.classList.add('page-turn-active');

  hero.classList.add('hero--results-visible', 'hero--frozen');
  gsap.set(sheet, { yPercent: 100, visibility: 'visible' });
  gsap.set(wrap, { visibility: 'visible' });

  let coveredResolve;
  const coveredPromise = new Promise((r) => { coveredResolve = r; });

  const tl = gsap.timeline({
    defaults: { ease: EDITORIAL_EASE },
    onComplete: () => {
      gsap.set(sheet, { visibility: 'hidden', yPercent: 100 });
      gsap.set(wrap, { visibility: 'hidden' });
      document.body.classList.remove('page-turn-active');
      hero.classList.remove('hero--frozen');
    }
  });

  tl.to(hero, {
    opacity: 0.75,
    scale: 0.98,
    duration: 0.25,
    ease: 'power2.out',
    transformOrigin: 'center top'
  }, 0);

  tl.to(sheet, { yPercent: 0, duration: 0.42, ease: EDITORIAL_EASE }, 0.1);

  tl.call(() => {
    window.scrollTo(0, resultsSection.offsetTop);
    onCovered().then(() => coveredResolve());
  }, null, 0.48);

  tl.add(coveredPromise, 0.48);
  tl.to(sheet, { yPercent: -100, duration: 0.38, ease: EDITORIAL_EASE }, 0.55);
  tl.call(() => onReveal?.(), null, 0.68);

  return tl;
}

window.runPageTurnTransition = runPageTurnTransition;
window.prefersReducedMotion = prefersReducedMotion;
