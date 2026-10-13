/* ══════════════════════════════════════════════════════════════
   FocusAid — Çalışma analizi saf mantık katmanı
   DOM YOK, ağ YOK, `Date.now()` YOK. Zaman daima dışarıdan verilir.
   Testler: node --test   (kök dizinden, ARGÜMANSIZ)

   Spec: docs/superpowers/specs/2026-10-12-calisma-analizi-kalibrasyon-design.md

   ⚠️ Bu dosya index.html'e KLASİK script olarak yükleniyor; tüm üst düzey
   adlar `ANALYSIS_` / `analysis` önekli (global sözlük çakışması, 2026-08-30).
   ══════════════════════════════════════════════════════════════ */

const ANALYSIS_FORGOTTEN_MULT = 3;
const ANALYSIS_FORGOTTEN_MAX_MIN = 240;
// Bundan kısa aktif süre (yanlışlıkla Başlat → Tamamla) ölçülmemiş sayılır.
const ANALYSIS_MIN_MEASURED_MIN = 2;

function _analysisMs(value) {
  if (!value) return NaN;
  return new Date(value).getTime();
}

/** Planlanan süre (dk). Okunamıyorsa null — örnek analize alınmaz. */
function analysisPlannedMinutes(task) {
  const s = _analysisMs(task && task.start_time);
  const e = _analysisMs(task && task.end_time);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
}

/** Şu anki dilimin saniyesi; çalışmıyorsa 0. Saat geri giderse 0. */
function _analysisCurrentStretch(task, nowMs) {
  const r = _analysisMs(task && task.running_since);
  if (!Number.isFinite(r)) return 0;
  return Math.max(0, Math.floor((nowMs - r) / 1000));
}

/** Molalar hariç toplam çalışma saniyesi (çalışan dilim dahil). */
function analysisActiveSeconds(task, nowMs) {
  return (Number(task && task.active_seconds) || 0) + _analysisCurrentStretch(task, nowMs);
}

/** Başlat/Devam. Zaten çalışıyorsa {} — ikinci sekmenin basışı yok sayılır. */
function analysisTimerStart(task, nowMs) {
  if (task && task.running_since) return {};
  const now = new Date(nowMs).toISOString();
  const patch = {};
  if (!task || !task.started_at) patch.started_at = now;
  patch.running_since = now;
  return patch;
}

/** Duraklat. Çalışmıyorsa {}. */
function analysisTimerPause(task, nowMs) {
  if (!task || !task.running_since) return {};
  const stretch = _analysisCurrentStretch(task, nowMs);
  return {
    running_since: null,
    active_seconds: (Number(task.active_seconds) || 0) + stretch,
    longest_stretch_sec: Math.max(Number(task.longest_stretch_sec) || 0, stretch)
  };
}

/**
 * Tamamlanınca yazılacak alanlar.
 * Sayaç hiç kullanılmadıysa → yalnız completed_at, soru sorulur.
 * Sayaç unutulmuşsa (> 3 × planlanan veya > 240 dk) → actual_minutes null, soru sorulur.
 * Aktif süre 2 dk'dan kısaysa (yanlışlıkla Başlat → Tamamla) → aynı: ölçülmemiş sayılır.
 */
function analysisCompletionPatch(task, nowMs) {
  const completed_at = new Date(nowMs).toISOString();
  if (!task || !task.started_at) {
    return { patch: { completed_at }, needsFeedback: true };
  }
  const paused = analysisTimerPause(task, nowMs);
  const merged = { ...task, ...paused };
  const minutes = (Number(merged.active_seconds) || 0) / 60;
  const planned = analysisPlannedMinutes(task);
  const forgotten = minutes > ANALYSIS_FORGOTTEN_MAX_MIN
    || (planned !== null && minutes > planned * ANALYSIS_FORGOTTEN_MULT);
  const tooShort = minutes < ANALYSIS_MIN_MEASURED_MIN;
  const unmeasured = forgotten || tooShort;
  const patch = {
    ...paused,
    actual_minutes: unmeasured ? null : Math.round(minutes),
    completed_at
  };
  return { patch, needsFeedback: unmeasured };
}

function analysisUncompletePatch() {
  return { completed_at: null, actual_minutes: null, duration_feedback: null };
}

// ═════ Analiz ═════
const ANALYSIS_LOADS = ['low', 'medium', 'high'];
const ANALYSIS_LOAD_LABELS = { low: 'Hafif', medium: 'Orta', high: 'Ağır' };
const ANALYSIS_FEEDBACK_RATIO = { shorter: 0.75, same: 1.0, longer: 1.4 };
const ANALYSIS_FEEDBACK_WEIGHT = 0.5;
const ANALYSIS_PRIOR_WEIGHT = 5;
const ANALYSIS_FACTOR_MIN = 0.6;
const ANALYSIS_FACTOR_MAX = 2.5;
const ANALYSIS_FACTOR_WINDOW_DAYS = 30;
const ANALYSIS_FOCUS_WINDOW_DAYS = 14;
const ANALYSIS_MIN_SESSIONS = 8;
const ANALYSIS_SUGGEST_MIN_DIFF = 5;
const ANALYSIS_FOCUS_MIN = 10;
const ANALYSIS_FOCUS_MAX = 60;
const ANALYSIS_MAIL_MIN_FACTOR = 1.2;
const ANALYSIS_MAIL_MIN_SAMPLES = 5;
const _ANALYSIS_DAY_MS = 86400000;

function _analysisClamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function _analysisRound2(x) { return Math.round(x * 100) / 100; }
function _analysisLoad(task) {
  const l = task && task.cognitive_load;
  return ANALYSIS_LOADS.includes(l) ? l : 'medium';
}
/** completed_at son `days` gün içinde mi. */
function _analysisInWindow(task, nowMs, days) {
  const c = _analysisMs(task && task.completed_at);
  return Number.isFinite(c) && c <= nowMs && nowMs - c <= days * _ANALYSIS_DAY_MS;
}
/** İstanbul günü (Türkiye yaz saati uygulamıyor: sabit +3). */
function _analysisIstanbulDay(ms) {
  return new Date(ms + 3 * 3600000).toISOString().slice(0, 10);
}
function _analysisMedian(list) {
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Tek görevden örnek: zamanlayıcı (ağırlık 1) > soru cevabı (ağırlık 0.5) > yok.
 * ⚠️ Oran `planned_factor` ile çarpılır: n8n bloğu zaten çarpanla uzatılmış yazdıysa
 * (40 dk = 25 × 1.6) örnek, uzatılmış bloğa değil kullanıcının ham tahminine göre
 * ölçülür. Çarpılmasa kalibrasyon kendini besler, çarpan 1'e doğru söner (≈ √f).
 * Değer yoksa (tek "Ekle" yolu, eski satırlar) 1.
 */
function analysisSample(task) {
  const planned = analysisPlannedMinutes(task);
  if (planned === null) return null;
  const load = _analysisLoad(task);
  const pf = Number(task.planned_factor);
  const applied = Number.isFinite(pf) && pf > 0 ? pf : 1;
  const actual = Number(task.actual_minutes);
  if (Number.isFinite(actual) && actual > 0) {
    return { load, ratio: _analysisRound2(actual / planned * applied), weight: 1 };
  }
  const fb = ANALYSIS_FEEDBACK_RATIO[task.duration_feedback];
  if (fb !== undefined) return { load, ratio: _analysisRound2(fb * applied), weight: ANALYSIS_FEEDBACK_WEIGHT };
  return null;
}

function analysisFactors(tasks, nowMs) {
  const sum = { low: 0, medium: 0, high: 0 };
  const weight = { low: 0, medium: 0, high: 0 };
  const samples = { low: 0, medium: 0, high: 0 };
  for (const t of tasks || []) {
    if (!_analysisInWindow(t, nowMs, ANALYSIS_FACTOR_WINDOW_DAYS)) continue;
    const s = analysisSample(t);
    if (!s) continue;
    sum[s.load] += s.ratio * s.weight;
    weight[s.load] += s.weight;
    samples[s.load] += 1;
  }
  const factors = {};
  for (const l of ANALYSIS_LOADS) {
    const n = weight[l];
    const r = n > 0 ? sum[l] / n : 1;
    const smoothed = (n * r + ANALYSIS_PRIOR_WEIGHT * 1) / (n + ANALYSIS_PRIOR_WEIGHT);
    factors[l] = _analysisRound2(_analysisClamp(smoothed, ANALYSIS_FACTOR_MIN, ANALYSIS_FACTOR_MAX));
  }
  return { factors, samples };
}

/** Sayaç dakikası. Unutulmuş sayaç (actual_minutes null) odak analizine girmez. */
function _analysisStretchMinutes(task) {
  if (!(Number(task && task.actual_minutes) > 0)) return null;
  const sec = Number(task.longest_stretch_sec);
  return Number.isFinite(sec) && sec > 0 ? sec / 60 : null;
}

function analysisFocusSuggestion(tasks, nowMs, currentFocus) {
  const stretches = (tasks || [])
    .filter(t => _analysisInWindow(t, nowMs, ANALYSIS_FOCUS_WINDOW_DAYS))
    .map(_analysisStretchMinutes)
    .filter(m => m !== null);
  const timedSessions = stretches.length;
  if (timedSessions < ANALYSIS_MIN_SESSIONS) return { suggestion: null, timedSessions };
  const rounded = Math.round(_analysisMedian(stretches) / 5) * 5;
  const s = _analysisClamp(rounded, ANALYSIS_FOCUS_MIN, ANALYSIS_FOCUS_MAX);
  const current = Number(currentFocus) || 25;
  return {
    suggestion: Math.abs(s - current) >= ANALYSIS_SUGGEST_MIN_DIFF ? s : null,
    timedSessions
  };
}

function analysisDailyStretches(tasks, nowMs) {
  const days = [];
  for (let i = ANALYSIS_FOCUS_WINDOW_DAYS - 1; i >= 0; i--) {
    days.push({ day: _analysisIstanbulDay(nowMs - i * _ANALYSIS_DAY_MS), minutes: 0 });
  }
  const index = new Map(days.map((d, i) => [d.day, i]));
  for (const t of tasks || []) {
    const m = _analysisStretchMinutes(t);
    const c = _analysisMs(t && t.completed_at);
    if (m === null || !Number.isFinite(c)) continue;
    const i = index.get(_analysisIstanbulDay(c));
    if (i !== undefined) days[i].minutes = Math.max(days[i].minutes, Math.round(m));
  }
  return days;
}

function analysisCalibration(tasks, nowMs, currentFocus) {
  const { factors, samples } = analysisFactors(tasks, nowMs);
  const { suggestion, timedSessions } = analysisFocusSuggestion(tasks, nowMs, currentFocus);
  return {
    computedAt: new Date(nowMs).toISOString(),
    factors, samples, focusSuggestion: suggestion, timedSessions
  };
}

function analysisParseCalibration(raw) {
  let c = raw;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e) { c = null; } }
  if (!c || typeof c !== 'object') c = {};
  const f = (c.factors && typeof c.factors === 'object') ? c.factors : {};
  const s = (c.samples && typeof c.samples === 'object') ? c.samples : {};
  const factors = {}, samples = {};
  for (const l of ANALYSIS_LOADS) {
    const x = Number(f[l]);
    factors[l] = Number.isFinite(x) && x > 0
      ? _analysisRound2(_analysisClamp(x, ANALYSIS_FACTOR_MIN, ANALYSIS_FACTOR_MAX)) : 1;
    const n = Number(s[l]);
    samples[l] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  const fs = Number(c.focusSuggestion);
  const ts = Number(c.timedSessions);
  return {
    computedAt: typeof c.computedAt === 'string' ? c.computedAt : null,
    factors, samples,
    focusSuggestion: Number.isFinite(fs) && fs > 0 ? fs : null,
    timedSessions: Number.isFinite(ts) && ts > 0 ? Math.floor(ts) : 0
  };
}

function analysisSameCalibration(a, b) {
  const x = analysisParseCalibration(a), y = analysisParseCalibration(b);
  delete x.computedAt; delete y.computedAt;
  return JSON.stringify(x) === JSON.stringify(y);
}

/**
 * Haftalık mail satırı. ⚠️ n8n `Build Per-User Reports` node'unda birebir
 * kopyası var (`sureNotu`); test/n8n-report.test.js ikisinin aynı çıktıyı
 * verdiğini doğruluyor. Birini değiştirirsen ötekini de değiştir.
 */
function analysisMailLine(calibration) {
  if (!calibration || typeof calibration !== 'object') return '';
  const c = analysisParseCalibration(calibration);
  let best = null;
  for (const l of ANALYSIS_LOADS) {
    if (c.samples[l] < ANALYSIS_MAIL_MIN_SAMPLES) continue;
    if (c.factors[l] < ANALYSIS_MAIL_MIN_FACTOR) continue;
    if (!best || c.factors[l] > c.factors[best]) best = l;
  }
  if (!best) return '';
  const kat = c.factors[best].toFixed(1).replace('.', ',');
  return `${ANALYSIS_LOAD_LABELS[best]} görevlerin ortalama ${kat} kat sürdü — planlarını buna göre ayarlıyorum.`;
}

/**
 * Canlı çalışma odaları — son 7 gün özeti (Profil > Çalışma Analizim satırı).
 * Hedef oranı yalnız cevaplanan oturumlardan: "Kısmen" yarım sayılır.
 * Oturum yoksa null (satır çizilmez).
 */
function analysisRoomWeek(sessions, nowMs) {
  const since = nowMs - 7 * _ANALYSIS_DAY_MS;
  const list = (Array.isArray(sessions) ? sessions : [])
    .filter(r => r && Number.isFinite(_analysisMs(r.joined_at)) && _analysisMs(r.joined_at) >= since);
  if (!list.length) return null;
  const seconds = list.reduce((t, r) => t + Math.max(0, Number(r.focus_seconds) || 0), 0);
  const answered = list.filter(r => ['yes', 'partly', 'no'].includes(r.goal_met));
  const score = answered.reduce((t, r) => t + (r.goal_met === 'yes' ? 1 : r.goal_met === 'partly' ? 0.5 : 0), 0);
  return {
    sessions: list.length,
    seconds,
    answered: answered.length,
    goalRate: answered.length ? Math.round((score / answered.length) * 100) : null
  };
}

/** 15600 → "4 sa 20 dk" */
function analysisRoomLine(week) {
  if (!week || !week.seconds) return '';
  const dk = Math.floor(week.seconds / 60);
  const sure = dk < 60 ? `${dk} dk` : (dk % 60 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${Math.floor(dk / 60)} sa`);
  const hedef = week.goalRate === null ? '' : `, hedeflerinin %${week.goalRate}'ine ulaştın`;
  return `Bu hafta canlı odalarda ${sure} odaklandın${hedef}.`;
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ANALYSIS_FORGOTTEN_MULT, ANALYSIS_FORGOTTEN_MAX_MIN, ANALYSIS_MIN_MEASURED_MIN,
    ANALYSIS_LOADS, ANALYSIS_LOAD_LABELS,
    analysisPlannedMinutes, analysisActiveSeconds,
    analysisTimerStart, analysisTimerPause,
    analysisCompletionPatch, analysisUncompletePatch,
    analysisSample, analysisFactors, analysisFocusSuggestion, analysisDailyStretches,
    analysisCalibration, analysisParseCalibration, analysisSameCalibration, analysisMailLine,
    analysisRoomWeek, analysisRoomLine
  };
}
