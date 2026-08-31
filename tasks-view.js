/* ══════════════════════════════════════════════════════════════
   FocusAid — Bugün ekranı görünüm katmanı
   DOM render + Supabase/GAPI çağrıları. Saf hesaplar tasks-logic.js'te.
   ══════════════════════════════════════════════════════════════ */

const TodayState = {
  rows: [], today: [], carried: [], timer: null, loaded: false,
  // Bu oturumda tamamlanan görev id'leri. Devreden bir görev tamamlandığında
  // filtreden düşüp listeden yok olmasın diye tutulur (bkz. splitTasks).
  sessionCompleted: new Set()
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

function taskRowHTML(task, todayISO) {
  const etiket = dayLabel(task.day, todayISO);
  // DEHB dostu no-guilt etiketleme: Suçluluk hissettirmeyen nötr rozet
  const rozet = etiket
    ? `<span class="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/30 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1"><span>⏳</span> ${etiket}</span>`
    : '';
  const kenar = YUK_KENAR[task.cognitive_load] || 'border-indigo-400 shadow-indigo-500/5';
  return `
    <div class="group flex items-center gap-3 py-3 px-4 bg-white/90 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border-l-[6px] ${kenar} border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md hover:translate-x-1.5 transition-all duration-200 ${task.completed ? 'opacity-40 grayscale-[40%]' : ''}">
      <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')"
             class="w-5 h-5 rounded-lg accent-indigo-600 cursor-pointer shrink-0 transition-transform active:scale-125">
      <span class="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 shrink-0 w-12 tabular-nums">${saatBaslangic(task)}</span>
      <p class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate flex-1 ${task.completed ? 'line-through' : ''}">${task.name || 'Görev'}</p>
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
  interval: null
};

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

  TaskTimerState.taskId = String(task.id);
  TaskTimerState.totalSeconds = durationMins * 60;
  TaskTimerState.remainingSeconds = durationMins * 60;
  TaskTimerState.isRunning = false;
  if (TaskTimerState.interval) clearInterval(TaskTimerState.interval);
  TaskTimerState.interval = null;
}

function toggleTaskTimer() {
  if (TaskTimerState.isRunning) {
    pauseTaskTimer();
  } else {
    startTaskTimer();
  }
}

function startTaskTimer() {
  if (TaskTimerState.isRunning) return;
  TaskTimerState.isRunning = true;
  getAudioContext();
  updateTimerUI();
  TaskTimerState.interval = setInterval(() => {
    if (TaskTimerState.remainingSeconds > 0) {
      TaskTimerState.remainingSeconds--;
      updateTimerUI();
      if (TaskTimerState.remainingSeconds === 0) {
        pauseTaskTimer();
        playTimerEndChime();
        fireDopamineConfetti(false);
        showToast('⏰ Odak seansı tamamlandı! Harika iş çıkardın.', 'success');
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('FocusAid — Odak Seansı Tamamlandı!', {
              body: 'Tebrikler! Seansın bitti. Mola verebilir veya görevi işaretleyebilirsin.',
              icon: 'dehb.png'
            });
          } catch(e) {}
        }
      }
    }
  }, 1000);
}

function pauseTaskTimer() {
  TaskTimerState.isRunning = false;
  if (TaskTimerState.interval) clearInterval(TaskTimerState.interval);
  TaskTimerState.interval = null;
  updateTimerUI();
}

function addBonusToTimer(minutes = 5) {
  TaskTimerState.totalSeconds += minutes * 60;
  TaskTimerState.remainingSeconds += minutes * 60;
  updateTimerUI();
  showToast(`+${minutes} dakika eklendi`, 'info');
}

function resetTaskTimer() {
  pauseTaskTimer();
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
    playBtn.innerHTML = TaskTimerState.isRunning
      ? '<span>⏸️</span> Duraklat'
      : '<span>▶️</span> Başlat';
    playBtn.className = TaskTimerState.isRunning
      ? 'px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all'
      : 'px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all';
  }
}

function currentCardHTML(task) {
  if (!task) {
    return `<div class="glass-card p-10 bg-white dark:bg-slate-800/90 text-center shadow-xl border-t-4 border-emerald-400 animate-slide-in">
              <div class="text-5xl mb-3 animate-bounce">🏆</div>
              <p class="font-extrabold text-2xl text-slate-800 dark:text-slate-100">Bugünlük bu kadar, harikasın!</p>
              <p class="text-slate-500 dark:text-slate-400 text-sm mt-2">Tüm odak seanslarını tamamladın. Kendine güzel bir mola ve ödül ısmarla! ☕✨</p>
            </div>`;
  }
  const yuk = YUK_ETIKET[task.cognitive_load] || '⚡ Odak';
  const rozetStil = YUK_ROZET[task.cognitive_load] || 'background:rgba(99,102,241,0.12);color:#4f46e5;border-color:rgba(99,102,241,0.25)';
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
            <button onclick="startInatModu('${task.id}', '${(task.name || 'Görevin').replace(/'/g, "\\'")}')" class="ml-auto px-3 py-1 rounded-xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-xs shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-1.5 animate-pulse" title="Başlama felcini kırmak için 3 dakikalık Boss dövüşü başlat!">
              <span>🥊</span> İnat Modu (3 Dk)
            </button>
          </div>
          <h3 class="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">${task.name || 'Görev'}</h3>
          ${task.summary ? `<p class="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">${task.summary}</p>` : ''}
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

  if (bos) { if (textEl) textEl.textContent = '0/0'; if (barEl) barEl.style.width = '0%'; return; }

  const { done, total } = computeProgress(TodayState.today, TodayState.carried);
  if (textEl) textEl.textContent = `${done}/${total}`;
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

  const currentTask = pickCurrentTask(hepsi, new Date());
  initTaskTimerForTask(currentTask);
  currentEl.innerHTML = currentCardHTML(currentTask);
  updateTimerUI();

  listEl.innerHTML = hepsi.map(t => taskRowHTML(t, todayISO)).join('');
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
  task.completed = yeniDurum;   // iyimser: UI hemen güncellenir
  // Devreden görev tamamlanınca listeden düşmesin diye oturum hafızasına al.
  if (yeniDurum) {
    TodayState.sessionCompleted.add(String(task.id));
    const { done, total } = computeProgress(TodayState.today, TodayState.carried);
    const isAllDone = done === total && total > 0;
    fireDopamineConfetti(isAllDone);
    if (isAllDone) playGrandVictoryChime();
    else playSuccessChime();
  } else {
    TodayState.sessionCompleted.delete(String(task.id));
  }
  renderToday();

  const { error } = await sb.from('tasks').update({ completed: yeniDurum }).eq('id', task.id);
  if (error) {
    task.completed = !yeniDurum;   // geri al
    if (yeniDurum) TodayState.sessionCompleted.delete(String(task.id));
    renderToday();
    showToast('Kaydedilemedi, tekrar dene.', 'error');
    return;
  }

  syncCalendarMark(task, yeniDurum);   // await YOK: ana akışı bekletmez
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
