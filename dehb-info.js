// ════════════════════════════════════════
// DEHB Bilgilendirme Platform — JavaScript Logic (Claude Original)
// ════════════════════════════════════════

/**
 * showDehbSection(sectionName)
 *
 * Verilen bölümü gösterir, diğerlerini gizler.
 * Mini nav-bar butonunun aktif durumunu günceller.
 * localStorage'a kaydeder.
 *
 * @param {string} sectionName - 'nedir', 'belirtiler', 'stratejiler', 'yasam', 'kaynaklar'
 */
function showDehbSection(sectionName) {
  // 1. Tüm bölüm containerlarını gizle
  document.querySelectorAll('.dehb-content').forEach(el => {
    el.classList.add('hidden');
  });

  // 2. İstenilen bölümü göster
  const activeSection = document.getElementById(`dehb-section-${sectionName}`);
  if (activeSection) {
    activeSection.classList.remove('hidden');
  } else {
    console.warn(`DEHB section not found: dehb-section-${sectionName}`);
    const defaultSection = document.getElementById('dehb-section-nedir');
    if (defaultSection) {
      defaultSection.classList.remove('hidden');
    }
  }

  // 3. Mini nav-bar butonlarının aktif durumunu güncelle
  document.querySelectorAll('.dehb-nav-item').forEach(btn => {
    btn.classList.remove('active-link', 'bg-indigo-50', 'text-indigo-600', 'shadow-sm', 'dark:bg-indigo-950/60', 'dark:text-indigo-300');
  });

  const activeBtn = document.getElementById(`dehb-nav-${sectionName}`);
  if (activeBtn) {
    activeBtn.classList.add('active-link', 'bg-indigo-50', 'text-indigo-600', 'shadow-sm', 'dark:bg-indigo-950/60', 'dark:text-indigo-300');
  }

  // 4. localStorage'a kaydet (sayfa kapanıp açıldığında son bölümü hatırla)
  try {
    localStorage.setItem('dehb_active_section', sectionName);
  } catch (e) {
    console.warn('localStorage kaydedilemedi:', e);
  }

  // 5. Sayfanın tepesine scroll yap
  document.querySelector('[id^="dehb-section-"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * restoreDehbSection()
 * Sayfa yüklendiğinde localStorage'dan son açılan bölümü geri yükle.
 * Default: 'nedir'
 */
function restoreDehbSection() {
  const saved = localStorage.getItem('dehb_active_section') || 'nedir';
  showDehbSection(saved);
}

// Görsel büyütme (lightbox)
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

// loadPage() kancası — dehb-info yüklendiğinde restoreDehbSection() çağır
if (typeof origLoadPage === 'undefined' && typeof loadPage === 'function') {
  const origLoadPage = window.loadPage;
  window.loadPage = function (pageName) {
    const sonuc = origLoadPage.call(this, pageName);
    if (pageName === 'dehb-info') setTimeout(restoreDehbSection, 50);
    return sonuc;
  };
}

