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

  // 3. Mini nav-bar butonlarının aktif durumunu güncelle — renk her butonun
  // kendi --nav-accent inline stilinden geliyor (bkz. index.html markup + CSS).
  document.querySelectorAll('.dehb-nav-item').forEach(btn => {
    btn.classList.remove('active-link', 'shadow-sm');
  });

  const activeBtn = document.getElementById(`dehb-nav-${sectionName}`);
  if (activeBtn) {
    activeBtn.classList.add('active-link', 'shadow-sm');
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
  initDehbSlider();
}

/**
 * initDehbSlider()
 *
 * Her .dehb-content bölümündeki .glass-card bloklarını (varsa 2+) tek-seferde-
 * tek-kart gösteren bir slider'a çevirir: ok butonları + nokta göstergeleri +
 * "3/7" sayaç. Kartların içeriğine dokunmadan sadece taşır — mevcut renkli
 * kenarlıklar (border-t-4 border-purple-500 vb.) ve numaralar korunur.
 * data-slider-ready ile idempotent: sayfalar arası geçişte tekrar sarmalanmaz.
 */
function initDehbSlider() {
  document.querySelectorAll('.dehb-content').forEach(section => {
    const wrapper = section.querySelector(':scope > div');
    if (!wrapper || wrapper.dataset.sliderReady) return;
    const cards = [...wrapper.querySelectorAll(':scope > .glass-card')];
    if (cards.length < 2) return; // tek kart varsa slider'a gerek yok

    wrapper.dataset.sliderReady = '1';

    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'dehb-slider';
    cards[0].before(sliderWrap);

    // viewport SADECE kartları kırpar (overflow:hidden + animasyonlu yükseklik).
    // nav bunun DIŞINDA, sliderWrap'in doğrudan çocuğu — böylece ok/nokta
    // gezinme çubuğu kart yüksekliği hesaba katılmadığında bile hiç kırpılmaz.
    // (Önceki bug: nav, yüksekliği karta göre ayarlanan overflow:hidden
    // kutunun İÇİNDEYDİ, bu yüzden görünmez oluyor, slider kullanılamıyordu.)
    const viewport = document.createElement('div');
    viewport.className = 'dehb-slider-viewport';
    sliderWrap.appendChild(viewport);

    const track = document.createElement('div');
    track.className = 'dehb-slider-track';
    cards.forEach(c => { c.classList.add('dehb-slide'); track.appendChild(c); });
    viewport.appendChild(track);

    const nav = document.createElement('div');
    nav.className = 'dehb-slider-nav';
    const dotsHtml = cards.map((_, i) => `<button class="dehb-slider-dot" data-i="${i}" aria-label="${i + 1}. karta git"></button>`).join('');
    nav.innerHTML = `
      <button class="dehb-slider-btn" data-dir="-1" aria-label="Önceki">‹</button>
      <div class="dehb-slider-dots">${dotsHtml}</div>
      <span class="dehb-slider-counter">1/${cards.length}</span>
      <button class="dehb-slider-btn" data-dir="1" aria-label="Sonraki">›</button>`;
    sliderWrap.appendChild(nav);

    const dots = [...nav.querySelectorAll('.dehb-slider-dot')];
    const counterEl = nav.querySelector('.dehb-slider-counter');
    let idx = 0;
    function goTo(i) {
      idx = Math.max(0, Math.min(cards.length - 1, i));
      track.style.transform = `translateX(-${idx * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle('active', di === idx));
      counterEl.textContent = `${idx + 1}/${cards.length}`;
      // viewport SADECE aktif kartın boyuna göre yükseklik alır — nav bu
      // hesaba hiç girmez çünkü artık viewport'un dışında.
      viewport.style.height = cards[idx].offsetHeight + 'px';
    }
    nav.querySelectorAll('.dehb-slider-btn').forEach(btn => {
      btn.addEventListener('click', () => goTo(idx + Number(btn.dataset.dir)));
    });
    dots.forEach(d => d.addEventListener('click', () => goTo(Number(d.dataset.i))));
    // showDehbSection bir bölümü görünür yaptığında, o an açık olan kartın
    // yüksekliğini (idx değişmeden) yeniden ölçmek için çağırır.
    sliderWrap.dehbRefresh = () => goTo(idx);
    goTo(0);
    // Google Fonts geç yüklenince (özellikle sayfanın ilk açılışında) kart
    // yüksekliği font değişince büyüyebiliyor — o zaman ölçülen yükseklik
    // eskimiş kalır. Fontlar hazır olunca ve kısa bir gecikmeyle bir daha ölç.
    document.fonts?.ready?.then(() => sliderWrap.dehbRefresh?.());
    setTimeout(() => sliderWrap.dehbRefresh?.(), 300);
  });
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
