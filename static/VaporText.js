/**
 * VaporText.js
 * Typography-First Organic Ink Diffusion Effect for Bayaan.
 * Animates an SVG displacement and fractal noise filter to stochastically 
 * reveal the text in splotchy, organic patches that mimic ink diffusion.
 */

(function () {
  'use strict';

  const init = () => {
    if (init.done) return;
    init.done = true;
    startInkDiffusionEffect();
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    document.fonts.ready.then(init);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.fonts.ready.then(init);
    });
  }

  function startInkDiffusionEffect() {
    const logoText = document.getElementById('logoText');
    const dispMap = document.getElementById('diffusion-displacement');
    const funcA = document.getElementById('diffusion-alpha');
    const finalBlur = document.getElementById('diffusion-blur');

    if (!logoText || !dispMap || !funcA || !finalBlur) {
      // Fallback: If elements are missing, ensure logo is fully visible
      if (logoText) {
        logoText.style.filter = 'none';
      }
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      logoText.style.filter = 'none';
      return;
    }

    const duration = 2200; // 2.2 seconds duration
    let startTime = null;
    let animFrameId = null;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Easing: cubic-out for displacement/blur cleanup
      const t = 1 - Math.pow(1 - progress, 3);

      // Linear progress for threshold reveal ensures steady, splotchy ink diffusion
      const intercept = -15 + 16.6 * progress;
      funcA.setAttribute('intercept', intercept);

      // Liquid Edges: Animate displacement scale from 35 down to 0
      const scale = 35 * (1 - t);
      dispMap.setAttribute('scale', scale);

      // Bleed Blur: Animate secondary blur from 6px down to 0px
      const blur = 6 * (1 - t);
      finalBlur.setAttribute('stdDeviation', blur);

      if (progress < 1) {
        animFrameId = requestAnimationFrame(tick);
      } else {
        cleanup();
      }
    }

    function cleanup() {
      // Completely remove the filter from style to ensure standard selectable text rendering
      logoText.style.filter = 'none';
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
    }

    animFrameId = requestAnimationFrame(tick);
  }
})();
