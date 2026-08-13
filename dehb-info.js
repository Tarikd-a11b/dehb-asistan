// ════════════════════════════════════════
// DEHB Bilgilendirme Platform — JavaScript Logic
// ════════════════════════════════════════

/**
 * showDehbSection(sectionName)
 *
 * Verilen bölümü gösterer, diğerlerini gizler.
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
    // Default olarak 'nedir'i göster
    const defaultSection = document.getElementById('dehb-section-nedir');
    if (defaultSection) {
      defaultSection.classList.remove('hidden');
    }
  }

  // 3. Mini nav-bar butonlarının aktif durumunu güncelle
  document.querySelectorAll('.dehb-nav-item').forEach(btn => {
    btn.classList.remove('active-link', 'bg-indigo-50', 'text-indigo-600', 'shadow-sm');
  });

  // Şu anki butonunun stilini aktif yap
  const activeBtn = document.getElementById(`dehb-nav-${sectionName}`);
  if (activeBtn) {
    activeBtn.classList.add('active-link', 'bg-indigo-50', 'text-indigo-600', 'shadow-sm');
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
 *
 * Sayfa yüklendiğinde localStorage'dan son açılan bölümü geri yükle.
 * Default: 'nedir'
 */
function restoreDehbSection() {
  const saved = localStorage.getItem('dehb_active_section') || 'nedir';
  showDehbSection(saved);
}

// Sayfa yüklendiğinde otomatik olarak çalıştır
// (Mevcut FocusAid INITIAL_SESSION event'ini kullan)
window.addEventListener('INITIAL_SESSION', () => {
  // Template render olduktan sonra bu event ateşlenir
  // DEHB sayfasının aktif olduğu durumda restore yap
  const currentPage = document.querySelector('[id^="tpl-"].active') ||
                      document.querySelector('[style*="display: block"][id^="tpl-"]');

  if (currentPage && currentPage.id === 'tpl-dehb-info') {
    restoreDehbSection();
  }
});

// Alternatif: loadPage() çağrılırken otomatik restore
// (Eğer loadPage DEHB sayfasını yüklerken bu fonksiyonu çağırırsa)
// loadPage('dehb-info') → restoreDehbSection() otomatik çalışır

// Mevcut FocusAid'in loadPage() fonksiyonuna hook eklemek için:
// (opsiyonel — loadPage'in sonunda bu kod eklenebilir)
if (typeof origLoadPage === 'undefined' && typeof loadPage === 'function') {
  const origLoadPage = window.loadPage;
  window.loadPage = function(pageName) {
    const result = origLoadPage.call(this, pageName);
    if (pageName === 'dehb-info') {
      // Küçük delay ile template render olmasını bekle
      setTimeout(() => {
        restoreDehbSection();
      }, 100);
    }
    return result;
  };
}
