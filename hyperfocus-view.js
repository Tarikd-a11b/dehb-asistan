/* ══════════════════════════════════════════════════════════════
   FocusAid — Hiperfokus alarmı görünüm katmanı
   DOM + localStorage + Notification. Saf hesap hyperfocus-logic.js'te.

   ⚠️ Bu izleyici UYGULAMA seviyesindedir, sayfaya bağlı DEĞİLDİR.
   `loadPage()` her gezinmede `stopTodayTimer()` çağırıyor; alarmın ona
   takılmaması gerekiyor, yoksa "Bugün"den çıkan kullanıcıda sayaç durur.
   ══════════════════════════════════════════════════════════════ */

const HYPERFOCUS_KEY = 'focusaid_hyperfocus';
const HYPERFOCUS_TICK_MS = 30000;   // 30 sn — mola eşiği 10 dk, bolca altında
const HYPERFOCUS_SNOOZE_MIN = 5;

let hyperfocusTimer = null;

/** Profildeki limit. `userProfile` henüz kurulmamış olabilir — localStorage yedek. */
function hyperfocusLimitiOku() {
  try {
    if (typeof userProfile === 'object' && userProfile) return userProfile.hyperfocusLimit;
  } catch (e) { /* TDZ: script sırası yüzünden henüz tanımsız olabilir */ }
  try {
    return JSON.parse(localStorage.getItem('focusaid_profile') || '{}').hyperfocusLimit;
  } catch (e) { return 'none'; }
}

function hyperfocusDurumOku() {
  try { return JSON.parse(localStorage.getItem(HYPERFOCUS_KEY) || 'null'); }
  catch (e) { return null; }
}

function hyperfocusDurumYaz(state) {
  try {
    if (state) localStorage.setItem(HYPERFOCUS_KEY, JSON.stringify(state));
    else localStorage.removeItem(HYPERFOCUS_KEY);
  } catch (e) { console.warn('[Hiperfokus] durum yazılamadı:', e.message); }
}

// ── ŞERİT ───────────────────────────────────────────────────────────────────
/* Toast DEĞİL: `showToast` 3.5 saniyede kayboluyor ve hiperfokustaki birinin
   onu görmesini beklemek özelliği baştan anlamsız kılar. Şerit, kullanıcı bir
   şey yapana kadar durur. */
function hyperfocusSeridiGoster(alarm) {
  hyperfocusSeridiKapat();
  const el = document.createElement('div');
  el.id = 'hyperfocus-banner';
  // ⚠️ Ortalama `-translate-x-1/2` ile YAPILMAZ: `.animate-slide-in`'in `reveal`
  // kareleri `transform`'u komple eziyor (`translateY(0)` ile bitiyor) ve şerit
  // animasyon boyunca yana kayıyor. `mx-auto` transform'a hiç dokunmaz.
  el.className = 'fixed top-4 inset-x-0 mx-auto z-[55] w-[min(94vw,34rem)] ' +
                 'bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/40 ' +
                 'rounded-2xl shadow-2xl p-5 animate-slide-in';
  el.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="text-2xl shrink-0">⏰</div>
      <div class="min-w-0">
        <p class="font-extrabold text-slate-900 dark:text-slate-100 text-sm">Kısa bir ara</p>
        <p class="text-slate-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">${hyperfocusMessage(alarm.elapsedMinutes)}</p>
      </div>
    </div>
    <div class="flex gap-3 mt-4">
      <button id="hyperfocus-mola" class="flex-[2] bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all">Mola verdim</button>
      <button id="hyperfocus-sonra" class="flex-1 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-200 py-2.5 rounded-xl font-bold text-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-100 transition-all">${HYPERFOCUS_SNOOZE_MIN} dk sonra</button>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('hyperfocus-mola').onclick = molaVerdim;
  document.getElementById('hyperfocus-sonra').onclick = hiperfokusErtele;

  hyperfocusBildirimiGonder(alarm);
}

function hyperfocusSeridiKapat() {
  document.getElementById('hyperfocus-banner')?.remove();
}

function molaVerdim() {
  hyperfocusSeridiKapat();
  hyperfocusDurumYaz(resetHyperfocus(Date.now()));
}

function hiperfokusErtele() {
  hyperfocusSeridiKapat();
  const y = snoozeHyperfocus(hyperfocusDurumOku(), Date.now(), HYPERFOCUS_SNOOZE_MIN);
  if (y) hyperfocusDurumYaz(y);
}

// ── TARAYICI BİLDİRİMİ ──────────────────────────────────────────────────────
/* Yalnızca izin ZATEN verilmişse gönderilir. Kendiliğinden izin penceresi
   açılmaz; izin, kullanıcı profilde 'none' dışında bir değer seçtiği anda
   (gerçek kullanıcı hareketi) istenir — bkz. hyperfocusIzniIste. */
function hyperfocusBildirimiGonder(alarm) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification('FocusAid — kısa bir ara', {
      body: hyperfocusMessage(alarm.elapsedMinutes),
      tag: 'focusaid-hyperfocus'   // üst üste birikmesin
    });
  } catch (e) { console.warn('[Hiperfokus] bildirim gönderilemedi:', e.message); }
}

function hyperfocusIzniIste() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    Notification.requestPermission().catch(() => {});
  } catch (e) { /* eski tarayıcı: sessizce geç, şerit zaten çalışıyor */ }
}

// ── İZLEYİCİ ────────────────────────────────────────────────────────────────
function hyperfocusTikAt() {
  const { state, alarm } = hyperfocusTick(hyperfocusDurumOku(), {
    nowMs: Date.now(),
    limitMinutes: parseHyperfocusLimit(hyperfocusLimitiOku())
  });
  hyperfocusDurumYaz(state);
  if (!state) hyperfocusSeridiKapat();   // kullanıcı alarmı kapattı
  if (alarm) hyperfocusSeridiGoster(alarm);
}

function startHyperfocusWatch() {
  stopHyperfocusWatch();
  hyperfocusTikAt();                     // ilk tik hemen: yenileme sonrası boşluk kalmasın
  hyperfocusTimer = setInterval(hyperfocusTikAt, HYPERFOCUS_TICK_MS);
}

function stopHyperfocusWatch() {
  if (hyperfocusTimer) { clearInterval(hyperfocusTimer); hyperfocusTimer = null; }
}
