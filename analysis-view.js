/* ══════════════════════════════════════════════════════════════
   FocusAid — "Çalışma Analizim" kartı (Profil)
   Hesap analysis-logic.js'te (saf). Bu dosya: Supabase okuma/yazma + çizim.
   Sakinlik ilkesi (kullanıcı kararı 2026-10-12): animasyon yok, soluk renk,
   kütüphane yok — satır içi SVG.
   Spec: docs/superpowers/specs/2026-10-12-calisma-analizi-kalibrasyon-design.md
   ══════════════════════════════════════════════════════════════ */

const ANALYSIS_DISMISS_KEY = 'focusaid_analysis_dismiss';
const ANALYSIS_DISMISS_DAYS = 7;
// Tam sınıf adları (Tailwind kaynağı düz metin tarar; parça parça üretme).
const ANALYSIS_BAR_CLASS = {
  low: 'fill-emerald-300 dark:fill-emerald-700',
  medium: 'fill-amber-300 dark:fill-amber-700',
  high: 'fill-rose-300 dark:fill-rose-700'
};

let _analysisLast = null;   // son çizilen veri (Uygula/Şimdilik değil sonrası yeniden çizim)

function _analysisKat(x) { return '×' + Number(x).toFixed(1).replace('.', ','); }

function _analysisDismissed(value) {
  try {
    const d = JSON.parse(localStorage.getItem(ANALYSIS_DISMISS_KEY) || 'null');
    return !!d && d.value === value && Number(d.untilMs) > Date.now();
  } catch (e) { return false; }
}

function _analysisBarsSVG(c) {
  const W = 300, rowH = 26, max = 2.5, x0 = 52, w = W - x0 - 44;
  const xOf = (f) => x0 + (Math.min(f, max) / max) * w;
  const rows = ANALYSIS_LOADS.map((l, i) => {
    const y = i * rowH + 4;
    return `
      <g data-analysis-bar="${l}">
        <text x="0" y="${y + 13}" class="fill-slate-500 dark:fill-slate-400" font-size="11">${ANALYSIS_LOAD_LABELS[l]}</text>
        <rect x="${x0}" y="${y + 3}" width="${Math.max(2, xOf(c.factors[l]) - x0)}" height="12" rx="3" class="${ANALYSIS_BAR_CLASS[l]}"></rect>
        <text x="${xOf(c.factors[l]) + 6}" y="${y + 13}" class="fill-slate-600 dark:fill-slate-300" font-size="11">${_analysisKat(c.factors[l])} <tspan class="fill-slate-400" font-size="9">(${c.samples[l]})</tspan></text>
      </g>`;
  }).join('');
  const x1 = xOf(1);
  return `
    <svg viewBox="0 0 ${W} ${ANALYSIS_LOADS.length * rowH + 14}" class="w-full h-auto" role="img" aria-label="Tahmin ve gerçek süre oranı">
      ${rows}
      <line x1="${x1}" x2="${x1}" y1="0" y2="${ANALYSIS_LOADS.length * rowH + 4}" class="stroke-slate-300 dark:stroke-slate-600" stroke-dasharray="3 3"></line>
      <text x="${x1}" y="${ANALYSIS_LOADS.length * rowH + 13}" text-anchor="middle" class="fill-slate-400" font-size="9">1,0 = tam isabet</text>
    </svg>`;
}

function _analysisColsSVG(daily, focusPeriod) {
  const W = 300, H = 90, pad = 4, colW = (W - pad * 2) / 14;
  const max = Math.max(60, focusPeriod, ...daily.map(d => d.minutes));
  const yOf = (m) => H - 14 - (m / max) * (H - 24);
  const cols = daily.map((d, i) => {
    const h = Math.max(0, (H - 14) - yOf(d.minutes));
    return `<rect data-analysis-col="${d.day}" x="${pad + i * colW + 2}" y="${yOf(d.minutes)}" width="${colW - 4}" height="${h}" rx="2" class="fill-indigo-200 dark:fill-indigo-800"><title>${d.day}: ${d.minutes} dk</title></rect>`;
  }).join('');
  const yf = yOf(focusPeriod);
  return `
    <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Son 14 günün en uzun kesintisiz odak süresi">
      ${cols}
      <line x1="0" x2="${W}" y1="${yf}" y2="${yf}" class="stroke-slate-400 dark:stroke-slate-500" stroke-dasharray="4 3"></line>
      <text x="${W - 2}" y="${yf - 3}" text-anchor="end" class="fill-slate-400" font-size="9">odak süren ${focusPeriod} dk</text>
      <text x="0" y="${H - 2}" class="fill-slate-400" font-size="9">14 gün önce</text>
      <text x="${W}" y="${H - 2}" text-anchor="end" class="fill-slate-400" font-size="9">bugün</text>
    </svg>`;
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
    ? `<div class="space-y-1"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">En uzun kesintisiz odak (gün başına)</p>${_analysisColsSVG(daily, fp)}</div>`
    : '';
  container.innerHTML = `
    <div class="glass-card p-6 bg-white shadow-sm space-y-5">
      ${baslik}
      <div class="space-y-1"><p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Tahmin ve gerçek süre (son 30 gün)</p>${_analysisBarsSVG(c)}</div>
      ${sutunlar}
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
