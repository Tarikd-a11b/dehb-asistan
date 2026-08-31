// ════════════════════════════════════════
// DEHB Bilgi Merkezi — İnteraktif Story Modu Logic
// ════════════════════════════════════════

const STORY_DATA = [
  { emoji: '🗺️', title: 'Büyük DEHB Haritası', subtitle: '1 / 6 • Nörogelişimsel Genel Bakış' },
  { emoji: '🧠', title: 'DEHB Nedir & Dopamin', subtitle: '2 / 6 • Beyin Kimyası & Yaygınlık' },
  { emoji: '⚡', title: '7 Temel Belirti', subtitle: '3 / 6 • Zaman Körlüğü & DMN Takılması' },
  { emoji: '🎯', title: '3 Klinik DEHB Tipi', subtitle: '4 / 6 • Hiperaktif, Dikkatsiz, Kombine' },
  { emoji: '🌙', title: 'Yaşam & Taktikler', subtitle: '5 / 6 • Dışsal İskelet Stratejileri' },
  { emoji: '🔗', title: 'Bilimsel Kaynaklar', subtitle: '6 / 6 • Destek & Güvenilir Kuruluşlar' }
];

let _currentStoryIndex = 0;

/**
 * Belirtilen story adımını gösterir.
 */
function showStory(index) {
  if (index < 0) index = 0;
  if (index >= STORY_DATA.length) index = STORY_DATA.length - 1;
  _currentStoryIndex = index;

  const data = STORY_DATA[index];

  // 1. Header meta güncelle
  const emojiEl = document.getElementById('story-header-emoji');
  const titleEl = document.getElementById('story-header-title');
  const subEl = document.getElementById('story-header-subtitle');
  if (emojiEl) emojiEl.textContent = data.emoji;
  if (titleEl) titleEl.textContent = data.title;
  if (subEl) subEl.textContent = data.subtitle;

  // 2. Story Progress Bar Segmentlerini güncelle
  document.querySelectorAll('.story-progress-segment').forEach((seg, i) => {
    seg.classList.remove('active', 'completed');
    if (i < index) {
      seg.classList.add('completed');
    } else if (i === index) {
      seg.classList.add('active');
    }
  });

  // 3. Kart görünürlüklerini ayarla
  STORY_DATA.forEach((_, i) => {
    const card = document.getElementById(`story-card-${i}`);
    if (card) {
      if (i === index) {
        card.classList.remove('hidden');
        card.classList.remove('animate-slide-in');
        void card.offsetWidth;
        card.classList.add('animate-slide-in');
      } else {
        card.classList.add('hidden');
      }
    }
  });

  // 4. Alt Hızlı Atlama Hap Butonlarını senkronize et
  document.querySelectorAll('.story-pill-btn').forEach((btn, i) => {
    btn.classList.toggle('active-story', i === index);
  });

  // 5. Önceki / Sonraki butonları
  const prevBtn = document.getElementById('story-prev-btn');
  const nextBtn = document.getElementById('story-next-btn');
  if (prevBtn) prevBtn.disabled = (index === 0);
  if (nextBtn) {
    if (index === STORY_DATA.length - 1) {
      nextBtn.innerHTML = 'Başa Dön <span>↺</span>';
      nextBtn.classList.remove('from-indigo-600', 'to-indigo-700');
      nextBtn.classList.add('from-emerald-600', 'to-emerald-700');
    } else {
      nextBtn.innerHTML = 'Sonraki Adım <span>▶</span>';
      nextBtn.classList.remove('from-emerald-600', 'to-emerald-700');
      nextBtn.classList.add('from-indigo-600', 'to-indigo-700');
    }
  }

  // 6. localStorage
  try {
    localStorage.setItem('focusaid_active_story', index.toString());
  } catch (e) {}

  // 7. En tepeye odaklan
  const root = document.getElementById('dehb-story-root');
  if (root && window.scrollY > 150) {
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function nextStory() {
  if (_currentStoryIndex < STORY_DATA.length - 1) {
    showStory(_currentStoryIndex + 1);
  } else {
    // Son adımda tekrar başa dön
    if (typeof showToast === 'function') {
      showToast('🎉 Tüm DEHB hikayelerini tamamladınız!', 'success');
    }
    showStory(0);
  }
}

function prevStory() {
  if (_currentStoryIndex > 0) {
    showStory(_currentStoryIndex - 1);
  }
}

function restoreDehbSection() {
  let saved = 0;
  try {
    saved = parseInt(localStorage.getItem('focusaid_active_story') || '0', 10);
  } catch (e) {}
  showStory(saved);
}

// Geriye dönük uyumluluk
function showDehbSection(name) {
  const map = { harita: 0, nedir: 1, belirtiler: 2, tipler: 3, yasam: 4, stratejiler: 4, kaynaklar: 5 };
  showStory(map[name] !== undefined ? map[name] : 0);
}

// Klavye ok tuşları ve Space ile story geçişi
function _handleStoryKeydown(e) {
  const root = document.getElementById('dehb-story-root');
  if (!root) return;
  if (document.getElementById('dehb-lightbox')?.classList.contains('hidden') === false) return;

  if (e.key === 'ArrowRight' || e.key === 'PageDown') {
    nextStory();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    prevStory();
  }
}
document.removeEventListener('keydown', _handleStoryKeydown);
document.addEventListener('keydown', _handleStoryKeydown);

// Görsel Büyüteç (Lightbox)
function dehbGorselAc(src) {
  document.getElementById('dehb-lightbox')?.remove();
  const kutu = document.createElement('div');
  kutu.id = 'dehb-lightbox';
  kutu.className = 'dehb-lightbox';
  kutu.innerHTML = `<img src="${src}" alt="Büyütülmüş infografik">`;

  const kapat = () => { kutu.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') kapat(); };

  kutu.addEventListener('click', e => {
    if (e.target.tagName === 'IMG' && !kutu.classList.contains('zoomlu')) {
      kutu.classList.add('zoomlu');
      return;
    }
    kapat();
  });
  document.addEventListener('keydown', esc);
  document.body.appendChild(kutu);
}

// loadPage hook
if (typeof origLoadPage === 'undefined' && typeof loadPage === 'function') {
  const origLoadPage = window.loadPage;
  window.loadPage = function (pageName) {
    const sonuc = origLoadPage.call(this, pageName);
    if (pageName === 'dehb-info') setTimeout(restoreDehbSection, 50);
    return sonuc;
  };
}
