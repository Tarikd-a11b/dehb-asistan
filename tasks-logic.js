/* ══════════════════════════════════════════════════════════════
   FocusAid — Bugün ekranı saf mantık katmanı
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   Testler: node --test test/
   ══════════════════════════════════════════════════════════════ */

// n8n "Code in JavaScript" node'undaki breakMap ile BİREBİR AYNI olmalı.
// Biri değişirse diğeri de güncellenmeli (bkz. spec: Sonraya al).
const BREAK_MAP = { pomodoro: 5, 'long-break': 15, micro: 2, free: 0 };

const DEFAULT_FOCUS_PERIOD = 25;
const DEFAULT_BREAK_MINUTES = 15;
const CARRY_OVER_DAYS = 3;

/** Yerel saate göre 'YYYY-MM-DD'. toISOString() UTC verdiği için kullanılmaz. */
function localDayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  return localDayISO(new Date(y, m - 1, d + delta));
}

/** Bugünün görevleri (hepsi) + geçmişten devreden tamamlanmamışlar. */
function splitTasks(rows, todayISO) {
  const list = rows || [];
  return {
    today:   list.filter(r => r.day === todayISO),
    carried: list.filter(r => r.day < todayISO && !r.completed)
  };
}

/** Sıradaki görev: aktif olan → gelecekteki ilk → en erken gecikmiş → null */
function pickCurrentTask(tasks, now) {
  const pending = (tasks || [])
    .filter(t => !t.completed)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  if (!pending.length) return null;

  const active = pending.find(t => new Date(t.start_time) <= now && now < new Date(t.end_time));
  if (active) return active;

  const future = pending.find(t => new Date(t.start_time) > now);
  if (future) return future;

  return pending[0];
}

/** İlerleme paydası: bugün + devredenler (spec: Ekran anatomisi). */
function computeProgress(today, carried) {
  const all = [...(today || []), ...(carried || [])];
  return { done: all.filter(t => t.completed).length, total: all.length };
}

/** Nötr gün etiketi. Kırmızı/uyarı dili kullanılmaz (RSD koruması). */
function dayLabel(dayISO, todayISO) {
  const [ay, am, ad] = dayISO.split('-').map(Number);
  const [by, bm, bd] = todayISO.split('-').map(Number);
  const fark = Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
  if (fark <= 0) return '';
  if (fark === 1) return 'dün';
  return `${fark} gün önce`;
}

function _toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

/** Erteleme: bir tam odak bloğu kadar (odak + mola). n8n'deki step ile aynı. */
function computeSnooze(task, profile) {
  const p = profile || {};
  const focusPeriod = p.focusPeriod ?? DEFAULT_FOCUS_PERIOD;
  const breakMinutes = BREAK_MAP[p.breakStyle] ?? DEFAULT_BREAK_MINUTES;
  const snoozeMinutes = focusPeriod + breakMinutes;

  const start = new Date(task.start_time);
  const end = new Date(task.end_time);
  const durationMs = end - start;

  let newStart = new Date(start.getTime() + snoozeMinutes * 60000);

  const workEnd = _toMinutes(p.workHours?.end ?? '18:00');
  if (newStart.getHours() * 60 + newStart.getMinutes() > workEnd) {
    const workStart = _toMinutes(p.workHours?.start ?? '09:00');
    newStart = new Date(
      start.getFullYear(), start.getMonth(), start.getDate() + 1,
      Math.floor(workStart / 60), workStart % 60, 0, 0
    );
  }

  return {
    start_time: newStart.toISOString(),
    end_time: new Date(newStart.getTime() + durationMs).toISOString(),
    day: localDayISO(newStart)
  };
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BREAK_MAP, CARRY_OVER_DAYS,
    localDayISO, addDaysISO, splitTasks, pickCurrentTask,
    computeProgress, dayLabel, computeSnooze
  };
}
