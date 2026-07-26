/* ══════════════════════════════════════════════════════════════
   FocusAid — Bugün ekranı görünüm katmanı
   DOM render + Supabase/GAPI çağrıları. Saf hesaplar tasks-logic.js'te.
   ══════════════════════════════════════════════════════════════ */

const TodayState = { rows: [], today: [], carried: [], timer: null };

async function initToday() {
  stopTodayTimer();
  renderToday();
}

function stopTodayTimer() {
  if (TodayState.timer) { clearInterval(TodayState.timer); TodayState.timer = null; }
}

function renderToday() {
  const emptyEl = document.getElementById('today-empty');
  const listEl = document.getElementById('today-list');
  const currentEl = document.getElementById('today-current');
  if (!emptyEl || !listEl || !currentEl) return;

  const hepsi = [...TodayState.today, ...TodayState.carried];
  const bos = hepsi.length === 0;
  emptyEl.classList.toggle('hidden', !bos);
  listEl.classList.toggle('hidden', bos);
  currentEl.classList.toggle('hidden', bos);
}
