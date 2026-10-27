/* ══════════════════════════════════════════════════════════════
   FocusAid — olay dağıtıcı (inline on*="..." yerine)

   NEDEN: CSP `script-src`'ten 'unsafe-inline' kalksın diye. Inline handler
   (onclick="...") CSP'de yalnız 'unsafe-inline' ile çalışır; o da açıkken bir
   XSS'in enjekte ettiği <img onerror> de çalışır. Handler'lar bu yüzden veri
   özniteliğine taşındı, burada tek yerden dinleniyor:

     data-tikla="loadPage" data-args='["today"]'    → loadPage('today')
     data-degis / data-girdi / data-enter           → change / input / Enter tuşu
     data-ile="oge" | "olay" | "deger"              → this / event / this.value (args'tan ÖNCE)
     data-durdur                                    → event.stopPropagation()
     <img data-yedek-metin="📁">                     → yüklenemezse metne dönüşür
     <script data-yuklenince="gapiLoaded">          → onload

   Ad bir global fonksiyon ya da noktalı yol olmalı ("FocusAudio.toggle"):
   `const`/`let` ile tanımlı fonksiyonlar window'da YOKTUR, çağrılamaz.
   test/olay-baglama.test.js her adın tanımlı olduğunu kaynakta doğruluyor.

   ⚠️ Bu dosya sayfada handler'lı her öğeden ve async CDN script'lerinden ÖNCE,
   async olmadan yüklenmeli (load dinleyicisi onlardan önce kurulmalı).
   ⚠️ Yeni DOM'da inline on*="" YAZMA — CSP onu sessizce engeller.
   ══════════════════════════════════════════════════════════════ */
(function () {
  function coz(ad) {
    let sahip = window, deger = window;
    for (const parca of String(ad || '').split('.')) {
      if (deger == null) return null;
      sahip = deger;
      deger = deger[parca];
    }
    return typeof deger === 'function' ? { fn: deger, sahip } : null;
  }

  function cagir(el, anahtar, olay) {
    const ad = el.dataset[anahtar];
    const hedef = coz(ad);
    if (!hedef) { console.warn('[olay] tanımsız fonksiyon:', ad); return; }
    let args = [];
    if (el.dataset.args) {
      try { args = JSON.parse(el.dataset.args); } catch (e) { console.warn('[olay] bozuk data-args:', el.dataset.args); return; }
      if (!Array.isArray(args)) args = [args];
    }
    const ile = el.dataset.ile;
    if (ile === 'oge') args.unshift(el);
    else if (ile === 'olay') args.unshift(olay);
    else if (ile === 'deger') args.unshift(el.value);
    // this = sahip nesne: noktalı yolda FocusAudio, düz adda window (eski onclick="fn()"
    // içindeki çağrıyla aynı). Öğe gerekiyorsa data-ile="oge".
    return hedef.fn.apply(hedef.sahip, args);
  }

  /** Eski kabarcıklanmayı BİREBİR taklit eder: hedeften yukarı her eşleşen
   *  öğe sırayla çalışır; data-durdur ya da çağrılan fonksiyonun yaptığı
   *  stopPropagation zinciri keser. */
  function yay(olay, anahtar, kosul) {
    for (let el = olay.target; el && el.nodeType === 1; el = el.parentElement) {
      if (el.dataset[anahtar] !== undefined && (!kosul || kosul(olay))) cagir(el, anahtar, olay);
      if (olay.cancelBubble) return;
      if (anahtar === 'tikla' && el.hasAttribute('data-durdur')) return;
    }
  }

  document.addEventListener('click', e => yay(e, 'tikla'));
  document.addEventListener('change', e => yay(e, 'degis'));
  document.addEventListener('input', e => yay(e, 'girdi'));
  document.addEventListener('keydown', e => { if (e.key === 'Enter') yay(e, 'enter'); });

  // error/load kabarcıklanmaz; yakalama (capture) aşamasında document'a ulaşır.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset.yedekMetin !== undefined) {
      img.replaceWith(document.createTextNode(img.dataset.yedekMetin));
    }
  }, true);
  document.addEventListener('load', e => {
    const ad = e.target && e.target.dataset && e.target.dataset.yuklenince;
    if (!ad) return;
    // Async script, onu çağıracak inline script ayrıştırılmadan önce yüklenebilir:
    // fonksiyon henüz yoksa sayfa hazır olunca dene.
    const calistir = () => { const h = coz(ad); if (h) h.fn.call(h.sahip); else console.warn('[olay] tanımsız fonksiyon:', ad); };
    if (coz(ad) || document.readyState !== 'loading') calistir();
    else document.addEventListener('DOMContentLoaded', calistir, { once: true });
  }, true);
})();
