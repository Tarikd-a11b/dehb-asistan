// ════════════════════════════════════════
// DEHB Bilgilendirme Platformu — İnteraktif Slayt / Carousel Deneyimi
// ════════════════════════════════════════

const DEHB_SLIDES = ['nedir', 'belirtiler', 'stratejiler', 'yasam', 'kaynaklar'];
let _currentDehbSlideIndex = 0;

/**
 * Belirtilen slayda gider (index veya isim ile).
 */
function showDehbSlide(target) {
  let index = typeof target === 'number' ? target : DEHB_SLIDES.indexOf(target);
  if (index < 0 || index >= DEHB_SLIDES.length) index = 0;

  _currentDehbSlideIndex = index;
  const bolumAdi = DEHB_SLIDES[index];

  // Tüm slaytları gizle, aktif olanı göster
  DEHB_SLIDES.forEach((id, i) => {
    const el = document.getElementById(`dehb-slide-${id}`);
    if (el) {
      if (i === index) {
        el.classList.remove('hidden');
        el.classList.remove('animate-slide-in');
        void el.offsetWidth;
        el.classList.add('animate-slide-in');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Navigasyon butonlarını ve sekmeleri güncelle
  document.querySelectorAll('.dehb-tab-btn').forEach(btn => {
    const isActive = btn.dataset.slide === bolumAdi;
    btn.classList.toggle('active-slide-tab', isActive);
    btn.classList.toggle('bg-indigo-600', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('shadow-md', isActive);
  });

  // Dot göstergelerini güncelle
  document.querySelectorAll('.dehb-dot-indicator').forEach((dot, idx) => {
    const isActive = idx === index;
    dot.classList.toggle('bg-indigo-600', isActive);
    dot.classList.toggle('w-8', isActive);
    dot.classList.toggle('bg-slate-300', !isActive);
    dot.classList.toggle('dark:bg-slate-600', !isActive);
    dot.classList.toggle('w-2.5', !isActive);
  });

  // İlerleme çubuğunu güncelle
  const bar = document.getElementById('dehb-progress-bar');
  const text = document.getElementById('dehb-slide-text');
  const pct = Math.round(((index + 1) / DEHB_SLIDES.length) * 100);
  if (bar) bar.style.width = `${pct}%`;
  if (text) text.textContent = `Slayt ${index + 1} / ${DEHB_SLIDES.length}`;

  // Önceki / Sonraki butonları
  const prevBtn = document.getElementById('dehb-prev-btn');
  const nextBtn = document.getElementById('dehb-next-btn');
  if (prevBtn) prevBtn.disabled = (index === 0);
  if (nextBtn) {
    nextBtn.innerHTML = (index === DEHB_SLIDES.length - 1)
      ? '<span>🎉</span> Başa Dön'
      : 'Sonraki <span>▶</span>';
  }

  // Sayfanın en üstüne yumuşakça kaydır
  const root = document.getElementById('dehb-slider-root');
  if (root) root.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try { localStorage.setItem('dehb_active_slide', bolumAdi); } catch (e) {}
}

function nextDehbSlide() {
  if (_currentDehbSlideIndex >= DEHB_SLIDES.length - 1) {
    showDehbSlide(0);
  } else {
    showDehbSlide(_currentDehbSlideIndex + 1);
  }
}

function prevDehbSlide() {
  if (_currentDehbSlideIndex > 0) {
    showDehbSlide(_currentDehbSlideIndex - 1);
  }
}

// Geriye dönük uyumluluk için showDehbSection
function showDehbSection(bolum) {
  showDehbSlide(bolum);
}

/**
 * Klavye ok tuşları ile slayt kontrolü
 */
function _handleDehbKeydown(e) {
  const root = document.getElementById('dehb-slider-root');
  if (!root) return; // dehb sayfasında değiliz
  if (e.key === 'ArrowRight' || e.key === 'PageDown') {
    nextDehbSlide();
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    prevDehbSlide();
  }
}
document.removeEventListener('keydown', _handleDehbKeydown);
document.addEventListener('keydown', _handleDehbKeydown);

/**
 * Görsel büyütme (lightbox)
 */
function dehbGorselAc(src) {
  document.getElementById('dehb-lightbox')?.remove();
  const kutu = document.createElement('div');
  kutu.id = 'dehb-lightbox';
  kutu.className = 'dehb-lightbox';
  kutu.innerHTML = `<img src="${src}" alt="Büyütülmüş görsel">`;

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

function restoreDehbSection() {
  let kayitli = 'nedir';
  try { kayitli = localStorage.getItem('dehb_active_slide') || 'nedir'; } catch (e) {}
  showDehbSlide(kayitli);
}

// loadPage() kancası
if (typeof origLoadPage === 'undefined' && typeof loadPage === 'function') {
  const origLoadPage = window.loadPage;
  window.loadPage = function (pageName) {
    const sonuc = origLoadPage.call(this, pageName);
    if (pageName === 'dehb-info') setTimeout(restoreDehbSection, 50);
    return sonuc;
  };
}
