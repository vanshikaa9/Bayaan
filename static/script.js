
// ── State ──
let currentLang = 'en-IN';
let currentFilters = {};
let currentQuery = '';
let lastProducts = [];
let recognition = null;
let isRecording = false;
let resultsVisible = false;
let isRefining = false;

const SKELETON_HEIGHTS = ['tall', 'medium', 'short', 'tall', 'medium', 'short', 'tall', 'medium', 'short', 'medium', 'tall', 'short'];

// ── Language selection ──
function selectLang(btn) {
  document.querySelectorAll('.lang-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  currentLang = btn.dataset.lang;
  const placeholders = {
    'en-IN': 'What are you looking for?',
    'hi-IN': 'क्या ढूंढना है?',
    'ta-IN': 'நீங்கள் என்ன தேடுகிறீர்கள்?',
    'bn-IN': 'আপনি কী খুঁজছেন?'
  };
  document.getElementById('searchInput').placeholder = placeholders[currentLang] || 'Search...';
}

// ── Search ──
async function doSearch(queryOverride, options = {}) {
  const query = (queryOverride || document.getElementById('searchInput').value).trim();
  if (!query) return;

  const refining = options.refine === true;
  isRefining = refining;
  currentQuery = query;
  document.getElementById('searchInput').value = query;

  setStatus(refining ? 'Refining...' : 'Searching...');

  const usePageTurn = !refining
    && typeof gsap !== 'undefined'
    && typeof runPageTurnTransition === 'function'
    && !prefersReducedMotion();

  if (refining) {
    showLoadingState(true);
  } else if (!usePageTurn) {
    showLoadingState(false);
  }

  try {
    const fetchPromise = fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, lang: currentLang })
    }).then(res => res.json());

    if (usePageTurn) {
      await runPageTurnTransition(
        async () => {
          const data = await fetchPromise;
          currentFilters = data.filters || {};
          buildResultsDOM(data);
        },
        () => animateEditorialStagger()
      );
      resultsVisible = true;
    } else {
      const data = await fetchPromise;
      currentFilters = data.filters || {};
      renderResults(data, { refine: refining });
      if (!refining && !resultsVisible) {
        fadeHeroForResults();
        resultsVisible = true;
      }
    }

    setStatus('');
  } catch (e) {
    hideLoadingState();
    document.body.classList.remove('page-turn-active');
    setStatus('Something went wrong. Is the server running?');
  } finally {
    isRefining = false;
  }
}

function showLoadingState(refining) {
  const section = document.getElementById('resultsSection');
  const loading = document.getElementById('resultsLoading');
  const content = document.getElementById('resultsContent');
  const empty = document.getElementById('emptyState');
  const feed = document.getElementById('masonryFeed');

  section.style.display = 'block';

  if (refining && content.style.display !== 'none') {
    feed?.classList.add('feed-loading');
    return;
  }

  content.style.display = 'none';
  empty.style.display = 'none';
  loading.style.display = 'block';
  feed?.classList.remove('feed-loading');

  buildMasonrySkeleton();

  if (!resultsVisible) {
    fadeHeroForResults();
    resultsVisible = true;
  }
}

function hideLoadingState() {
  document.getElementById('resultsLoading').style.display = 'none';
  document.getElementById('masonryFeed')?.classList.remove('feed-loading');
}

function buildMasonrySkeleton() {
  const container = document.getElementById('masonrySkeleton');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const sk = document.createElement('div');
    sk.className = `masonry-skeleton-card shimmer ${SKELETON_HEIGHTS[i]}`;
    container.appendChild(sk);
  }
}

function fadeHeroForResults() {
  const hero = document.getElementById('heroSection');
  hero.classList.add('hero--results-visible');

  if (typeof gsap !== 'undefined') {
    gsap.to(hero, {
      opacity: 0.55,
      scale: 0.98,
      duration: 0.55,
      ease: 'power2.out',
      transformOrigin: 'center top'
    });
  }
}

// ── Build / render results ──
function buildResultsDOM(data) {
  const section = document.getElementById('resultsSection');
  const content = document.getElementById('resultsContent');
  const feed = document.getElementById('masonryFeed');
  const insightEl = document.getElementById('fashionInsight');
  const agentMsg = document.getElementById('agentMsg');
  const refine = document.getElementById('refineSection');
  const empty = document.getElementById('emptyState');
  const countEl = document.getElementById('resultsCount');
  const queryEl = document.getElementById('resultsQuery');

  hideLoadingState();
  section.style.display = 'block';
  feed.innerHTML = '';
  agentMsg.style.display = 'none';

  const products = data.results || [];
  lastProducts = products;

  if (products.length === 0) {
    content.style.display = 'none';
    empty.style.display = 'block';
    refine.style.display = 'none';
    if (typeof gsap !== 'undefined') {
      gsap.set(empty, { opacity: 0, y: 30 });
    }
    return;
  }

  content.style.display = 'block';
  empty.style.display = 'none';
  refine.style.display = 'block';

  countEl.textContent = products.length === 1
    ? '1 curated result'
    : `${products.length} curated results`;
  queryEl.textContent = currentQuery;

  const insight = buildFashionInsight(products);
  if (insight) {
    insightEl.textContent = insight;
    insightEl.style.display = 'block';
  } else {
    insightEl.textContent = '';
    insightEl.style.display = 'none';
  }

  if (data.message) {
    agentMsg.textContent = data.message;
    agentMsg.style.display = 'block';
  }

  products.forEach((p, i) => feed.appendChild(createPinCard(p, i)));
  prepareStaggerHidden();
}

function prepareStaggerHidden() {
  if (typeof gsap === 'undefined') return;

  const header = document.getElementById('resultsHeaderBar');
  const insight = document.getElementById('fashionInsight');
  const agent = document.getElementById('agentMsg');
  const refine = document.getElementById('refineSection');
  const cards = document.querySelectorAll('.pin-card');

  const targets = [header, insight, agent, refine, ...cards].filter(
    el => el && el.style.display !== 'none'
  );
  gsap.set(targets, { opacity: 0, y: 22 });
}

function renderResults(data, options = {}) {
  buildResultsDOM(data);

  if (options.refine) return;

  if (!options.skipScroll) {
    scrollToResults();
  }

  requestAnimationFrame(() => animateFeedReveal());
}

function animateEditorialStagger() {
  if (typeof gsap === 'undefined' || prefersReducedMotion()) return;

  const empty = document.getElementById('emptyState');
  if (empty && empty.style.display !== 'none') {
    gsap.to(empty, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
    return;
  }

  const header = document.getElementById('resultsHeaderBar');
  const insight = document.getElementById('fashionInsight');
  const agent = document.getElementById('agentMsg');
  const refine = document.getElementById('refineSection');
  const cards = [...document.querySelectorAll('.pin-card')];
  const featured = cards.slice(0, 3);
  const rest = cards.slice(3);

  const targets = [header, insight, agent, refine, ...cards].filter(
    el => el && el.style.display !== 'none'
  );
  if (!targets.length) return;

  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

  if (header) tl.to(header, { opacity: 1, y: 0, duration: 0.32 }, 0);
  if (insight && insight.style.display !== 'none') {
    tl.to(insight, { opacity: 1, y: 0, duration: 0.3 }, 0.07);
  }
  if (agent && agent.style.display !== 'none') {
    tl.to(agent, { opacity: 1, y: 0, duration: 0.28 }, 0.12);
  }
  if (refine && refine.style.display !== 'none') {
    tl.to(refine, { opacity: 1, y: 0, duration: 0.28 }, 0.14);
  }
  if (featured.length) {
    tl.to(featured, { opacity: 1, y: 0, duration: 0.3, stagger: 0.07 }, 0.2);
  }
  if (rest.length) {
    tl.to(rest, { opacity: 1, y: 0, duration: 0.28, stagger: 0.07 }, 0.38);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function createPinCard(product, index) {
  const card = document.createElement('article');
  card.className = `pin-card aspect-${getAspectClass(index)}`;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `View ${product.name}`);
  card.dataset.productId = product.id;

  const img = getProductImage(product);
  const eager = index < 6;

  card.innerHTML = `
    <div class="pin-card__media">
      <img
        src="${img}"
        alt="${escapeHtml(product.name)}"
        loading="${eager ? 'eager' : 'lazy'}"
        decoding="async"
        ${eager ? 'fetchpriority="high"' : ''}
      />
    </div>
    <div class="pin-card__info">
      <h3 class="pin-card__name">${escapeHtml(product.name)}</h3>
      <p class="pin-card__price">₹${product.price}</p>
      <p class="pin-card__meta">${escapeHtml(product.fabric || '—')} · ${escapeHtml(product.occasion || '—')}</p>
    </div>
  `;

  card.addEventListener('click', () => openProductModal(product.id));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openProductModal(product.id);
    }
  });

  return card;
}

function animateFeedReveal() {
  if (typeof gsap === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cards = document.querySelectorAll('.pin-card');
  if (cards.length) {
    gsap.from(cards, {
      y: 16,
      opacity: 0,
      duration: 0.3,
      stagger: 0.02,
      ease: 'power2.out'
    });
  }
}

function scrollToResults() {
  const header = document.getElementById('resultsHeaderBar');

  if (typeof gsap !== 'undefined' && gsap.plugins?.scrollTo && header) {
    gsap.to(window, {
      scrollTo: { y: header, offsetY: 0 },
      duration: 0.65,
      ease: 'power2.inOut'
    });
  } else {
    header?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Refinement ──
function refineWithQuery(newQuery, chipGroup, activeBtn) {
  if (chipGroup) {
    document.querySelectorAll(chipGroup).forEach(c => c.classList.remove('selected'));
    if (activeBtn) activeBtn.classList.add('selected');
  }
  doSearch(newQuery, { refine: true });
}

function initRefinementHandlers() {
  document.querySelectorAll('.occasion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const occasion = btn.dataset.occasion;
      const q = insertOccasionInQuery(currentQuery, occasion);
      refineWithQuery(q, '.occasion-chip', btn);
    });
  });

  document.querySelectorAll('.budget-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = btn.dataset.budget;
      const q = appendBudgetToQuery(currentQuery, amount);
      refineWithQuery(q, '.budget-chip', btn);
    });
  });

  document.querySelectorAll('.color-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      const q = appendColorToQuery(currentQuery, color);
      refineWithQuery(q, '.color-chip', btn);
    });
  });
}

// ── Product modal ──
function openProductModal(productId) {
  const product = lastProducts.find(p => p.id === Number(productId));
  if (!product) return;

  const modal = document.getElementById('productModal');
  const img = getProductImage(product);
  const stars = product.rating
    ? '★'.repeat(Math.round(product.rating)) + '☆'.repeat(5 - Math.round(product.rating))
    : '—';

  document.getElementById('modalProductImage').src = img;
  document.getElementById('modalProductImage').alt = product.name;
  document.getElementById('modalProductCategory').textContent = product.category || '';
  document.getElementById('modalProductName').textContent = product.name;
  document.getElementById('modalProductPrice').textContent = `₹${product.price}`;
  document.getElementById('modalProductFabric').textContent = product.fabric || '—';
  document.getElementById('modalProductOccasion').textContent = product.occasion || '—';
  document.getElementById('modalProductRating').textContent = stars;
  document.getElementById('modalProductReason').textContent = getRecommendationReason(product);

  const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  document.getElementById('modalProductLink').href = `/product/${product.id}/${slug}`;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function initProductModal() {
  document.getElementById('productModalClose')?.addEventListener('click', closeProductModal);
  document.getElementById('productModalBackdrop')?.addEventListener('click', closeProductModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProductModal();
  });
}

// ── Voice ──
function toggleVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    setStatus('Voice not supported in this browser. Use Chrome.');
    return;
  }

  if (isRecording) {
    stopVoice();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = currentLang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('micBtn').classList.add('recording');
    document.getElementById('micLabel').textContent = 'Listening...';
    setStatus('');
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('searchInput').value = transcript;
    setStatus(`Heard: "${transcript}"`);
    doSearch(transcript);
  };

  recognition.onerror = () => {
    setStatus('Could not hear clearly. Try again.');
  };

  recognition.onend = () => {
    isRecording = false;
    document.getElementById('micBtn').classList.remove('recording');
    document.getElementById('micLabel').textContent = 'Tap to speak';
  };

  recognition.start();
}

function stopVoice() {
  if (recognition) recognition.stop();
}

function setStatus(msg) {
  document.getElementById('statusMsg').textContent = msg;
}

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('inkRevealCanvas');
  const hero = document.querySelector('.hero');

  if (canvas && hero) {
    const inkReveal = new InkReveal(canvas);

    const handlePointerMove = (e) => {
      const rect = hero.getBoundingClientRect();
      inkReveal.addPointerMove(e.clientX - rect.left, e.clientY - rect.top);
    };

    const handlePointerLeave = () => inkReveal.resetPointer();

    hero.addEventListener('pointermove', handlePointerMove);
    hero.addEventListener('pointerleave', handlePointerLeave);
    hero.addEventListener('pointerup', handlePointerLeave);
    hero.addEventListener('pointercancel', handlePointerLeave);
  }

  if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(ScrollToPlugin);
    if (typeof CustomEase !== 'undefined') gsap.registerPlugin(CustomEase);
  }

  initRefinementHandlers();
  initProductModal();
});
