
  // ── State ──
  let currentLang = 'en-IN';
  let currentFilters = {};
  let recognition = null;
  let isRecording = false;

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
  async function doSearch(queryOverride) {
    const query = queryOverride || document.getElementById('searchInput').value.trim();
    if (!query) return;

    setStatus('Searching...');

    try {
      const res = await fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, lang: currentLang })
      });
      const data = await res.json();
      currentFilters = data.filters || {};
      renderResults(data);
      setStatus('');
    } catch (e) {
      setStatus('Something went wrong. Is the server running?');
    }
  }

  // ── Render results ──
  function renderResults(data) {
    const section = document.getElementById('resultsSection');
    const grid = document.getElementById('productGrid');
    const header = document.getElementById('resultsHeader');
    const agentMsg = document.getElementById('agentMsg');
    const refine = document.getElementById('refineSection');
    const empty = document.getElementById('emptyState');
    const occasionWrap = document.getElementById('occasionWrap');

    section.style.display = 'block';
    occasionWrap.classList.remove('visible');
    grid.innerHTML = '';
    agentMsg.style.display = 'none';
    empty.style.display = 'none';
    refine.style.display = 'none';

    // Agent message (replan)
    if (data.message) {
      agentMsg.textContent = data.message;
      agentMsg.style.display = 'block';
    }

    const products = data.results || [];

    if (products.length === 0) {
      empty.style.display = 'block';
      header.textContent = 'No results found';
      return;
    }

    header.textContent = `${products.length} product${products.length > 1 ? 's' : ''} found`;

    products.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.style.animationDelay = `${i * 0.06}s`;

      const stars = '★'.repeat(Math.round(p.rating || 0)) + '☆'.repeat(5 - Math.round(p.rating || 0));

      card.innerHTML = `
        <div class="product-category">${p.category || ''}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-meta">
          <div class="meta-row">
            <span class="meta-label">Occasion</span>
            <span class="meta-value">${p.occasion || '—'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Fabric</span>
            <span class="meta-value">${p.fabric || '—'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Rating</span>
            <span class="rating-stars">${stars}</span>
          </div>
        </div>
        <div class="product-price">₹${p.price}</div>
      `;
      grid.appendChild(card);
    });

    if (products.length > 1) {
      refine.style.display = 'block';
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Refinement ──
  function showOccasions() {
    document.getElementById('occasionWrap').classList.toggle('visible');
  }

  function applyOccasion(occasion) {
    document.querySelectorAll('.occasion-chip').forEach(c => c.classList.remove('selected'));
    event.target.classList.add('selected');
    doSearch(`${document.getElementById('searchInput').value} ${occasion}`);
  }

  function refineBy(type) {
    if (type === 'budget') {
      const budget = prompt('Maximum budget (₹)?');
      if (budget && !isNaN(budget)) {
        const q = document.getElementById('searchInput').value;
        doSearch(`${q} under ${budget}`);
      }
    } else if (type === 'color') {
      const color = prompt('Which color?');
      if (color) {
        const q = document.getElementById('searchInput').value;
        doSearch(`${q} ${color}`);
      }
    }
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

    recognition.onerror = (e) => {
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

  // ── Initialize InkReveal on DOMContentLoaded ──
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('inkRevealCanvas');
    const hero = document.querySelector('.hero');

    if (canvas && hero) {
      const inkReveal = new InkReveal(canvas);

      // Listen to pointer events on the hero container
      const handlePointerMove = (e) => {
        const rect = hero.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        inkReveal.addPointerMove(x, y);
      };

      const handlePointerLeave = () => {
        inkReveal.resetPointer();
      };

      hero.addEventListener('pointermove', handlePointerMove);
      hero.addEventListener('pointerleave', handlePointerLeave);
      
      // Also reset on pointerup/pointercancel
      hero.addEventListener('pointerup', handlePointerLeave);
      hero.addEventListener('pointercancel', handlePointerLeave);
    }
  });
