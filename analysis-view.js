/* ══════════════════════════════════════════════════════════════
   FocusAid — "Çalışma Analizim" kartı (Profil)
   Hesap analysis-logic.js'te (saf). Bu dosya: Supabase okuma/yazma + çizim.
   Sakinlik ilkesi (kullanıcı kararı 2026-10-12): animasyon yok, soluk renk,
   kütüphane yok — düz HTML/CSS çubuklar.
   Spec: docs/superpowers/specs/2026-10-12-calisma-analizi-kalibrasyon-design.md
   ══════════════════════════════════════════════════════════════ */

const ANALYSIS_DISMISS_KEY = 'focusaid_analysis_dismiss';
const ANALYSIS_DISMISS_DAYS = 7;
// Tam sınıf adları (Tailwind kaynağı düz metin tarar; parça parça üretme).
const ANALYSIS_BAR_CLASS = {
  low: 'bg-emerald-300 dark:bg-emerald-400/80',
  medium: 'bg-amber-300 dark:bg-amber-400/80',
  high: 'bg-rose-300 dark:bg-rose-400/80'
};

let _analysisLast = null;   // son çizilen veri (Uygula/Şimdilik değil sonrası yeniden çizim)

function _analysisKat(x) { return '×' + Number(x).toFixed(1).replace('.', ','); }

function _analysisDismissed(value) {
  try {
    const d = JSON.parse(localStorage.getItem(ANALYSIS_DISMISS_KEY) || 'null');
    return !!d && d.value === value && Number(d.untilMs) > Date.now();
  } catch (e) { return false; }
}

// Grafikler düz HTML/CSS: SVG viewBox'u geniş kartta orantılı büyüyüp yazıları
// devleştiriyordu (2026-10-12). Yazı boyutu artık kart genişliğinden bağımsız.
const ANALYSIS_BAR_MAX = 2.5;

function _analysisBarsHTML(c) {
  const yuzde = (f) => (Math.min(f, ANALYSIS_BAR_MAX) / ANALYSIS_BAR_MAX) * 100;
  const x1 = yuzde(1);
  const rows = ANALYSIS_LOADS.map(l => {
    const veriYok = !c.samples[l];
    const dolgu = veriYok ? 'bg-slate-300 dark:bg-slate-600' : ANALYSIS_BAR_CLASS[l];
    const deger = veriYok
      ? '<span class="text-slate-400">veri yok</span>'
      : `${_analysisKat(c.factors[l])} <span class="text-slate-400">· ${c.samples[l]} oturum</span>`;
    return `
      <div data-analysis-bar="${l}" class="grid grid-cols-[3.5rem_1fr_5.5rem] items-center gap-3">
        <span class="text-xs text-slate-500 dark:text-slate-400">${ANALYSIS_LOAD_LABELS[l]}</span>
        <div class="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-700/50">
          <div class="h-full rounded-full ${dolgu}" style="width:${veriYok ? 0 : Math.max(1, yuzde(c.factors[l]))}%"></div>
          <div class="absolute -top-1 -bottom-1 border-l border-dashed border-slate-400 dark:border-slate-500" style="left:${x1}%"></div>
        </div>
        <span class="text-xs tabular-nums text-slate-600 dark:text-slate-300">${deger}</span>
      </div>`;
  }).join('');
  return `
    <div class="space-y-3" role="img" aria-label="Tahmin ve gerçek süre oranı">
      ${rows}
      <p class="text-[11px] text-slate-400">Kesikli çizgi ×1,0 = tahminin tuttu · sağında kalan = tahmininden uzun sürdü</p>
    </div>`;
}

function _analysisColsHTML(daily, focusPeriod) {
  const max = Math.max(60, focusPeriod, ...daily.map(d => d.minutes));
  const yuzde = (m) => (m / max) * 100;
  const bos = daily.every(d => !d.minutes);
  const cols = daily.map(d => `
      <div data-analysis-col="${d.day}" title="${d.day}: ${d.minutes} dk" class="flex-1 rounded-t bg-indigo-300 dark:bg-indigo-400/70" style="height:${d.minutes ? Math.max(3, yuzde(d.minutes)) : 0}%"></div>`).join('');
  return `
    <div role="img" aria-label="Son 14 günün en uzun kesintisiz odak süresi">
      <div class="relative h-28 flex items-end gap-1.5 border-b border-slate-200 dark:border-slate-700">
        ${cols}
        <div class="absolute inset-x-0 border-t border-dashed border-slate-400 dark:border-slate-500" style="bottom:${yuzde(focusPeriod)}%">
          <span class="absolute right-0 -top-4 text-[11px] text-slate-400">odak süren ${focusPeriod} dk</span>
        </div>
        ${bos ? '<p class="absolute inset-0 flex items-center justify-center text-xs text-slate-400">Son 14 günde sayaçlı oturum yok</p>' : ''}
      </div>
      <div class="flex justify-between mt-1 text-[11px] text-slate-400"><span>14 gün önce</span><span>bugün</span></div>
    </div>`;
}

/** Ağsız çizim. UI testi doğrudan çağırır. */
function renderAnalysisCard(container, { calibration, daily, focusPeriod, guest }) {
  if (!container) return;
  _analysisLast = { calibration, daily, focusPeriod, guest };
  const baslik = `<h3 class="font-bold text-slate-800 dark:text-slate-100">📈 Çalışma Analizim</h3>`;
  if (guest) {
    container.innerHTML = `<div class="glass-card p-6 bg-white shadow-sm space-y-2">${baslik}
      <p class="text-sm text-slate-500 dark:text-slate-400">Giriş yapınca açılır.</p></div>`;
    return;
  }
  const c = analysisParseCalibration(calibration);
  const toplamOrnek = ANALYSIS_LOADS.reduce((s, l) => s + c.samples[l], 0);
  if (c.timedSessions < 8 && toplamOrnek === 0) {
    container.innerHTML = `<div class="glass-card p-6 bg-white shadow-sm space-y-2">${baslik}
      <p class="text-sm text-slate-500 dark:text-slate-400">Analiz için ${c.timedSessions}/8 oturum — görev sayacını kullandıkça dolacak.</p></div>`;
    return;
  }
  const fp = Number(focusPeriod) || 25;
  const oneri = c.focusSuggestion && !_analysisDismissed(c.focusSuggestion)
    ? `<div class="rounded-2xl bg-slate-50 dark:bg-slate-700/40 p-4 space-y-3">
         <p class="text-sm text-slate-600 dark:text-slate-300">Ortalama ${c.focusSuggestion} dk kesintisiz odaklanıyorsun. Odak süreni <b>${fp} → ${c.focusSuggestion} dk</b> yapalım mı?</p>
         <div class="flex gap-2">
           <button data-analysis-apply onclick="analysisApplySuggestion()" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white">Uygula</button>
           <button onclick="analysisDismissSuggestion()" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-600/50 text-slate-700 dark:text-slate-200">Şimdilik değil</button>
         </div>
       </div>`
    : '';
  const sutunlar = Array.isArray(daily) && daily.length === 14
    ? `<div class="space-y-3"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">En uzun kesintisiz odak (gün başına)</p>${_analysisColsHTML(daily, fp)}</div>`
    : '';
  container.innerHTML = `
    <div class="glass-card p-6 bg-white shadow-sm space-y-5">
      ${baslik}
      <div class="grid gap-8 lg:grid-cols-2">
        <div class="space-y-3"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Tahmin ve gerçek süre (son 30 gün)</p>${_analysisBarsHTML(c)}</div>
        ${sutunlar}
      </div>
      ${oneri}
    </div>`;
}

/** Görevleri çekip calibration'ı yeniden hesaplar; değiştiyse profile yazar. */
async function analysisRefresh() {
  if ((typeof isGuestMode !== 'undefined' && isGuestMode) || !currentUser) return null;
  const nowMs = Date.now();
  const since = new Date(nowMs - 30 * 86400000).toISOString();
  const { data, error } = await sb.from('tasks')
    .select('id,cognitive_load,start_time,end_time,started_at,actual_minutes,longest_stretch_sec,duration_feedback,completed_at,planned_factor')
    .gte('completed_at', since);
  if (error) { console.warn('[Analiz] görevler okunamadı:', error.code, error.message); return null; }
  const fp = Number(userProfile?.focusPeriod) || 25;
  const calibration = analysisCalibration(data || [], nowMs, fp);
  const daily = analysisDailyStretches(data || [], nowMs);
  if (!analysisSameCalibration(calibration, userProfile?.calibration)) {
    const { error: yazHata } = await sb.from('profiles').update({ calibration }).eq('id', currentUser.id);
    if (yazHata) console.warn('[Analiz] calibration yazılamadı:', yazHata.code, yazHata.message);
    else {
      userProfile.calibration = calibration;
      try { localStorage.setItem('focusaid_profile', JSON.stringify(userProfile)); } catch (e) {}
    }
  }
  const kart = document.getElementById('analysis-card');
  if (kart) renderAnalysisCard(kart, { calibration, daily, focusPeriod: fp, guest: false });
  return { calibration, daily };
}

async function analysisMountCard() {
  const kart = document.getElementById('analysis-card');
  if (!kart) return;
  const guest = (typeof isGuestMode !== 'undefined' && isGuestMode) || !currentUser;
  // Önce eldeki (hesaptaki) değerle hemen çiz, sonra tazele.
  renderAnalysisCard(kart, { calibration: userProfile?.calibration ?? null, daily: [],
                             focusPeriod: userProfile?.focusPeriod, guest });
  if (!guest) await analysisRefresh();
}

/** Kartta GÖRÜNEN öneri (son çizim), yoksa profildeki. */
function _analysisShownCalibration() {
  return analysisParseCalibration(_analysisLast?.calibration ?? userProfile?.calibration);
}

async function analysisApplySuggestion() {
  const c = _analysisShownCalibration();
  if (!c.focusSuggestion || !currentUser) return;
  const yeni = c.focusSuggestion;
  const { error } = await sb.from('profiles').update({ focus_period: yeni }).eq('id', currentUser.id);
  if (error) { showToast('Kaydedilemedi, tekrar dene.', 'error'); return; }
  userProfile.focusPeriod = yeni;
  try { localStorage.setItem('focusaid_profile', JSON.stringify(userProfile)); } catch (e) {}
  showToast(`Odak süren ${yeni} dk oldu.`, 'success');
  // ⚠️ loadProfileToUI() ÇAĞIRMA: tüm alanları sıfırlar ve kaydedilmemiş düzenlemeleri
  // (kirli işaretiyle birlikte) siler. Yalnız odak süresi alanını güncelle.
  const fpEl = document.getElementById('focus-period');
  if (fpEl) fpEl.value = yeni;
  const fd = document.getElementById('focus-display');
  if (fd) fd.textContent = yeni + ' dk';
  await analysisRefresh();   // öneri artık mevcut değere eşit → kaybolur
}

function analysisDismissSuggestion() {
  const c = _analysisShownCalibration();
  try {
    localStorage.setItem(ANALYSIS_DISMISS_KEY, JSON.stringify({
      value: c.focusSuggestion, untilMs: Date.now() + ANALYSIS_DISMISS_DAYS * 86400000
    }));
  } catch (e) {}
  const kart = document.getElementById('analysis-card');
  if (kart && _analysisLast) renderAnalysisCard(kart, _analysisLast);
}
