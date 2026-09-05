/* ══════════════════════════════════════════════════════════════
   FocusAid — 👥 Sanal Body Doubling: Sherlock Holmes (Çalışma Sahnesi)
   Masasında dosya inceleyen ve mola olunca ayağa kalkan görsel partner.
   ══════════════════════════════════════════════════════════════ */

const BodyDoublingState = {
  isEnabled: true,
  companionName: 'Sherlock Holmes',
  status: 'idle', // 'idle', 'working', 'break'
  bubbleTimer: null
};

const SHERLOCK_WORKING_QUOTES = [
  "Vaka dosyasındaki ipuçlarını inceliyorum, sen de odağını koru dostum 🔍",
  "En karmaşık düğüm bile adım adım çözülür. Çok iyi gidiyorsun 📚",
  "221B Baker Street'teki masamdayım; sessizce yanındayım ☕",
  "Zihnimiz tam kapasite çalışıyor, seansı başarıyla bitireceğiz 🚀"
];

function getSherlockSittingScene() {
  return `
    <svg viewBox="0 0 200 160" class="w-full h-36 md:h-40 select-none">
      <defs>
        <radialGradient id="deskLampGlow" cx="75%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#4ade80" stop-opacity="0.9"/>
          <stop offset="40%" stop-color="#22c55e" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#15803d" stop-opacity="0"/>
        </radialGradient>
        <filter id="cozyGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <style>
        @keyframes sherlockInspect {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(-3deg); }
        }
        @keyframes pipeSmokeRise {
          0% { transform: translateY(0) scale(0.6); opacity: 0.8; }
          50% { transform: translateY(-12px) scale(1.1) translateX(4px); opacity: 0.4; }
          100% { transform: translateY(-24px) scale(1.6) translateX(-3px); opacity: 0; }
        }
        @keyframes pageFlicker {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.75; }
        }
        .sherlock-anim-body { animation: sherlockInspect 3.5s infinite ease-in-out; transform-origin: 70px 110px; }
        .smoke-particle-1 { animation: pipeSmokeRise 2.8s infinite ease-out; }
        .smoke-particle-2 { animation: pipeSmokeRise 2.8s infinite ease-out 1.4s; }
        .lamp-ambient { animation: pageFlicker 4s infinite ease-in-out; }
      </style>

      <!-- Oda Arka Planı & Sıcak Gece Havası -->
      <rect x="0" y="0" width="200" height="160" rx="16" fill="#0f172a"/>
      
      <!-- Pencere & Ay Işığı -->
      <rect x="15" y="15" width="45" height="55" rx="6" fill="#1e293b" stroke="#334155" stroke-width="2"/>
      <line x1="37" y1="15" x2="37" y2="70" stroke="#334155" stroke-width="2"/>
      <line x1="15" y1="42" x2="60" y2="42" stroke="#334155" stroke-width="2"/>
      <circle cx="48" cy="28" r="6" fill="#fde047" opacity="0.8"/> <!-- Hilal Ay -->

      <!-- Yeşil Bankacı Lambası Işığı -->
      <circle cx="155" cy="65" r="45" fill="url(#deskLampGlow)" class="lamp-ambient"/>
      
      <!-- Ahşap Kitaplık (Arka Duvar) -->
      <rect x="145" y="12" width="45" height="60" rx="3" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
      <rect x="148" y="16" width="8" height="24" fill="#818cf8"/>
      <rect x="157" y="18" width="6" height="22" fill="#f43f5e"/>
      <rect x="164" y="15" width="10" height="25" fill="#38bdf8"/>
      <rect x="175" y="20" width="12" height="20" fill="#fbbf24"/>
      <line x1="145" y1="42" x2="190" y2="42" stroke="#475569" stroke-width="2"/>

      <!-- Sandalye Arkalığı -->
      <rect x="48" y="65" width="44" height="55" rx="8" fill="#1e293b" stroke="#334155" stroke-width="2"/>

      <!-- SHERLOCK KARAKTERİ (Masada Oturan) -->
      <g class="sherlock-anim-body">
        <!-- Palto / Gövde -->
        <path d="M 50 82 C 50 68 88 68 88 82 L 92 118 L 46 118 Z" fill="#334155" stroke="#1e293b" stroke-width="2"/>
        <path d="M 64 74 L 72 90 L 58 90 Z" fill="#e2e8f0"/> <!-- Beyaz Yaka & Kravat -->

        <!-- Kafa & Yüz -->
        <circle cx="68" cy="54" r="14" fill="#fed7aa"/>
        <circle cx="73" cy="53" r="2" fill="#0f172a"/> <!-- Göz -->
        
        <!-- İkonik Deerstalker Şapka -->
        <path d="M 52 50 C 52 34 84 34 84 50 L 90 54 L 46 54 Z" fill="#64748b" stroke="#334155" stroke-width="2"/>
        <path d="M 42 54 L 94 54" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
        <path d="M 68 34 L 68 39" stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round"/>

        <!-- Dedektif Piposu & Tüten Duman -->
        <path d="M 76 60 Q 86 62 88 68 Q 90 72 84 74" stroke="#78350f" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="87" cy="62" r="2.5" fill="#94a3b8" class="smoke-particle-1"/>
        <circle cx="89" cy="58" r="3.5" fill="#cbd5e1" class="smoke-particle-2"/>

        <!-- Kol & Büyüteç Tutan El -->
        <path d="M 78 88 Q 95 95 90 108" stroke="#334155" stroke-width="7" stroke-linecap="round" fill="none"/>
        <circle cx="92" cy="108" r="4" fill="#fed7aa"/>
        
        <!-- Büyüteç -->
        <circle cx="98" cy="112" r="8" stroke="#f59e0b" stroke-width="2.5" fill="rgba(186, 230, 253, 0.4)"/>
        <line x1="93" y1="108" x2="86" y2="102" stroke="#78350f" stroke-width="3.5" stroke-linecap="round"/>
      </g>

      <!-- ÇALIŞMA MASASI -->
      <rect x="25" y="110" width="165" height="35" rx="5" fill="#1e293b" stroke="#0f172a" stroke-width="3"/>
      <rect x="35" y="116" width="35" height="12" rx="2" fill="#0f172a" opacity="0.6"/> <!-- Çekmece -->
      <circle cx="52" cy="122" r="1.5" fill="#94a3b8"/>

      <!-- Masadaki Vaka Dosyaları ve Notlar -->
      <rect x="75" y="104" width="42" height="18" rx="2" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" transform="rotate(-5 75 104)"/>
      <line x1="80" y1="109" x2="110" y2="107" stroke="#64748b" stroke-width="2"/>
      <line x1="81" y1="114" x2="105" y2="112" stroke="#94a3b8" stroke-width="1.5"/>

      <!-- Yeşil Lamba -->
      <ellipse cx="155" cy="92" rx="14" ry="7" fill="#15803d" stroke="#166534" stroke-width="1.5"/>
      <path d="M 155 92 L 155 110" stroke="#d97706" stroke-width="3" stroke-linecap="round"/>
      <rect x="148" y="110" width="14" height="3" rx="1.5" fill="#d97706"/>
    </svg>
  `;
}

function getSherlockStandingScene() {
  return `
    <svg viewBox="0 0 200 160" class="w-full h-36 md:h-40 select-none">
      <defs>
        <linearGradient id="coffeeSteamGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <style>
        @keyframes sherlockCelebration {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes steamRise {
          0% { transform: translateY(0) scale(0.8); opacity: 0.8; }
          50% { transform: translateY(-8px) scale(1.1) translateX(2px); opacity: 0.4; }
          100% { transform: translateY(-16px) scale(1.4) translateX(-2px); opacity: 0; }
        }
        .sherlock-standing-anim { animation: sherlockCelebration 3s infinite ease-in-out; }
        .coffee-steam-anim { animation: steamRise 2s infinite ease-out; }
      </style>

      <!-- Oda Arka Planı -->
      <rect x="0" y="0" width="200" height="160" rx="16" fill="#0f172a"/>
      
      <!-- Kutlama Işıkları / Yıldızlar -->
      <circle cx="45" cy="35" r="2" fill="#fbbf24" class="animate-ping"/>
      <circle cx="165" cy="30" r="2.5" fill="#38bdf8" class="animate-ping"/>
      <circle cx="150" cy="60" r="1.5" fill="#34d399"/>
      
      <!-- Masanın Geriye Çekilmiş Hali -->
      <rect x="120" y="115" width="70" height="35" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
      <ellipse cx="155" cy="105" rx="12" ry="6" fill="#15803d"/>
      <line x1="155" y1="105" x2="155" y2="115" stroke="#d97706" stroke-width="2.5"/>

      <!-- SHERLOCK AYAKTA (Boydan Sahne) -->
      <g class="sherlock-standing-anim">
        <!-- Bacaklar & Ayakkabılar -->
        <line x1="72" y1="105" x2="72" y2="142" stroke="#1e293b" stroke-width="7" stroke-linecap="round"/>
        <line x1="90" y1="105" x2="90" y2="142" stroke="#1e293b" stroke-width="7" stroke-linecap="round"/>
        <rect x="66" y="138" width="12" height="6" rx="3" fill="#020617"/>
        <rect x="86" y="138" width="12" height="6" rx="3" fill="#020617"/>

        <!-- Palto / Boydan Duruş -->
        <path d="M 60 48 C 60 38 102 38 102 48 L 108 108 L 54 108 Z" fill="#334155" stroke="#1e293b" stroke-width="2.5"/>
        <path d="M 76 44 L 86 64 L 68 64 Z" fill="#e2e8f0"/> <!-- Yaka -->
        <line x1="81" y1="64" x2="81" y2="105" stroke="#1e293b" stroke-width="2"/>

        <!-- Kafa & Şapka -->
        <circle cx="81" cy="28" r="12" fill="#fed7aa"/>
        <circle cx="85" cy="27" r="1.8" fill="#0f172a"/> <!-- Gülen Göz -->
        <path d="M 82 33 Q 86 36 89 33" stroke="#0f172a" stroke-width="1.5" fill="none" stroke-linecap="round"/> <!-- Gülümseme -->

        <!-- Deerstalker Şapka -->
        <path d="M 68 25 C 68 12 94 12 94 25 L 98 28 L 64 28 Z" fill="#64748b" stroke="#334155" stroke-width="1.5"/>
        <path d="M 58 28 L 102 28" stroke="#475569" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="81" cy="13" r="1.5" fill="#f8fafc"/>

        <!-- Sağ El: Kahve / Çay Fincanını Havaya Kaldırmış -->
        <path d="M 100 56 Q 115 62 110 75" stroke="#334155" stroke-width="6" stroke-linecap="round" fill="none"/>
        <circle cx="110" cy="75" r="4" fill="#fed7aa"/>
        
        <!-- Kahve Fincanı -->
        <g transform="translate(112, 68)">
          <rect x="0" y="0" width="14" height="12" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
          <path d="M 14 3 Q 18 6 14 9" stroke="#cbd5e1" stroke-width="2" fill="none"/>
          <path d="M 4 -3 Q 7 -7 4 -11" stroke="#fbbf24" stroke-width="2" fill="none" class="coffee-steam-anim"/>
        </g>
      </g>
    </svg>
  `;
}

function getCompanionWidget() {
  let widget = document.getElementById('body-doubling-widget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'body-doubling-widget';
    widget.className = 'fixed bottom-5 right-5 z-40 transition-all duration-500 select-none hidden';
    widget.innerHTML = `
      <div id="bd-companion-card" class="glass-card p-3 md:p-4 bg-slate-900/95 shadow-2xl border-2 border-indigo-500/40 rounded-3xl backdrop-blur-2xl w-80 md:w-88 animate-slide-in relative group transition-all duration-500 overflow-hidden">
        
        <!-- Kapatma Butonu (Sağ Üstte Temiz) -->
        <button onclick="toggleBodyDoublingVisibility(false)" class="absolute top-3 right-3 z-10 w-7 h-7 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-full text-xs font-bold flex items-center justify-center transition shadow-lg" title="Gizle">✕</button>

        <!-- Üst Başlık & Durum Rozeti -->
        <div class="flex items-center gap-2 mb-2 pr-8">
          <span class="text-sm font-black text-white">🕵️‍♂️ Sherlock Holmes</span>
          <span id="sherlock-badge" class="text-[10px] px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-bold flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
            <span>Davayı İnceliyor</span>
          </span>
        </div>

        <!-- BÜYÜK GÖRSEL ÇALIŞMA SAHNESİ -->
        <div id="sherlock-scene-wrap" class="rounded-2xl overflow-hidden border border-slate-700/60 shadow-inner bg-slate-950">
          ${getSherlockSittingScene()}
        </div>

        <!-- Sherlock Fısıltısı -->
        <div class="mt-2.5 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/50">
          <p id="companion-speech" class="text-xs text-slate-300 italic leading-relaxed text-center">
            "Vaka dosyasındaki ipuçlarını inceliyorum, sen de odağını koru dostum 🔍"
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
    if (sceneWrap) sceneWrap.innerHTML = getSherlockSittingScene();
    if (badge) {
      badge.className = "text-[10px] px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-bold flex items-center gap-1.5";
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span> <span>Davayı İnceliyor</span>';
    }
    if (speech) speech.textContent = '"Vaka dosyasındaki ipuçlarını inceliyorum, sen de odağını koru dostum 🔍"';
    if (card) card.style.borderColor = 'rgba(99, 102, 241, 0.5)';
    startCompanionSpeechCycle();
  } else if (status === 'break') {
    // ☕ MOLA: Sherlock Masadan Ayağa Kalkar!
    if (sceneWrap) sceneWrap.innerHTML = getSherlockStandingScene();
    if (badge) {
      badge.className = "text-[10px] px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold flex items-center gap-1.5";
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> <span>Ayağa Kalktı & Mola ☕</span>';
    }
    if (speech) speech.textContent = '"Vaka bu seanslık çözüldü! Ben de masadan kalktım, şimdi 5 dakikalık mola zamanı ☕"';
    if (card) card.style.borderColor = 'rgba(16, 185, 129, 0.7)';
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
