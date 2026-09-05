/* ══════════════════════════════════════════════════════════════
   FocusAid — 👥 Sanal Body Doubling: Sherlock Holmes (Sinematik Animasyon)
   1. Çalışma Seansı: Masasında tüy kalemle yazan, büyüteçle inceleyen,
      piposu tüten, sarkaçlı saati sallanan canlı çalışma sahnesi.
   2. Mola Seansı: Masadan kalkıp odada kahvesiyle volta atan/yürüyen
      akıcı yürüme döngüsü (Walk Cycle).
   ══════════════════════════════════════════════════════════════ */

const BodyDoublingState = {
  isEnabled: true,
  companionName: 'Sherlock Holmes',
  status: 'idle', // 'idle', 'working', 'break'
  bubbleTimer: null
};

const SHERLOCK_WORKING_QUOTES = [
  "Vaka dosyasındaki ipuçlarını inceliyorum, sen de odağını koru dostum 🔍",
  "Tüy kalemimle önemli detayları not alıyorum. Harika bir ritim yakaladın 📚",
  "221B Baker Street'teki masamdayım; sessizce yanındayım ☕",
  "Zihnimiz tam kapasite çalışıyor, bu seansı beraber bitireceğiz 🚀"
];

// 🎬 1. SİNEMATİK ÇALIŞMA SAHNESİ (Yazı yazma, büyüteç, duman, sarkaçlı saat)
function getSherlockStudyScene() {
  return `
    <svg viewBox="0 0 240 160" class="w-full h-40 md:h-44 select-none">
      <defs>
        <radialGradient id="lampGlow2" cx="80%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#4ade80" stop-opacity="0.85"/>
          <stop offset="50%" stop-color="#16a34a" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <style>
        /* Tüy Kalemle Yazı Yazma Hareketi */
        @keyframes handWriting {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(2px, -3px) rotate(4deg); }
          50% { transform: translate(-2px, 1px) rotate(-3deg); }
          75% { transform: translate(3px, -2px) rotate(5deg); }
        }
        /* Büyüteç Gezdirme */
        @keyframes glassInspect {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-8px, 4px) rotate(-6deg); }
        }
        /* Pipo Dumanı */
        @keyframes pipeSmokeFilm {
          0% { transform: translateY(0) scale(0.6); opacity: 0.8; }
          50% { transform: translateY(-14px) scale(1.1) translateX(5px); opacity: 0.4; }
          100% { transform: translateY(-28px) scale(1.6) translateX(-3px); opacity: 0; }
        }
        /* Sarkaçlı Duvar Saati */
        @keyframes clockPendulum {
          0%, 100% { transform: rotate(14deg); }
          50% { transform: rotate(-14deg); }
        }
        /* Göz Kırpma */
        @keyframes eyeBlink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }

        .anim-writing-hand { animation: handWriting 1.6s infinite ease-in-out; transform-origin: 105px 115px; }
        .anim-glass-hand { animation: glassInspect 3.5s infinite ease-in-out; transform-origin: 75px 110px; }
        .anim-smoke-1 { animation: pipeSmokeFilm 2.5s infinite ease-out; }
        .anim-smoke-2 { animation: pipeSmokeFilm 2.5s infinite ease-out 1.25s; }
        .anim-pendulum { animation: clockPendulum 1.4s infinite ease-in-out; transform-origin: 28px 24px; }
        .anim-eye { animation: eyeBlink 4s infinite; transform-origin: 94px 50px; }
      </style>

      <!-- Oda Arka Planı -->
      <rect x="0" y="0" width="240" height="160" rx="16" fill="#0b1120"/>

      <!-- Sarkaçlı Antika Duvar Saati (Sol Üst) -->
      <rect x="18" y="8" width="20" height="32" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
      <circle cx="28" cy="18" r="6" fill="#f8fafc" stroke="#334155" stroke-width="1"/>
      <line x1="28" y1="18" x2="28" y2="14" stroke="#0f172a" stroke-width="1"/>
      <line x1="28" y1="18" x2="31" y2="18" stroke="#0f172a" stroke-width="1"/>
      <!-- Sarkaç -->
      <g class="anim-pendulum">
        <line x1="28" y1="24" x2="28" y2="46" stroke="#fbbf24" stroke-width="1.5"/>
        <circle cx="28" cy="47" r="3" fill="#f59e0b"/>
      </g>

      <!-- Yağmurlu Pencere (Orta Sol) -->
      <rect x="48" y="10" width="46" height="58" rx="6" fill="#0f172a" stroke="#334155" stroke-width="2"/>
      <line x1="71" y1="10" x2="71" y2="68" stroke="#334155" stroke-width="1.5"/>
      <line x1="48" y1="39" x2="94" y2="39" stroke="#334155" stroke-width="1.5"/>
      <!-- Yağmur Çizgileri -->
      <line x1="56" y1="18" x2="52" y2="28" stroke="#38bdf8" stroke-width="1" opacity="0.6"/>
      <line x1="78" y1="25" x2="74" y2="35" stroke="#38bdf8" stroke-width="1" opacity="0.6"/>
      <line x1="62" y1="45" x2="58" y2="55" stroke="#38bdf8" stroke-width="1" opacity="0.6"/>

      <!-- Yeşil Bankacı Lambası Işık Huzmesi -->
      <circle cx="185" cy="70" r="50" fill="url(#lampGlow2)"/>

      <!-- Kitaplık (Sağ Üst) -->
      <rect x="175" y="8" width="55" height="62" rx="3" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
      <rect x="180" y="12" width="7" height="24" fill="#818cf8"/>
      <rect x="188" y="15" width="9" height="21" fill="#f43f5e"/>
      <rect x="198" y="13" width="8" height="23" fill="#38bdf8"/>
      <rect x="207" y="17" width="16" height="19" fill="#fbbf24"/>
      <line x1="175" y1="38" x2="230" y2="38" stroke="#475569" stroke-width="2"/>

      <!-- Koltuk Arkalığı -->
      <rect x="68" y="58" width="52" height="60" rx="10" fill="#1e293b" stroke="#334155" stroke-width="2"/>

      <!-- SHERLOCK HOLMES GÖVDESİ & KAFA -->
      <g>
        <!-- Palto / Gövde -->
        <path d="M 70 78 C 70 64 114 64 114 78 L 118 118 L 66 118 Z" fill="#334155" stroke="#1e293b" stroke-width="2.5"/>
        <path d="M 86 70 L 96 90 L 80 90 Z" fill="#e2e8f0"/> <!-- Yaka & Kravat -->

        <!-- Kafa & Yüz -->
        <circle cx="92" cy="50" r="14" fill="#fed7aa"/>
        <!-- Göz (Kırpışan) -->
        <g class="anim-eye">
          <circle cx="97" cy="49" r="2" fill="#0f172a"/>
        </g>
        
        <!-- İkonik Deerstalker Şapka -->
        <path d="M 74 46 C 74 30 110 30 110 46 L 116 50 L 68 50 Z" fill="#64748b" stroke="#334155" stroke-width="2"/>
        <path d="M 64 50 L 120 50" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
        <path d="M 92 30 L 92 35" stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round"/>

        <!-- Dedektif Piposu & Tüten Duman -->
        <path d="M 100 56 Q 112 58 114 64 Q 116 68 110 70" stroke="#78350f" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="113" cy="58" r="2.5" fill="#94a3b8" class="anim-smoke-1"/>
        <circle cx="115" cy="54" r="3.5" fill="#cbd5e1" class="anim-smoke-2"/>
      </g>

      <!-- Sol Kol: Büyüteç Gezdiren (Animasyonlu) -->
      <g class="anim-glass-hand">
        <path d="M 76 86 Q 60 96 68 112" stroke="#334155" stroke-width="7" stroke-linecap="round" fill="none"/>
        <circle cx="68" cy="112" r="4" fill="#fed7aa"/>
        <circle cx="62" cy="118" r="8" stroke="#f59e0b" stroke-width="2.5" fill="rgba(186, 230, 253, 0.4)"/>
        <line x1="66" y1="114" x2="74" y2="108" stroke="#78350f" stroke-width="3.5" stroke-linecap="round"/>
      </g>

      <!-- Sağ Kol: Tüy Kalemle Not Alan (Animasyonlu) -->
      <g class="anim-writing-hand">
        <path d="M 106 86 Q 120 96 114 112" stroke="#334155" stroke-width="7" stroke-linecap="round" fill="none"/>
        <circle cx="114" cy="112" r="4" fill="#fed7aa"/>
        <!-- Tüy Kalem -->
        <path d="M 114 112 L 128 88 Q 134 94 122 108 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
        <line x1="114" y1="112" x2="124" y2="95" stroke="#94a3b8" stroke-width="1"/>
      </g>

      <!-- ÇALIŞMA MASASI -->
      <rect x="25" y="112" width="195" height="38" rx="5" fill="#1e293b" stroke="#0f172a" stroke-width="3"/>
      <rect x="38" y="120" width="45" height="14" rx="2" fill="#0f172a" opacity="0.6"/> <!-- Çekmece -->
      <circle cx="60" cy="127" r="2" fill="#94a3b8"/>

      <!-- Masadaki Vaka Dosyaları ve Not Defteri -->
      <rect x="95" y="106" width="48" height="22" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" transform="rotate(-4 95 106)"/>
      <line x1="102" y1="112" x2="135" y2="110" stroke="#64748b" stroke-width="2"/>
      <line x1="103" y1="118" x2="128" y2="116" stroke="#94a3b8" stroke-width="1.5"/>

      <!-- Mürekkep Hokkası -->
      <rect x="148" y="116" width="10" height="10" rx="2" fill="#020617" stroke="#334155" stroke-width="1"/>
      
      <!-- Yeşil Bankacı Lambası -->
      <ellipse cx="185" cy="94" rx="16" ry="8" fill="#15803d" stroke="#166534" stroke-width="2"/>
      <path d="M 185 94 L 185 112" stroke="#d97706" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="176" y="112" width="18" height="4" rx="2" fill="#d97706"/>
    </svg>
  `;
}

// 🚶‍♂️ 2. SİNEMATİK MOLA SAHNESİ (Masadan kalkıp odada kahvesiyle yürüyen Walk Cycle)
function getSherlockWalkingScene() {
  return `
    <svg viewBox="0 0 240 160" class="w-full h-40 md:h-44 select-none">
      <defs>
        <linearGradient id="walkCoffeeSteam" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <style>
        /* Odada Soldan Sağa Yürüme Hareketi (Film Volta Hareketi) */
        @keyframes roomPacing {
          0% { transform: translateX(20px); }
          45% { transform: translateX(130px) scaleX(1); }
          50% { transform: translateX(130px) scaleX(-1); }
          95% { transform: translateX(20px) scaleX(-1); }
          100% { transform: translateX(20px) scaleX(1); }
        }
        /* Bacak Adım Hareketi (Walk Cycle) */
        @keyframes legWalkLeft {
          0%, 100% { transform: rotate(20deg); }
          50% { transform: rotate(-20deg); }
        }
        @keyframes legWalkRight {
          0%, 100% { transform: rotate(-20deg); }
          50% { transform: rotate(20deg); }
        }
        /* Gövde Hafif Yaylanma */
        @keyframes bodyBob {
          0%, 50%, 100% { transform: translateY(0); }
          25%, 75% { transform: translateY(-4px); }
        }
        /* Kahve Dumanı */
        @keyframes coffeeSteamWalk {
          0% { transform: translateY(0) scale(0.8); opacity: 0.8; }
          50% { transform: translateY(-10px) scale(1.2) translateX(3px); opacity: 0.4; }
          100% { transform: translateY(-20px) scale(1.6) translateX(-2px); opacity: 0; }
        }

        .anim-pacing-group { animation: roomPacing 8s infinite linear; }
        .anim-body-bob { animation: bodyBob 1s infinite ease-in-out; }
        .anim-leg-left { animation: legWalkLeft 1s infinite ease-in-out; transform-origin: 80px 105px; }
        .anim-leg-right { animation: legWalkRight 1s infinite ease-in-out; transform-origin: 94px 105px; }
        .anim-cup-steam { animation: coffeeSteamWalk 2s infinite ease-out; }
      </style>

      <!-- Oda Arka Planı & Parke Zemin -->
      <rect x="0" y="0" width="240" height="160" rx="16" fill="#0b1120"/>
      <!-- Parke Çizgileri -->
      <line x1="0" y1="145" x2="240" y2="145" stroke="#1e293b" stroke-width="2"/>
      <line x1="0" y1="155" x2="240" y2="155" stroke="#1e293b" stroke-width="1.5"/>

      <!-- Arka Planda Geriye İtilmiş Boş Çalışma Masası -->
      <rect x="15" y="105" width="60" height="35" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="2" opacity="0.6"/>
      <rect x="25" y="70" width="30" height="38" rx="6" fill="#0f172a" opacity="0.5"/> <!-- Boş Sandalye -->

      <!-- Duvardaki Resim Tablosu -->
      <rect x="100" y="20" width="40" height="30" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
      <circle cx="120" cy="35" r="8" fill="#d97706" opacity="0.8"/>

      <!-- YÜRÜYEN SHERLOCK HOLMES (Film Volta Animasyonu) -->
      <g class="anim-pacing-group">
        <g class="anim-body-bob">
          <!-- Sol Bacak (Yürüyüş) -->
          <g class="anim-leg-left">
            <line x1="80" y1="105" x2="80" y2="140" stroke="#1e293b" stroke-width="7" stroke-linecap="round"/>
            <rect x="74" y="136" width="13" height="6" rx="3" fill="#020617"/>
          </g>
          <!-- Sağ Bacak (Yürüyüş) -->
          <g class="anim-leg-right">
            <line x1="94" y1="105" x2="94" y2="140" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
            <rect x="88" y="136" width="13" height="6" rx="3" fill="#020617"/>
          </g>

          <!-- Palto / Boydan Duruş -->
          <path d="M 68 45 C 68 35 106 35 106 45 L 112 106 L 62 106 Z" fill="#334155" stroke="#1e293b" stroke-width="2.5"/>
          <path d="M 84 40 L 94 60 L 76 60 Z" fill="#e2e8f0"/> <!-- Yaka -->
          <line x1="87" y1="60" x2="87" y2="102" stroke="#1e293b" stroke-width="2"/>

          <!-- Kafa & Yüz -->
          <circle cx="87" cy="25" r="12" fill="#fed7aa"/>
          <circle cx="91" cy="24" r="1.8" fill="#0f172a"/> <!-- Göz -->
          <path d="M 88 30 Q 92 33 95 30" stroke="#0f172a" stroke-width="1.5" fill="none" stroke-linecap="round"/> <!-- Tebessüm -->

          <!-- Deerstalker Şapka -->
          <path d="M 74 22 C 74 10 100 10 100 22 L 104 25 L 70 25 Z" fill="#64748b" stroke="#334155" stroke-width="1.5"/>
          <path d="M 64 25 L 108 25" stroke="#475569" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="87" cy="10" r="1.5" fill="#f8fafc"/>

          <!-- Elinde Kahve Fincanı (Sallanarak Yürüyor) -->
          <path d="M 104 52 Q 118 58 114 70" stroke="#334155" stroke-width="6" stroke-linecap="round" fill="none"/>
          <circle cx="114" cy="70" r="4" fill="#fed7aa"/>
          
          <g transform="translate(116, 64)">
            <rect x="0" y="0" width="14" height="12" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
            <path d="M 14 3 Q 18 6 14 9" stroke="#cbd5e1" stroke-width="2" fill="none"/>
            <path d="M 4 -3 Q 7 -7 4 -11" stroke="#fbbf24" stroke-width="2" fill="none" class="anim-cup-steam"/>
          </g>
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
      <div id="bd-companion-card" class="glass-card p-3 md:p-4 bg-slate-900/95 shadow-2xl border-2 border-indigo-500/40 rounded-3xl backdrop-blur-2xl w-84 md:w-92 animate-slide-in relative group transition-all duration-500 overflow-hidden">
        
        <!-- Kapatma Butonu (Sağ Üstte) -->
        <button onclick="toggleBodyDoublingVisibility(false)" class="absolute top-3 right-3 z-10 w-7 h-7 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-full text-xs font-bold flex items-center justify-center transition shadow-lg" title="Gizle">✕</button>

        <!-- Üst Başlık & Durum Rozeti -->
        <div class="flex items-center gap-2 mb-2 pr-8">
          <span class="text-sm font-black text-white">🕵️‍♂️ Sherlock Holmes</span>
          <span id="sherlock-badge" class="text-[10px] px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-bold flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
            <span>Masasında Davayı İnceliyor</span>
          </span>
        </div>

        <!-- SİNEMATİK ANİMASYON ALANI (Masada Çalışma / Odada Volta Atma) -->
        <div id="sherlock-scene-wrap" class="rounded-2xl overflow-hidden border border-slate-700/60 shadow-inner bg-slate-950">
          ${getSherlockStudyScene()}
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
    if (sceneWrap) sceneWrap.innerHTML = getSherlockStudyScene();
    if (badge) {
      badge.className = "text-[10px] px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-bold flex items-center gap-1.5";
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span> <span>Masasında Davayı İnceliyor</span>';
    }
    if (speech) speech.textContent = '"Vaka dosyasındaki ipuçlarını inceliyorum, sen de odağını koru dostum 🔍"';
    if (card) card.style.borderColor = 'rgba(99, 102, 241, 0.5)';
    startCompanionSpeechCycle();
  } else if (status === 'break') {
    // ☕ MOLA: Sherlock Masadan Kalkıp Odada Kahvesiyle Volta Atar!
    if (sceneWrap) sceneWrap.innerHTML = getSherlockWalkingScene();
    if (badge) {
      badge.className = "text-[10px] px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold flex items-center gap-1.5";
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> <span>Ayağa Kalktı & Kahve Molası ☕</span>';
    }
    if (speech) speech.textContent = '"Harika odaklandık! Masadan kalktım, şimdi 5 dakika dinlenme zamanı ☕"';
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
