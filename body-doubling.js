/* ══════════════════════════════════════════════════════════════
   FocusAid — 👥 Sanal Body Doubling (Sanal Çalışma Arkadaşı)
   DEHB kullanıcıları için yalnız çalışmanın getirdiği ertelemeyi
   kıran, ekranda sessizce odaklanan sevimli çalışma partneri.
   ══════════════════════════════════════════════════════════════ */

const BodyDoublingState = {
  isEnabled: true,
  companionName: 'Sherlock',
  status: 'idle', // 'idle', 'working', 'break'
  bubbleTimer: null
};

const COMPANION_QUOTES = [
  "Harika gidiyoruz, ben de şu notları toparlıyorum ☕",
  "Çok iyi odaklandın, sessizce devam ediyoruz 📚",
  "Birlikte çalışmak her zaman daha kolay ✨",
  "Masanın başındayım, sen de ritmini bozma 🌿",
  "Dopamin seviyen yükseliyor, bu seansı beraber bitireceğiz 🚀"
];

function getCompanionWidget() {
  let widget = document.getElementById('body-doubling-widget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'body-doubling-widget';
    widget.className = 'fixed bottom-4 right-4 z-30 transition-all duration-300 select-none hidden';
    widget.innerHTML = `
      <div id="bd-companion-card" class="glass-card p-3 md:p-3.5 bg-white/95 dark:bg-slate-900/95 shadow-xl border border-indigo-100 dark:border-slate-800 rounded-2xl flex items-center gap-3 backdrop-blur-md max-w-xs animate-slide-in relative group">
        <button onclick="toggleBodyDoublingVisibility(false)" class="absolute -top-2 -right-2 w-5 h-5 bg-slate-200 dark:bg-slate-700 hover:bg-red-500 hover:text-white rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm" title="Gizle">✕</button>

        <!-- Çalışma Arkadaşı Animasyonlu Avatar -->
        <div class="relative shrink-0">
          <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center justify-center text-xl shadow-inner">
            <span id="companion-avatar" class="animate-pulse">☕</span>
          </div>
          <span class="absolute -bottom-1 -right-1 flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
        </div>

        <!-- Durum ve Fısıltı Balonu -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <p class="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">Sherlock (Yanında)</p>
            <span class="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 rounded font-bold">Odakta</span>
          </div>
          <p id="companion-speech" class="text-[10px] text-slate-500 dark:text-slate-400 italic truncate mt-0.5">
            "Seninle birlikte masadayım, ritmi koru ☕"
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
  }
  return widget;
}

function showBodyDoubling(status = 'working') {
  if (!BodyDoublingState.isEnabled) return;
  const widget = getCompanionWidget();
  widget.classList.remove('hidden');
  BodyDoublingState.status = status;

  const speech = document.getElementById('companion-speech');
  const avatar = document.getElementById('companion-avatar');

  if (status === 'working') {
    if (avatar) avatar.textContent = '💻';
    if (speech) speech.textContent = "Seninle birlikte masadayım, ritmi koru ☕";
    startCompanionSpeechCycle();
  } else if (status === 'break') {
    if (avatar) avatar.textContent = '☕';
    if (speech) speech.textContent = "Harika odaklandık! Şimdi 5 dk dinlenme zamanı 🌿";
    stopCompanionSpeechCycle();
  }
}

function hideBodyDoubling() {
  const widget = document.getElementById('body-doubling-widget');
  if (widget) widget.classList.add('hidden');
  stopCompanionSpeechCycle();
  BodyDoublingState.status = 'idle';
}

function toggleBodyDoublingVisibility(show) {
  if (show === undefined) show = !BodyDoublingState.isEnabled;
  BodyDoublingState.isEnabled = show;
  if (!show) hideBodyDoubling();
  else if (typeof TaskTimerState !== 'undefined' && TaskTimerState.isRunning) {
    showBodyDoubling(TaskTimerState.isBreak ? 'break' : 'working');
  }
}

function startCompanionSpeechCycle() {
  stopCompanionSpeechCycle();
  // Her 4 dakikada bir hafif sessiz bir motivasyon fısıltısı
  BodyDoublingState.bubbleTimer = setInterval(() => {
    const speech = document.getElementById('companion-speech');
    if (speech && BodyDoublingState.status === 'working') {
      const q = COMPANION_QUOTES[Math.floor(Math.random() * COMPANION_QUOTES.length)];
      speech.textContent = `"${q}"`;
    }
  }, 240000);
}

function stopCompanionSpeechCycle() {
  if (BodyDoublingState.bubbleTimer) {
    clearInterval(BodyDoublingState.bubbleTimer);
    BodyDoublingState.bubbleTimer = null;
  }
}

// Node.js test
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BodyDoublingState,
    COMPANION_QUOTES,
    showBodyDoubling,
    hideBodyDoubling,
    toggleBodyDoublingVisibility
  };
}
