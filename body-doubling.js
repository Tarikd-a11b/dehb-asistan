/* ══════════════════════════════════════════════════════════════
   FocusAid — 👥 Sanal Body Doubling: Sherlock Holmes
   Odak seansında masasında vaka dosyasını inceleyen,
   süre bittiğinde otomatik ayağa kalkıp molaya eşlik eden sanal partner.
   ══════════════════════════════════════════════════════════════ */

const BodyDoublingState = {
  isEnabled: true,
  companionName: 'Sherlock Holmes',
  status: 'idle', // 'idle', 'working', 'break'
  bubbleTimer: null
};

const SHERLOCK_WORKING_QUOTES = [
  "Vaka dosyasındaki ipuçlarını inceliyorum, sen de ritmini koru dostum 🔍",
  "En karmaşık problemler bile tek bir adımla çözülür. Harika gidiyorsun 📖",
  "221B Baker Street'teki masamdayım; sessizce yanındayım 🌿",
  "Zihnimiz tam kapasite çalışıyor. Odaklanmaya devam! ☕",
  "İpuçları birleşiyor, bu seansı başarıyla tamamlayacağız 🚀"
];

function getSherlockSittingSVG() {
  return `
    <svg viewBox="0 0 120 120" class="w-16 h-16 md:w-20 md:h-20 shrink-0 select-none">
      <defs>
        <radialGradient id="lampGlow" cx="70%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#4ade80" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#15803d" stop-opacity="0.2"/>
        </radialGradient>
      </defs>

      <style>
        @keyframes pipeSmoke {
          0% { transform: translateY(0) scale(0.8); opacity: 0.7; }
          50% { transform: translateY(-8px) scale(1.2) translateX(3px); opacity: 0.4; }
          100% { transform: translateY(-16px) scale(1.6) translateX(-2px); opacity: 0; }
        }
        @keyframes glassMove {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-3px, 2px) rotate(-8deg); }
        }
        .smoke-1 { animation: pipeSmoke 2.5s infinite ease-out; }
        .smoke-2 { animation: pipeSmoke 2.5s infinite ease-out 1.2s; }
        .sherlock-glass { animation: glassMove 3s infinite ease-in-out; transform-origin: 45px 75px; }
      </style>

      <!-- Arka Plan / Masa Lambası Işığı -->
      <circle cx="85" cy="45" r="25" fill="url(#lampGlow)" class="animate-pulse"/>
      <path d="M 85 40 L 92 65 L 78 65 Z" fill="#166534" stroke="#15803d" stroke-width="1.5"/>
      <rect x="83" y="65" width="4" height="20" fill="#78350f"/>
      <rect x="76" y="85" width="18" height="4" rx="2" fill="#d97706"/>

      <!-- Sherlock Gövde (Tweed Ceket) -->
      <path d="M 30 75 C 30 60 55 60 55 75 L 58 95 L 25 95 Z" fill="#475569" stroke="#334155" stroke-width="2"/>
      <path d="M 40 68 L 45 82 L 35 82 Z" fill="#cbd5e1"/> <!-- Yaka -->

      <!-- Sherlock Kafa & İkonik Deerstalker Şapka -->
      <circle cx="42" cy="48" r="12" fill="#fed7aa"/>
      <path d="M 28 44 C 28 32 56 32 56 44 L 60 48 L 24 48 Z" fill="#64748b" stroke="#334155" stroke-width="1.5"/> <!-- Şapka -->
      <path d="M 20 48 L 64 48" stroke="#475569" stroke-width="2.5" stroke-linecap="round"/> <!-- Siperlik -->
      <path d="M 42 32 L 42 36" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/> <!-- Üst Kurdele -->

      <!-- Pipo & Duman -->
      <path d="M 48 53 Q 56 55 58 60 Q 60 63 56 65" stroke="#78350f" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="58" cy="56" r="2" fill="#94a3b8" class="smoke-1"/>
      <circle cx="59" cy="54" r="2.5" fill="#cbd5e1" class="smoke-2"/>

      <!-- Çalışma Masası -->
      <rect x="10" y="85" width="100" height="22" rx="4" fill="#334155" stroke="#1e293b" stroke-width="2"/>
      
      <!-- Masadaki Vaka Dosyaları / Belgeler -->
      <rect x="25" y="80" width="30" height="14" rx="2" fill="#f8fafc" stroke="#94a3b8" stroke-width="1" transform="rotate(-6 25 80)"/>
      <line x1="28" y1="84" x2="48" y2="82" stroke="#64748b" stroke-width="1.5"/>
      <line x1="29" y1="88" x2="45" y2="86" stroke="#94a3b8" stroke-width="1"/>

      <!-- Büyüteç (Animasyonlu) -->
      <g class="sherlock-glass">
        <circle cx="42" cy="76" r="6" stroke="#d97706" stroke-width="2" fill="rgba(147, 197, 253, 0.4)"/>
        <line x1="46" y1="80" x2="54" y2="88" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>
  `;
}

function getSherlockStandingSVG() {
  return `
    <svg viewBox="0 0 120 120" class="w-16 h-16 md:w-20 md:h-20 shrink-0 select-none">
      <style>
        @keyframes cupSteam {
          0% { transform: translateY(0) scale(0.8); opacity: 0.8; }
          50% { transform: translateY(-6px) scale(1.1) translateX(2px); opacity: 0.4; }
          100% { transform: translateY(-12px) scale(1.4) translateX(-1px); opacity: 0; }
        }
        .cup-steam { animation: cupSteam 2s infinite ease-out; }
      </style>

      <!-- Sherlock Ayakta (Boydan Duruş) -->
      <!-- Bacaklar & Pantolon -->
      <line x1="42" y1="85" x2="42" y2="110" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
      <line x1="56" y1="85" x2="56" y2="110" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
      <rect x="38" y="108" width="8" height="4" rx="2" fill="#0f172a"/>
      <rect x="54" y="108" width="8" height="4" rx="2" fill="#0f172a"/>

      <!-- Palto & Gövde -->
      <path d="M 32 45 C 32 35 66 35 66 45 L 70 88 L 28 88 Z" fill="#475569" stroke="#1e293b" stroke-width="2"/>
      <path d="M 44 42 L 50 60 L 38 60 Z" fill="#cbd5e1"/> <!-- Yaka & Kravat -->
      <line x1="49" y1="60" x2="49" y2="85" stroke="#334155" stroke-width="2"/>

      <!-- Kafa & Şapka -->
      <circle cx="49" cy="26" r="10" fill="#fed7aa"/>
      <path d="M 38 23 C 38 13 60 13 60 23 L 64 26 L 34 26 Z" fill="#64748b" stroke="#334155" stroke-width="1.5"/>
      <path d="M 30 26 L 68 26" stroke="#475569" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="49" cy="13" r="1.5" fill="#f8fafc"/>

      <!-- Elinde Kahve / Çay Fincanı -->
      <g transform="translate(62, 55)">
        <rect x="0" y="0" width="12" height="10" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
        <path d="M 12 2 Q 16 5 12 8" stroke="#cbd5e1" stroke-width="1.5" fill="none"/>
        <path d="M 3 -3 Q 6 -6 3 -9" stroke="#94a3b8" stroke-width="1.5" fill="none" class="cup-steam"/>
      </g>
    </svg>
  `;
}

function getCompanionWidget() {
  let widget = document.getElementById('body-doubling-widget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'body-doubling-widget';
    widget.className = 'fixed bottom-4 right-4 z-40 transition-all duration-500 select-none hidden';
    widget.innerHTML = `
      <div id="bd-companion-card" class="glass-card p-3 md:p-4 bg-white/95 dark:bg-slate-900/95 shadow-2xl border-2 border-indigo-200/80 dark:border-indigo-900/80 rounded-3xl flex items-center gap-3.5 backdrop-blur-xl max-w-sm animate-slide-in relative group transition-all duration-500">
        <button onclick="toggleBodyDoublingVisibility(false)" class="absolute -top-2 -right-2 w-6 h-6 bg-slate-200 dark:bg-slate-700 hover:bg-red-500 hover:text-white rounded-full text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md" title="Kapat">✕</button>

        <!-- Sherlock Sahnesi (Masada / Ayakta) -->
        <div id="sherlock-scene-wrap" class="shrink-0 transition-all duration-500">
          ${getSherlockSittingSVG()}
        </div>

        <!-- Durum ve Fısıltı Balonu -->
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <p class="text-xs font-black text-slate-800 dark:text-slate-100 truncate">Sherlock Holmes</p>
            <span id="sherlock-badge" class="text-[9px] px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/90 dark:text-indigo-300 rounded-full font-bold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
              <span>🔍 Davayı İnceliyor</span>
            </span>
          </div>
          <p id="companion-speech" class="text-[11px] text-slate-600 dark:text-slate-300 italic leading-snug">
            "Vaka dosyasını inceliyorum, sen de ritmini koru dostum 🔍"
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

  const sceneWrap = document.getElementById('sherlock-scene-wrap');
  const speech = document.getElementById('companion-speech');
  const badge = document.getElementById('sherlock-badge');
  const card = document.getElementById('bd-companion-card');

  if (status === 'working') {
    if (sceneWrap) sceneWrap.innerHTML = getSherlockSittingSVG();
    if (badge) {
      badge.className = "text-[9px] px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/90 dark:text-indigo-300 rounded-full font-bold flex items-center gap-1";
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span> <span>🔍 Davayı İnceliyor</span>';
    }
    if (speech) speech.textContent = "Vaka dosyasındaki ipuçlarını inceliyorum, sen de ritmini koru dostum 🔍";
    if (card) card.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    startCompanionSpeechCycle();
  } else if (status === 'break') {
    // ☕ MOLA: Sherlock Masadan Ayağa Kalkar!
    if (sceneWrap) sceneWrap.innerHTML = getSherlockStandingSVG();
    if (badge) {
      badge.className = "text-[9px] px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/90 dark:text-emerald-300 rounded-full font-bold flex items-center gap-1";
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> <span>☕ Ayağa Kalktı & Mola</span>';
    }
    if (speech) speech.textContent = "Vaka bu seanslık çözüldü! Ben de masadan kalktım, şimdi 5 dakikalık mola zamanı ☕";
    if (card) card.style.borderColor = 'rgba(16, 185, 129, 0.6)';
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
  BodyDoublingState.bubbleTimer = setInterval(() => {
    const speech = document.getElementById('companion-speech');
    if (speech && BodyDoublingState.status === 'working') {
      const q = SHERLOCK_WORKING_QUOTES[Math.floor(Math.random() * SHERLOCK_WORKING_QUOTES.length)];
      speech.textContent = `"${q}"`;
    }
  }, 200000);
}

function stopCompanionSpeechCycle() {
  if (BodyDoublingState.bubbleTimer) {
    clearInterval(BodyDoublingState.bubbleTimer);
    BodyDoublingState.bubbleTimer = null;
  }
}

// Global window bindings
if (typeof window !== 'undefined') {
  window.showBodyDoubling = showBodyDoubling;
  window.hideBodyDoubling = hideBodyDoubling;
  window.toggleBodyDoublingVisibility = toggleBodyDoublingVisibility;
}

// Node.js test
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BodyDoublingState,
    SHERLOCK_WORKING_QUOTES,
    showBodyDoubling,
    hideBodyDoubling,
    toggleBodyDoublingVisibility
  };
}
