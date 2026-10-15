/* ══════════════════════════════════════════════════════════════
   FocusAid — Bugün ekranı görünüm katmanı
   DOM render + Supabase/GAPI çağrıları. Saf hesaplar tasks-logic.js'te.
   ══════════════════════════════════════════════════════════════ */

const TodayState = {
  rows: [], today: [], carried: [], timer: null, loaded: false,
  // Bu oturumda tamamlanan görev id'leri. Devreden bir görev tamamlandığında
  // filtreden düşüp listeden yok olmasın diye tutulur (bkz. splitTasks).
  sessionCompleted: new Set(),
  tumListe: false          // Bunalma: kullanıcı "Tüm listeyi göster" dedi mi
};

/** rows'u bugün/devreden olarak böler ve state'e yazar. */
function refreshBuckets(todayISO) {
  const { today, carried } = splitTasks(TodayState.rows, todayISO, TodayState.sessionCompleted);
  TodayState.today = today;
  TodayState.carried = carried;
  return { today, carried };
}

async function initToday() {
  stopTodayTimer();
  await loadTasks();
  renderToday();
  TodayState.timer = setInterval(renderToday, 60000);
}

function stopTodayTimer() {
  if (TodayState.timer) { clearInterval(TodayState.timer); TodayState.timer = null; }
}

async function loadTasks() {
  if (!currentUser) { console.log('[Bugün] oturum henüz hazır değil, yükleme atlandı'); return; }
  const todayISO = localDayISO();
  const baslangic = addDaysISO(todayISO, -CARRY_OVER_DAYS);

  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .gte('day', baslangic)
    .lte('day', todayISO)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[Bugün] sorgu hatası:', error);
    showToast('Görevler yüklenemedi.', 'error');
    return;
  }

  TodayState.rows = data || [];
  const { today, carried } = refreshBuckets(todayISO);
  TodayState.loaded = true;

  console.log(`[Bugün] pencere ${baslangic} → ${todayISO} | gelen kayıt: ${TodayState.rows.length} | bugün: ${today.length} | devreden: ${carried.length}`);
  if (TodayState.rows.length === 0) {
    // Tablo boş mu, yoksa yalnızca bu tarih penceresi mi boş? Ayırt et.
    const { count, error: sayimHatasi } = await sb.from('tasks').select('*', { count: 'exact', head: true });
    console.log('[Bugün] tablodaki TOPLAM kayıt (tarih filtresiz):', count, sayimHatasi || '');
  }
}

function saatAralik(task) {
  const f = d => new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${f(task.start_time)} – ${f(task.end_time)}`;
}

const YUK_ETIKET = { low: '🌱 Hafif', medium: '⚡ Orta', high: '🔥 Ağır' };
const YUK_KENAR = {
  low: 'border-emerald-500 shadow-emerald-500/5',
  medium: 'border-amber-500 shadow-amber-500/5',
  high: 'border-rose-500 shadow-rose-500/5'
};
const YUK_ROZET = {
  low: 'background:rgba(16,185,129,0.12);color:#059669;border-color:rgba(16,185,129,0.25)',
  medium: 'background:rgba(245,158,11,0.12);color:#d97706;border-color:rgba(245,158,11,0.25)',
  high: 'background:rgba(244,63,94,0.12);color:#e11d48;border-color:rgba(244,63,94,0.25)'
};

function saatBaslangic(task) {
  return new Date(task.start_time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function _escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/** Profildeki engelin arayüz ayarları (karar profile-logic.js'te). */
function _engel() {
  return engelAyarlari(typeof userProfile !== 'undefined' ? userProfile : null);
}

function taskRowHTML(task, todayISO) {
  // DEHB dostu no-guilt etiketleme: Suçluluk hissettirmeyen nötr rozet;
  // Eleştiri korkusu seçenlerde tarih de yok (devredenEtiketi).
  const yumusak = _engel().yumusakDil;
  const etiket = devredenEtiketi(dayLabel(task.day, todayISO), yumusak);
  const rozet = etiket
    ? `<span class="text-[10px] font-bold ${yumusak ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/30' : 'text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/30'} px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">${_escape(etiket)}</span>`
    : '';
  const kenar = YUK_KENAR[task.cognitive_load] || 'border-indigo-400 shadow-indigo-500/5';
  return `
    <div class="group flex items-center gap-3 py-3 px-4 bg-white/90 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border-l-[6px] ${kenar} border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md hover:translate-x-1.5 transition-all duration-200 ${task.completed ? 'opacity-40 grayscale-[40%]' : ''}">
      <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${_escape(task.id)}')"
             class="w-5 h-5 rounded-lg accent-indigo-600 cursor-pointer shrink-0 transition-transform active:scale-125">
      <span class="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 shrink-0 w-12 tabular-nums">${saatBaslangic(task)}</span>
      <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate flex-1 ${task.completed ? 'line-through' : ''}">${_escape(task.name || 'Görev')}</p>
      ${rozet}
    </div>`;
}

// ── WEB AUDIO SENTEZLEYİCİ (0 KB, Yerel) ──
let _audioCtx = null;
function getAudioContext() {
  if (!_audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) _audioCtx = new AudioContextClass();
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

function isSoundEnabled() {
  const v = localStorage.getItem('focusaid_sound_enabled');
  return v === null ? true : v === 'true';
}

function toggleSound() {
  const next = !isSoundEnabled();
  localStorage.setItem('focusaid_sound_enabled', String(next));
  syncSoundToggleUI();
  showToast(next ? '🔊 Ses efektleri açıldı' : '🔇 Ses efektleri kapatıldı', 'info');
  if (next) playSuccessChime();
}

function syncSoundToggleUI() {
  const btn = document.getElementById('sound-toggle-btn');
  if (btn) btn.textContent = isSoundEnabled() ? 'Açık' : 'Kapalı';
}

function playSuccessChime() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Major arpeggio)
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + (i * 0.07);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  } catch (e) {
    console.warn('[Audio] ses çalınamadı:', e);
  }
}

function playGrandVictoryChime() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const chords = [
      { freq: 523.25, time: 0 },
      { freq: 659.25, time: 0 },
      { freq: 783.99, time: 0 },
      { freq: 1046.50, time: 0.18 },
      { freq: 1318.51, time: 0.18 },
      { freq: 1567.98, time: 0.36 }
    ];
    chords.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + time;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch (e) {
    console.warn('[Audio] zafer sesi çalınamadı:', e);
  }
}

function playTimerEndChime() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    [783.99, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + (i * 0.15);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  } catch (e) {}
}

// ── GÖRSEL DONUT SAYAÇ STATE & İŞLEMLERİ ──
const TaskTimerState = {
  taskId: null,
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  isRunning: false,
  interval: null,
  overtimeInterval: null,  // süre doldu ama ölçüm sürüyor: dakikalık güncelleme
  busy: false              // Başlat/Duraklat DB yazımı sürerken yeni dokunuşları yoksay
};

// ── ÖLÇÜM (çalışma analizi, 2026-10-12) ──
// Sayaç artık yalnız geri sayım değil: Başlat/Duraklat görev satırına yazılır
// (started_at, running_since, active_seconds, longest_stretch_sec) ve sayfa
// yenilense de kaldığı yerden sürer. Spec: 2026-10-12-calisma-analizi-kalibrasyon-design.md

function timerTask() {
  return TaskTimerState.taskId ? findTask(TaskTimerState.taskId) : null;
}
function timerMeasuring(task) {
  return !!(task && task.running_since);
}

/**
 * Yamayı task'a uygular ve DB'ye yazar. Hata olursa task'ı geri alır, false döner.
 * BAŞLATMA yaması (running_since dolu) koşullu yazılır: yalnız DB'de sayaç durmuşsa.
 * Bayat ikinci sekme bellekteki satıra bakıp running_since'i ezerse çalışılan süre
 * iki kez sayılırdı. 0 satır → başka sekme başlatmış: yerel yama geri alınır, satır
 * DB'den tazelenir ve sayaç onunla kurulur.
 */
async function persistTimerPatch(task, patch) {
  const keys = Object.keys(patch || {});
  if (!task || keys.length === 0) return true;
  const onceki = {};
  for (const k of keys) onceki[k] = task[k] ?? null;
  Object.assign(task, patch);
  if (typeof isGuestMode !== 'undefined' && isGuestMode) return true;
  const baslatma = patch.running_since != null;
  let sorgu = sb.from('tasks').update(patch).eq('id', task.id);
  if (baslatma) sorgu = sorgu.is('running_since', null).select('id');
  const { data, error } = await sorgu;
  if (error) {
    Object.assign(task, onceki);
    console.warn('[Sayaç] kaydedilemedi:', error.code, error.message);
    showToast('Sayaç kaydedilemedi.', 'error');
    return false;
  }
  if (baslatma && Array.isArray(data) && data.length === 0) {
    Object.assign(task, onceki);
    const { data: guncel, error: okumaHatasi } = await sb.from('tasks').select('*').eq('id', task.id).single();
    if (!okumaHatasi && guncel) Object.assign(task, guncel);
    showToast('Sayaç başka bir sekmede çalışıyor.', 'info');
    if (TaskTimerState.taskId === String(task.id)) {
      TaskTimerState.taskId = null;   // zorla yeniden kur: kalan süre DB'deki ölçümden
      initTaskTimerForTask(task);
    }
    return false;
  }
  return true;
}

function stopOvertime() {
  if (TaskTimerState.overtimeInterval) clearInterval(TaskTimerState.overtimeInterval);
  TaskTimerState.overtimeInterval = null;
}

/** Süre doldu satırı: sakin, dakikada bir. Ölçüm durmuşsa gizlenir. */
function updateOvertimeUI() {
  const el = document.getElementById('timer-overtime');
  if (!el) return;
  const task = timerTask();
  const planned = task ? analysisPlannedMinutes(task) : null;
  const aktifDk = task ? Math.floor(analysisActiveSeconds(task, Date.now()) / 60) : 0;
  const fazla = planned === null ? 0 : aktifDk - planned;
  if (TaskTimerState.remainingSeconds > 0 || fazla <= 0) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = fazlaSureMetni(fazla, _engel().yumusakDil);
  el.classList.remove('hidden');
}

function startOvertime() {
  stopOvertime();
  updateOvertimeUI();
  TaskTimerState.overtimeInterval = setInterval(updateOvertimeUI, 60000);
}

function initTaskTimerForTask(task) {
  if (!task) {
    resetTaskTimer();
    return;
  }
  if (TaskTimerState.taskId === String(task.id)) return;

  const start = new Date(task.start_time).getTime();
  const end = new Date(task.end_time).getTime();
  let durationMins = (!isNaN(start) && !isNaN(end) && end > start)
    ? Math.round((end - start) / 60000)
    : 25;
  if (durationMins <= 0 || durationMins > 180) durationMins = 25;

  if (TaskTimerState.interval) clearInterval(TaskTimerState.interval);
  stopOvertime();
  TaskTimerState.busy = false;
  TaskTimerState.taskId = String(task.id);
  TaskTimerState.totalSeconds = durationMins * 60;
  // Kayıtlı ölçüm varsa kaldığı yerden: kalan = toplam − çalışılmış.
  const calisilan = analysisActiveSeconds(task, Date.now());
  TaskTimerState.remainingSeconds = Math.max(0, durationMins * 60 - calisilan);
  TaskTimerState.isRunning = false;
  TaskTimerState.interval = null;

  if (timerMeasuring(task)) {
    // Başka sekmede / önceki açılışta başlatılmış: DB'ye yazmadan sürdür.
    if (TaskTimerState.remainingSeconds > 0) runCountdown();
    else startOvertime();
  }
}

function toggleTaskTimer() {
  if (TaskTimerState.busy) return;
  const olcuyor = TaskTimerState.isRunning || timerMeasuring(timerTask());
  if (olcuyor) pauseTaskTimer();
  else startTaskTimer();
}

/** Geri sayım döngüsü. DB'ye YAZMAZ (yalnız ekran). */
function runCountdown() {
  if (TaskTimerState.isRunning) return;
  TaskTimerState.isRunning = true;
  stopOvertime();
  updateTimerUI();
  TaskTimerState.interval = setInterval(() => {
    if (TaskTimerState.remainingSeconds > 0) {
      TaskTimerState.remainingSeconds--;
      updateTimerUI();
      if (TaskTimerState.remainingSeconds === 0) {
        // Geri sayım biter, ÖLÇÜM SÜRER: kullanıcı çalışmaya devam ediyor olabilir.
        TaskTimerState.isRunning = false;
        clearInterval(TaskTimerState.interval);
        TaskTimerState.interval = null;
        playTimerEndChime();
        fireDopamineConfetti(false);
        showToast('⏰ Odak seansı tamamlandı! Harika iş çıkardın.', 'success');

        // 🔔 Arka Plan Bildirimi Gönder
        if (typeof NotificationManager !== 'undefined') {
          NotificationManager.notifySessionComplete();
        }
        if (timerMeasuring(timerTask())) startOvertime();
        updateTimerUI();
        yeterinceIyiKartiGoster(timerTask());
      }
    }
  }, 1000);
}

async function startTaskTimer() {
  if (TaskTimerState.isRunning) return;
  getAudioContext();
  // 🔔 Bildirim izni sor (ilk başlatmada)
  if (typeof NotificationManager !== 'undefined' && NotificationManager.isSupported && Notification.permission === 'default') {
    NotificationManager.requestPermission();
  }
  const task = timerTask();
  if (task) {
    TaskTimerState.busy = true;
    try {
      const ok = await persistTimerPatch(task, analysisTimerStart(task, Date.now()));
      if (!ok) { updateTimerUI(); return; }
    } finally {
      TaskTimerState.busy = false;
    }
    // Yazım sürerken görev değiştiyse ya da ölçüm başka yoldan durduysa sayaç başlatma.
    if (timerTask() !== task || !timerMeasuring(task)) { updateTimerUI(); return; }
  }
  if (TaskTimerState.remainingSeconds > 0) runCountdown();
  else { startOvertime(); updateTimerUI(); }
  if (task) calismaModuOnerisiGoster(task);
}

// ── Çalışma Modu önerisi (profil "Çalışma Modu") ──
// Karar profile-logic.js'teki calismaModuOnerisi'nde (testli); burada yalnız DOM.
// Aynı görev için oturumda bir kez; "Bugün gösterme" o gün susturur.
const _modOnerisiGosterilen = new Set();

function _modOnerisiAnahtari() {
  return `focusaid_mod_onerisi_${(typeof currentUser !== 'undefined' && currentUser?.id) || 'misafir'}`;
}

function calismaModuOnerisiGoster(task) {
  const id = String(task.id);
  if (_modOnerisiGosterilen.has(id)) return;
  const bugun = localDayISO();
  try { if (localStorage.getItem(_modOnerisiAnahtari()) === bugun) return; } catch (e) {}
  _modOnerisiGosterilen.add(id);

  const ses = window.FocusAudio;
  const oneri = calismaModuOnerisi(typeof userProfile !== 'undefined' ? userProfile : null,
                                   { sesCaliyor: !!(ses && ses.isPlaying) });
  let oncekiSesModu = null;
  if (oneri.lofiAc && ses) { oncekiSesModu = ses.currentMode; ses.setMode('lofi', true); }

  const eylemler = {
    odalar: () => loadPage('study-rooms'),
    kafe: () => { loadPage('study-rooms'); if (typeof odayaGir === 'function') odayaGir('lofi-kafe'); },
    'sesi-kapat': () => { if (ses) { ses.stop(); if (oncekiSesModu) ses.setMode(oncekiSesModu); } },
    park: () => { if (typeof openBrainDump === 'function') openBrainDump(); }
  };
  altKartGoster('mod-onerisi', oneri.metin,
    oneri.eylemler.map(e => ({ etiket: e.etiket, is: eylemler[e.id] || (() => {}) })),
    { sustur: () => { try { localStorage.setItem(_modOnerisiAnahtari(), bugun); } catch (e) {} } });
}

/**
 * Ekranın altında kısa süreli öneri kartı (body seviyesinde: şablon içine
 * fixed öğe koyma kuralı). İlk düğme ana renkte; sona hep "Kapat" eklenir.
 * `sustur` verilirse sağda "Bugün gösterme" bağlantısı çıkar.
 */
function altKartGoster(id, metinYazi, dugmeler, { sustur = null, sureMs = 15000 } = {}) {
  document.getElementById(id)?.remove();
  const kart = document.createElement('div');
  kart.id = id;
  kart.setAttribute('role', 'status');
  kart.className = 'fixed bottom-6 inset-x-0 mx-auto z-50 w-[calc(100%-2rem)] max-w-md p-4 rounded-2xl shadow-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 animate-slide-in';
  const metin = document.createElement('p');
  metin.className = 'text-sm font-semibold text-slate-700 dark:text-slate-100 mb-3';
  metin.textContent = metinYazi;
  const satir = document.createElement('div');
  satir.className = 'flex flex-wrap items-center gap-2';
  kart.append(metin, satir);

  let zamanlayici = null;
  const kapat = () => { clearTimeout(zamanlayici); kart.remove(); };
  const ANA = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 transition-all';
  const IKINCIL = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 active:scale-95 transition-all';
  [...dugmeler, { etiket: 'Kapat', is: () => {} }].forEach((d, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = i === 0 && dugmeler.length ? ANA : IKINCIL;
    b.textContent = d.etiket;
    b.addEventListener('click', () => { kapat(); d.is(); });
    satir.appendChild(b);
  });
  if (sustur) {
    const sb = document.createElement('button');
    sb.type = 'button';
    sb.className = 'ml-auto text-[11px] font-medium text-slate-400 hover:text-slate-600 underline';
    sb.textContent = 'Bugün gösterme';
    sb.addEventListener('click', () => { sustur(); kapat(); });
    satir.appendChild(sb);
  }

  document.body.appendChild(kart);
  zamanlayici = setTimeout(kapat, sureMs);
}

/** Mükemmeliyetçilik: süre dolunca "yeterince iyi, bitir" (görev başına bir kez). */
const _yeterinceIyiGosterilen = new Set();
function yeterinceIyiKartiGoster(task) {
  if (!task || task.completed || !_engel().yeterinceIyi) return;
  const id = String(task.id);
  if (_yeterinceIyiGosterilen.has(id)) return;
  _yeterinceIyiGosterilen.add(id);
  altKartGoster('yeterince-iyi', '💎 Süre doldu. Şu hâli yeterince iyi — bitirmek de bir beceri.', [
    { etiket: '✓ Bitir ve işaretle', is: () => toggleTask(id) },
    { etiket: '+5 dk', is: () => addBonusToTimer(5) }
  ], { sureMs: 60000 });
}

async function pauseTaskTimer() {
  TaskTimerState.isRunning = false;
  if (TaskTimerState.interval) clearInterval(TaskTimerState.interval);
  TaskTimerState.interval = null;
  stopOvertime();
  updateTimerUI();
  updateOvertimeUI();
  const task = timerTask();
  if (task && timerMeasuring(task)) {
    TaskTimerState.busy = true;
    try {
      const ok = await persistTimerPatch(task, analysisTimerPause(task, Date.now()));
      if (!ok && timerTask() === task) {
        // DB'de hâlâ çalışıyor: ekranı da çalışır göster.
        if (TaskTimerState.remainingSeconds > 0) runCountdown(); else startOvertime();
      }
    } finally {
      TaskTimerState.busy = false;
    }
    updateTimerUI();
  }
}

function addBonusToTimer(minutes = 5) {
  TaskTimerState.totalSeconds += minutes * 60;
  TaskTimerState.remainingSeconds += minutes * 60;
  // Süre dolmuş ama ölçüm sürüyorsa saat donmasın: geri sayımı yeniden başlat (DB'ye yazmaz).
  if (!TaskTimerState.isRunning && timerMeasuring(timerTask()) && TaskTimerState.remainingSeconds > 0) runCountdown();
  updateTimerUI();
  showToast(`+${minutes} dakika eklendi`, 'info');
}

function resetTaskTimer() {
  TaskTimerState.isRunning = false;
  if (TaskTimerState.interval) clearInterval(TaskTimerState.interval);
  TaskTimerState.interval = null;
  stopOvertime();
  TaskTimerState.busy = false;
  TaskTimerState.taskId = null;
  TaskTimerState.totalSeconds = 25 * 60;
  TaskTimerState.remainingSeconds = 25 * 60;
}

function formatTimerSeconds(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerUI() {
  const timeText = document.getElementById('timer-time-display');
  const circle = document.getElementById('timer-donut-circle');
  const playBtn = document.getElementById('timer-play-btn');
  if (!timeText || !circle) return;

  timeText.textContent = formatTimerSeconds(TaskTimerState.remainingSeconds);
  const circumference = 251.32;
  const progress = TaskTimerState.totalSeconds > 0
    ? (TaskTimerState.remainingSeconds / TaskTimerState.totalSeconds)
    : 0;
  const offset = circumference - (progress * circumference);
  circle.style.strokeDashoffset = String(offset);

  if (playBtn) {
    const olcuyor = TaskTimerState.isRunning || timerMeasuring(timerTask());
    playBtn.innerHTML = olcuyor
      ? '<span>⏸️</span> Duraklat'
      : '<span>▶️</span> Başlat';
    playBtn.className = olcuyor
      ? 'px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all'
      : 'px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all';
  }
  updateOvertimeUI();
}

function currentCardHTML(task) {
  if (!task) {
    const odul = typeof bugununCarkOdulunuAl === 'function' ? bugununCarkOdulunuAl() : null;
    return `
      <div class="glass-card p-8 md:p-10 bg-gradient-to-br from-amber-500/10 via-indigo-500/10 to-purple-500/10 dark:from-slate-800/95 dark:to-slate-900/95 text-center shadow-2xl border-2 border-amber-400/50 rounded-3xl animate-slide-in space-y-4">
        <div class="text-6xl mb-2 animate-bounce">🏆 🎡 🏆</div>
        <span class="px-3 py-1 bg-amber-400/20 text-amber-600 dark:text-amber-300 text-xs font-black rounded-full uppercase tracking-widest">
          Tüm Hedefler Bitti!
        </span>
        <h3 class="font-black text-2xl md:text-3xl text-slate-900 dark:text-white tracking-tight">Bugünlük bu kadar, harikasın!</h3>
        <p class="text-slate-600 dark:text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
          ${odul
            ? `Bugünün ödülünü kazandın: <b>${escapeHtml(odul)}</b>. Çark yarın yeniden açılacak.`
            : 'Tüm odak seanslarını başarıyla tamamladın. Vicdan azabı yok, ertelenmiş yığınlar yok! Şimdi hak ettiğin ödülü almak için çarkı çevir.'}
        </p>
        <button onclick="openDopaminCarki()" class="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-base md:text-lg shadow-xl shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 mx-auto${odul ? '' : ' animate-pulse'}">
          ${odul ? '<span>🎁</span> Ödülümü Göster' : '<span>🎡</span> Dopamin Şans Çarkını Çevir!'}
        </button>
      </div>`;
  }
  const yuk = YUK_ETIKET[task.cognitive_load] || '⚡ Odak';
  const rozetStil = YUK_ROZET[task.cognitive_load] || 'background:rgba(99,102,241,0.12);color:#4f46e5;border-color:rgba(99,102,241,0.25)';
  // Başlama Felci seçenlerde öne çıkar, diğerlerinde sakin (karar profile-logic.js'te).
  const inatStil = inatModuOneCikar(typeof userProfile !== 'undefined' ? userProfile : null)
    ? 'bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-md shadow-rose-500/20 animate-pulse'
    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200';
  const yukRozet = `<span class="adhd-badge text-xs px-3 py-1 font-bold" style="${rozetStil}">${yuk}</span>`;

  return `
    <div class="glass-card p-8 md:p-10 bg-white/95 dark:bg-slate-800/90 shadow-2xl border-l-[8px] border-indigo-600 space-y-6 animate-slide-in relative overflow-hidden group">
      <div class="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        <!-- Sol: Görev Detayları -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span></span>
            <p class="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Şu Anda Odaklan</p>
            <div class="ml-2">${yukRozet}</div>
            <button onclick="startInatModu('${task.id}', '${(task.name || 'Görevin').replace(/'/g, "\\'")}')" class="ml-auto px-3 py-1 rounded-xl font-black text-xs active:scale-95 transition-all flex items-center gap-1.5 ${inatStil}" title="Başlama felcini kırmak için 3 dakikalık Boss dövüşü başlat!">
              <span>🥊</span> İnat Modu (3 Dk)
            </button>
            <button onclick="openBrainDump()" class="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs active:scale-95 transition-all flex items-center gap-1.5 shadow-sm" title="Aklına gelen rastgele bir düşünceyi park et (Kısayol: Alt + D)">
              <span>🧠</span> Düşünce Parkı
            </button>
          </div>
          <h3 class="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">${_escape(task.name || 'Görev')}</h3>
          ${task.summary ? `<p class="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">${_escape(task.summary)}</p>` : ''}
          <div class="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 text-indigo-600 dark:text-indigo-300 text-xs font-bold font-mono">
            <span>🕐</span> ${saatAralik(task)}
          </div>
        </div>

        <!-- Sağ: Görsel Donut Sayaç -->
        <div class="flex items-center gap-4 shrink-0 bg-slate-50/80 dark:bg-slate-700/40 p-4 rounded-3xl border border-slate-100 dark:border-white/5 shadow-inner">
          <div class="relative w-24 h-24 flex items-center justify-center">
            <svg class="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="currentColor" stroke-width="8" class="text-slate-200 dark:text-slate-700" fill="transparent" />
              <circle id="timer-donut-circle" cx="50" cy="50" r="40" stroke="url(#timer-gradient)" stroke-width="8" stroke-dasharray="251.32" stroke-dashoffset="0" stroke-linecap="round" fill="transparent" class="transition-all duration-300" />
              <defs>
                <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#6366f1" />
                  <stop offset="100%" stop-color="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span id="timer-time-display" class="font-mono font-black text-sm tracking-tight text-slate-800 dark:text-slate-100">25:00</span>
              <span class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Kalan</span>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <button id="timer-play-btn" onclick="toggleTaskTimer()" class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
              <span>▶️</span> Başlat
            </button>
            <button onclick="addBonusToTimer(5)" class="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-200/80 dark:bg-slate-600/50 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 active:scale-95 transition-all">
              +5 Dk
            </button>
            <span id="timer-overtime" class="hidden text-[11px] font-medium text-slate-400 dark:text-slate-500"></span>
          </div>
        </div>

      </div>

      <!-- Alt Butonlar -->
      <div class="flex gap-4 pt-2">
        <button onclick="toggleTask('${task.id}')" class="flex-[2] bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white py-4 px-6 rounded-2xl font-bold shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 text-base">
          <span>✓</span> Tamamlandı
        </button>
        <button onclick="snoozeTask('${task.id}')" class="flex-1 bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 px-6 py-4 rounded-2xl font-bold border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all text-sm">
          Sonraya al
        </button>
      </div>
    </div>`;
}

function victoriesCardHTML(tasks) {
  if (typeof computeVictories !== 'function') return '';
  const v = computeVictories(tasks);
  if (v.count === 0) return '';
  return `
    <div class="glass-card p-6 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-emerald-500/5 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-emerald-950/30 border border-indigo-200/50 dark:border-indigo-800/40 rounded-3xl shadow-lg mt-6 space-y-4 animate-slide-in">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <span class="text-2xl">🏆</span>
          <div>
            <h4 class="text-base font-extrabold text-slate-900 dark:text-white">Bugünün Zaferleri</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400">İlerledin ve başardın — hiçbir çaba boşa gitmez!</p>
          </div>
        </div>
        <span class="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black rounded-full border border-emerald-500/20">
          ${v.count} Görev Tamamlandı
        </span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        <div class="p-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/5">
          <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Toplam Odak</p>
          <p class="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">${v.totalMinutes} <span class="text-xs font-bold text-slate-500">dk</span></p>
        </div>
        <div class="p-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/5">
          <p class="text-[10px] font-black uppercase tracking-wider text-rose-500">🔥 Ağır Seanslar</p>
          <p class="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">${v.loads.high}</p>
        </div>
        <div class="p-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/5">
          <p class="text-[10px] font-black uppercase tracking-wider text-amber-500">⚡ Orta Seanslar</p>
          <p class="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">${v.loads.medium}</p>
        </div>
        <div class="p-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/5">
          <p class="text-[10px] font-black uppercase tracking-wider text-emerald-500">🌱 Hafif Seanslar</p>
          <p class="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${v.loads.low}</p>
        </div>
      </div>
    </div>`;
}

function fireDopamineConfetti(isGrandCelebration = false) {
  if (typeof confetti !== 'function') return;
  try {
    if (isGrandCelebration) {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 250);
    } else {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.75 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#38bdf8']
      });
    }
  } catch (e) {
    console.warn('[Confetti] tetiklenemedi:', e);
  }
}

/** Profildeki ödül notunu Bugün'de hedef olarak gösterir (metin tasks-logic.js'te). */
function odulSatiriniYaz(done, total) {
  const el = document.getElementById('today-odul');
  if (!el) return;
  const not = typeof userProfile !== 'undefined' && userProfile ? userProfile.motivationNote : '';
  const satir = odulSatiri(not, done, total);
  el.textContent = satir || '';
  el.classList.toggle('hidden', !satir);
}

function renderToday() {
  const emptyEl = document.getElementById('today-empty');
  const listEl = document.getElementById('today-list');
  const currentEl = document.getElementById('today-current');
  const barEl = document.getElementById('today-progress-bar');
  const textEl = document.getElementById('today-progress-text');
  const victoriesEl = document.getElementById('today-victories');
  if (!emptyEl || !listEl || !currentEl) return;

  const todayISO = localDayISO();
  const hepsi = [...TodayState.carried, ...TodayState.today];
  const bos = hepsi.length === 0;

  emptyEl.classList.toggle('hidden', !bos);
  listEl.classList.toggle('hidden', bos);
  currentEl.classList.toggle('hidden', bos);
  if (victoriesEl) victoriesEl.innerHTML = victoriesCardHTML(hepsi);

  if (bos) { if (textEl) textEl.textContent = '0/0'; if (barEl) barEl.style.width = '0%'; odulSatiriniYaz(0, 0); return; }

  const { done, total } = computeProgress(TodayState.today, TodayState.carried);
  if (textEl) textEl.textContent = `${done}/${total}`;
  odulSatiriniYaz(done, total);
  if (barEl) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    barEl.style.width = `${pct}%`;
    if (pct === 100) {
      barEl.classList.add('bg-emerald-500');
      barEl.classList.remove('bg-indigo-500');
    } else {
      barEl.classList.add('bg-indigo-500');
      barEl.classList.remove('bg-emerald-500');
    }
  }

  const currentTask = pickTimerTask(hepsi, new Date());   // ölçülen görev kartta kalır
  initTaskTimerForTask(currentTask);
  currentEl.innerHTML = currentCardHTML(currentTask);
  updateTimerUI();

  // Bunalma seçenlerde liste düğmenin arkasında: yalnız sıradaki görev görünür.
  if (_engel().sadeceSiradaki && !TodayState.tumListe) {
    const kalan = hepsi.filter(t => !t.completed).length;
    listEl.innerHTML = `
      <button id="tum-liste-btn" onclick="tumListeyiGoster()" class="w-full py-3 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-300 bg-white/70 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 transition-all">
        📋 Tüm listeyi göster (${kalan} görev kaldı)
      </button>`;
    return;
  }
  listEl.innerHTML = hepsi.map(t => taskRowHTML(t, todayISO)).join('');
}

function tumListeyiGoster() {
  TodayState.tumListe = true;
  renderToday();
}

// ── TEK TIKLA GÜNÜ YENİDEN DENGELE ───────────────────────────────────────────
async function rebalanceTodayTasks() {
  if (!currentUser) return;
  const pending = (TodayState.today || []).filter(t => !t.completed);
  if (pending.length === 0) {
    showToast('Yeniden dengelenecek tamamlanmamış görev yok.', 'info');
    return;
  }

  const profile = JSON.parse(localStorage.getItem('focusaid_profile') || '{}');
  const now = new Date();
  const rebalanced = rebalanceSchedule(pending, now, profile);

  // Yerel satırları hemen güncelle (iyimser)
  for (const item of rebalanced) {
    const t = findTask(item.id);
    if (t) {
      t.start_time = item.start_time;
      t.end_time = item.end_time;
      t.day = item.day;
    }
  }
  const todayISO = localDayISO();
  refreshBuckets(todayISO);
  renderToday();
  showToast('⏰ Kalan görevler şu andan itibaren yeniden dizildi!', 'success');
  playSuccessChime();

  // Supabase ve GCal arka planda güncellenir
  try {
    for (const item of rebalanced) {
      await sb.from('tasks')
        .update({ start_time: item.start_time, end_time: item.end_time, day: item.day })
        .eq('id', item.id);
      
      if (item.calendar_event_id && AppState.googleAccessToken && AppState.gapiReady) {
        gapi.client.calendar.events.patch({
          calendarId: 'primary',
          eventId: item.calendar_event_id,
          resource: {
            start: { dateTime: item.start_time, timeZone: CONFIG.TIMEZONE },
            end: { dateTime: item.end_time, timeZone: CONFIG.TIMEZONE }
          }
        }).catch(e => console.warn('GCal kaydırma hatası:', e));
      }
    }
    AppState.calendar?.refetchEvents();
  } catch (e) {
    console.error('Yeniden dengeleme hatası:', e);
  }
}

// ── TAMAMLAMA ────────────────────────────────────────────────────────────────
function findTask(id) {
  return TodayState.rows.find(t => String(t.id) === String(id));
}

async function toggleTask(id) {
  const task = findTask(id);
  if (!task) return;

  const yeniDurum = !task.completed;
  // Ölçüm yaması (çalışma analizi): tamamlarken sayaç durur ve gerçek süre yazılır;
  // geri alırken sonuç alanları temizlenir, sayaç alanları korunur.
  const nowMs = Date.now();
  const { patch: olcum, needsFeedback } = yeniDurum
    ? analysisCompletionPatch(task, nowMs)
    : { patch: analysisUncompletePatch(), needsFeedback: false };
  const onceki = {};
  for (const k of Object.keys(olcum)) onceki[k] = task[k] ?? null;

  if (yeniDurum && TaskTimerState.taskId === String(task.id)) resetTaskTimer();
  task.completed = yeniDurum;   // iyimser: UI hemen güncellenir
  Object.assign(task, olcum);
  // Devreden görev tamamlanınca listeden düşmesin diye oturum hafızasına al.
  if (yeniDurum) {
    TodayState.sessionCompleted.add(String(task.id));
    const { done, total } = computeProgress(TodayState.today, TodayState.carried);
    const isAllDone = done === total && total > 0;
    fireDopamineConfetti(isAllDone);
    if (isAllDone) {
      playGrandVictoryChime();
      // Bugünün ödülü zaten kazanıldıysa çark kendiliğinden açılmaz
      // (görevi işaretleyip kaldırarak yeniden açtırma yolu kapansın).
      const zatenKazanildi = typeof bugununCarkOdulunuAl === 'function' && bugununCarkOdulunuAl();
      if (typeof openDopaminCarki === 'function' && !zatenKazanildi) {
        setTimeout(openDopaminCarki, 700);
      }
    } else {
      playSuccessChime();
    }
  } else {
    TodayState.sessionCompleted.delete(String(task.id));
  }
  renderToday();

  const { error } = await sb.from('tasks').update({ completed: yeniDurum, ...olcum }).eq('id', task.id);
  if (error) {
    task.completed = !yeniDurum;   // geri al
    Object.assign(task, onceki);
    if (yeniDurum) TodayState.sessionCompleted.delete(String(task.id));
    renderToday();
    showToast('Kaydedilemedi, tekrar dene.', 'error');
    return;
  }

  syncCalendarMark(task, yeniDurum);   // await YOK: ana akışı bekletmez
  if (yeniDurum && needsFeedback) showDurationFeedback(task);
  if (!yeniDurum) hideDurationFeedback();
  if (typeof analysisRefresh === 'function') analysisRefresh();   // await YOK
}

// ── SÜRE SORUSU (zamanlayıcı kullanılmadıysa) ──
// Tek dokunuş, atlanabilir, 8 sn sonra kendiliğinden kapanır. Cevap yoksa
// duration_feedback NULL kalır — kullanıcıyı zorlamak veriyi bozmaktan beter.
const DURATION_FEEDBACK_MS = 8000;
let _durationFeedbackTimer = null;

function hideDurationFeedback() {
  if (_durationFeedbackTimer) clearTimeout(_durationFeedbackTimer);
  _durationFeedbackTimer = null;
  document.getElementById('duration-feedback')?.remove();
}

function showDurationFeedback(task) {
  hideDurationFeedback();
  if (typeof isGuestMode !== 'undefined' && isGuestMode) return;
  const el = document.createElement('div');
  el.id = 'duration-feedback';
  el.className = 'fixed inset-x-0 bottom-6 mx-auto w-fit max-w-[calc(100%-2rem)] z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 shadow-lg text-sm text-slate-600 dark:text-slate-300';
  const id = _escape(task.id);
  el.innerHTML = `
    <span>Tahminden</span>
    <button onclick="answerDurationFeedback('${id}','shorter')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">kısa</button>
    <button onclick="answerDurationFeedback('${id}','same')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">aynı</button>
    <button onclick="answerDurationFeedback('${id}','longer')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">uzun</button>
    <span>sürdü</span>
    <button onclick="hideDurationFeedback()" aria-label="Atla" class="ml-1 text-slate-400 hover:text-slate-600">✕</button>`;
  document.body.appendChild(el);
  _durationFeedbackTimer = setTimeout(hideDurationFeedback, DURATION_FEEDBACK_MS);
}

async function answerDurationFeedback(id, value) {
  hideDurationFeedback();
  const task = findTask(id);
  if (!task || !['shorter', 'same', 'longer'].includes(value)) return;
  task.duration_feedback = value;
  const { error } = await sb.from('tasks').update({ duration_feedback: value }).eq('id', task.id);
  if (error) {
    task.duration_feedback = null;
    showToast('Kaydedilemedi.', 'error');
    return;
  }
  if (typeof analysisRefresh === 'function') analysisRefresh();
}

// ── TAKVİM SENKRONU (best-effort) ────────────────────────────────────────────
/** Takvim etkinliğini işaretler. Hata YUTULUR, çağıran akış bozulmaz. */
async function syncCalendarMark(task, done) {
  if (!task.calendar_event_id) return;
  if (!AppState.googleAccessToken || !AppState.gapiReady) {
    showToast('Görev kaydedildi, takvim bağlı değil.', 'info');
    return;
  }
  try {
    const temizAd = (task.name || 'Görev').replace(/^✓\s*/, '');
    await gapi.client.calendar.events.patch({
      calendarId: 'primary',
      eventId: task.calendar_event_id,
      resource: done
        ? { summary: '✓ ' + temizAd, colorId: '10' }   // 10 = yeşil
        : { summary: temizAd, colorId: null }
    });
    AppState.calendar?.refetchEvents();
  } catch (e) {
    console.warn('Takvim güncellenemedi:', e);
    showToast('Görev kaydedildi, takvim güncellenemedi.', 'info');
  }
}

// ── ERTELEME ─────────────────────────────────────────────────────────────────
async function snoozeTask(id) {
  const task = findTask(id);
  if (!task) return;

  const profile = JSON.parse(localStorage.getItem('focusaid_profile') || '{}');
  const yeni = computeSnooze(task, profile);

  const eski = { start_time: task.start_time, end_time: task.end_time, day: task.day };
  Object.assign(task, yeni);   // iyimser
  const todayISO = localDayISO();
  refreshBuckets(todayISO);
  renderToday();

  const { error } = await sb.from('tasks')
    .update({ start_time: yeni.start_time, end_time: yeni.end_time, day: yeni.day })
    .eq('id', task.id);

  if (error) {
    Object.assign(task, eski);   // geri al
    refreshBuckets(todayISO);
    renderToday();
    showToast('Ertelenemedi, tekrar dene.', 'error');
    return;
  }

  snoozeCalendarEvent(task, yeni);
  const dk = (profile.focusPeriod ?? 25) + (BREAK_MAP[profile.breakStyle] ?? 15);
  showToast(`${dk} dakika sonraya alındı.`, 'success');
}

/** Takvim etkinliğini kaydırır. Best-effort: hata YUTULUR. */
async function snoozeCalendarEvent(task, yeni) {
  if (!task.calendar_event_id) return;
  if (!AppState.googleAccessToken || !AppState.gapiReady) return;
  try {
    await gapi.client.calendar.events.patch({
      calendarId: 'primary',
      eventId: task.calendar_event_id,
      resource: {
        start: { dateTime: yeni.start_time, timeZone: CONFIG.TIMEZONE },
        end:   { dateTime: yeni.end_time,   timeZone: CONFIG.TIMEZONE }
      }
    });
    AppState.calendar?.refetchEvents();
  } catch (e) {
    console.warn('Takvim etkinliği kaydırılamadı:', e);
  }
}
