/* ══════════════════════════════════════════════════════════════
   FocusAid — 🤖 İnat Modu: GLITCH-BOT (Retro Arcade Robotu)
   Sevimli mini mecha, CRT piksel yüz ifadeleri, kıvılcımlar
   ve aşırı ısınma animasyonları ile başlama felcini kırar.
   ══════════════════════════════════════════════════════════════ */

(function () {
  let inatTimer = null;
  let remainingSeconds = 180;
  const TOTAL_HP = 180;
  let currentTaskName = '';
  let isFighting = false;

  const KISKITMALAR = [
    "Bip-bop! Yapay zekâm senin 3 dakika dayanamayacağını hesapladı! Kaçış olasılığı: %99.9 :P",
    "Analiz tamamlandı: Bu görevin ilk satırını okuyamadan dikkatin dağılacak bip-bip!",
    "İşlemcim bahse giriyor: 60 saniye dolmadan telefonu eline alacaksın!",
    "Bip... Görev çok zor görünüyor, bence git başka şeylerle oyalan :D",
    "3 dakika masada kalmak mı? DEHB işlemcin için imkânsız bir algoritma bip!"
  ];

  const DOVUS_REPLIKLERI = [
    { at: 165, text: "Bip-bop! İlk 15 saniye bitti, sistemim sıkılacağını öngörüyor :P", mood: 'smug' },
    { at: 140, text: "Bip?! Hâlâ masada mısın? CPU sıcaklığım %20 yükseldi!", mood: 'worried' },
    { at: 110, text: "Bzzzzt! Devrelerim ısınıyor... 70 saniyedir buradasın, dur artık!", mood: 'pain' },
    { at: 75, text: "UYARI: Erteleme motoru aşırı ısınıyor! Kıvılcımlar çıkıyor!", mood: 'pain' },
    { at: 40, text: "KRİTİK HATA 404! BÖYLE BİR İNAT ALGORİTMASI HESAPLANMADI!!", mood: 'critical' },
    { at: 15, text: "SON 15 SANİYE! SİSTEM ÇÖKÜYOR, ERTELEME PROTOKOLÜ YIKILDI!!", mood: 'critical' }
  ];

  function getModal() {
    let modal = document.getElementById('inat-modu-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'inat-modu-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md hidden transition-all duration-300 select-none';
      document.body.appendChild(modal);
    }
    return modal;
  }

  // 🔊 8-Bit Retro Ses Efektleri (Bip, Kıvılcım, Level Up Fanfare)
  function playArcadeSound(type = 'punch') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'punch') {
        osc.type = 'square'; // 8-bit retro sound
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'spark') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) {}
  }

  function playVictoryFanfare() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = f;
        const t = ctx.currentTime + (i * 0.08);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch (e) {}
  }

  // 🤖 Sevimli Retro Arcade Robotu (CRT Ekranlı Glitch-Bot SVG)
  function getRobotSVG(phase = 1) {
    let screenBg = '', screenBorder = '', glowColor = '', eyes = '', sparks = '', antennaLight = '';

    if (phase === 1) {
      // Faz 1 (Kibirli & Şarjlı - Havalı Piksel Gözler)
      screenBg = '#0369a1'; screenBorder = '#38bdf8'; glowColor = 'rgba(56, 189, 248, 0.6)';
      antennaLight = '#38bdf8';
      // [ ⌐ ■ _ ■ ] Havalı Güneş Gözlüğü
      eyes = `
        <rect x="42" y="60" width="30" height="14" rx="3" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
        <rect x="88" y="60" width="30" height="14" rx="3" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
        <line x1="72" y1="67" x2="88" y2="67" stroke="#38bdf8" stroke-width="3"/>
        <path d="M 68 88 Q 80 96 92 88" stroke="#38bdf8" stroke-width="3" fill="none" stroke-linecap="round"/>
      `;
    } else if (phase === 2) {
      // Faz 2 (Şaşırmış & Telaşlı - Sarı Ekran)
      screenBg = '#854d0e'; screenBorder = '#facc15'; glowColor = 'rgba(250, 204, 21, 0.7)';
      antennaLight = '#facc15';
      // ( O _ O ) Fal Taşı Piksel Gözler
      eyes = `
        <circle cx="56" cy="68" r="10" fill="#fef08a" stroke="#713f12" stroke-width="3"/>
        <circle cx="104" cy="68" r="10" fill="#fef08a" stroke="#713f12" stroke-width="3"/>
        <ellipse cx="80" cy="90" rx="8" ry="12" fill="#0f172a" stroke="#facc15" stroke-width="2"/>
        <circle cx="128" cy="48" r="4" fill="#38bdf8" class="animate-ping"/>
      `;
    } else if (phase === 3) {
      // Faz 3 (Aşırı Isınan & Kıvılcımlı - Turuncu Ekran)
      screenBg = '#9a3412'; screenBorder = '#fb923c'; glowColor = 'rgba(251, 146, 60, 0.8)';
      antennaLight = '#ea580c';
      // ( > _ < ) Acı Çeken Gözler + Kıvılcımlar
      eyes = `
        <path d="M 45 62 L 65 72 L 45 82" stroke="#fef08a" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M 115 62 L 95 72 L 115 82" stroke="#fef08a" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M 65 94 Q 80 84 95 94" stroke="#fef08a" stroke-width="4" fill="none" stroke-linecap="round"/>
      `;
      sparks = `
        <path d="M 25 35 L 35 45 L 20 50 M 135 35 L 125 45 L 140 50" stroke="#fde047" stroke-width="3" fill="none" class="animate-ping"/>
        <path d="M 30 115 L 45 105 L 35 125" stroke="#f97316" stroke-width="3" fill="none" class="animate-pulse"/>
      `;
    } else {
      // Faz 4 (Kritik Çöküş 404 - Kırmızı Glitch Ekranı)
      screenBg = '#7f1d1d'; screenBorder = '#ef4444'; glowColor = 'rgba(239, 68, 68, 0.95)';
      antennaLight = '#ef4444';
      // [ X _ X ] Çökmüş Robot Gözleri
      eyes = `
        <path d="M 45 58 L 67 80 M 45 80 L 67 58" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
        <path d="M 93 58 L 115 80 M 93 80 L 115 58" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
        <rect x="62" y="90" width="36" height="8" rx="3" fill="#ffffff" class="animate-pulse"/>
      `;
      sparks = `
        <path d="M 15 25 L 35 45 L 10 60 M 145 25 L 125 45 L 150 60" stroke="#ffffff" stroke-width="4" fill="none" class="animate-ping"/>
        <path d="M 25 125 L 50 110 L 35 140 M 135 125 L 110 110 L 125 140" stroke="#fca5a5" stroke-width="3" fill="none" class="animate-pulse"/>
      `;
    }

    return `
      <svg viewBox="0 0 160 160" class="w-36 h-36 md:w-44 md:h-44 transition-all duration-300" style="filter: drop-shadow(0 0 25px ${glowColor});">
        <!-- Anten & Yay -->
        <path d="M 80 32 L 80 18" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
        <circle cx="80" cy="12" r="7" fill="${antennaLight}" stroke="#ffffff" stroke-width="2" class="animate-pulse"/>
        
        <!-- Kulak Vidaları / Cıvatalar -->
        <rect x="18" y="62" width="10" height="24" rx="3" fill="#64748b" stroke="#334155" stroke-width="2"/>
        <rect x="132" y="62" width="10" height="24" rx="3" fill="#64748b" stroke="#334155" stroke-width="2"/>

        <!-- Robot Kafa Gövdesi (Metalik Mecha) -->
        <rect x="26" y="32" width="108" height="92" rx="24" fill="#1e293b" stroke="#475569" stroke-width="4"/>
        
        <!-- CRT Ekran -->
        <rect x="36" y="42" width="88" height="72" rx="14" fill="${screenBg}" stroke="${screenBorder}" stroke-width="3"/>
        
        <!-- Ekran Tarama Çizgileri (Scanlines) -->
        <line x1="38" y1="58" x2="122" y2="58" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
        <line x1="38" y1="78" x2="122" y2="78" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
        <line x1="38" y1="98" x2="122" y2="98" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

        <!-- Yüz İfadeleri & Kıvılcımlar -->
        ${eyes}
        ${sparks}

        <!-- Mini Robot Gövdesi / Boyun -->
        <rect x="68" y="124" width="24" height="12" rx="3" fill="#475569"/>
        <path d="M 45 136 Q 80 150 115 136 L 110 148 Q 80 158 50 148 Z" fill="#334155"/>
      </svg>
    `;
  }

  function getPhase(remaining) {
    if (remaining > 135) return 1; // 180-135 sn: Kibirli [⌐■_■]
    if (remaining > 90)  return 2; // 135-90 sn: Telaşlı (O_O)
    if (remaining > 40)  return 3; // 90-40 sn: Kıvılcımlı (>_<)
    return 4;                      // 40-0 sn: Çökmüş [X_X]
  }

  window.startInatModu = function (taskId, taskName) {
    currentTaskName = taskName || 'Bu Görev';
    remainingSeconds = TOTAL_HP;
    isFighting = false;
    if (inatTimer) clearInterval(inatTimer);

    const randomKiskirtma = KISKITMALAR[Math.floor(Math.random() * KISKITMALAR.length)];
    const modal = getModal();
    modal.classList.remove('hidden');

    modal.innerHTML = `
      <style>
        @keyframes robotHover { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes robotShakeLight { 0%, 100% { transform: translate(0, 0); } 25% { transform: translate(-3px, 2px); } 75% { transform: translate(3px, -2px); } }
        @keyframes robotShakeHard { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 20% { transform: translate(-6px, 4px) rotate(-2deg); } 40% { transform: translate(6px, -4px) rotate(2deg); } 60% { transform: translate(-4px, -3px) rotate(-1deg); } 80% { transform: translate(4px, 3px) rotate(1deg); } }
        @keyframes inatDamageFloat { 0% { opacity: 1; transform: translateY(0) scale(1.2); } 100% { opacity: 0; transform: translateY(-40px) scale(0.8); } }
        .robot-anim-1 { animation: robotHover 2.5s infinite ease-in-out; }
        .robot-anim-2 { animation: robotShakeLight 0.5s infinite ease-in-out; }
        .robot-anim-3 { animation: robotShakeHard 0.25s infinite ease-in-out; }
        .robot-anim-4 { animation: robotShakeHard 0.12s infinite ease-in-out; }
        .damage-popup { position: absolute; font-weight: 900; font-family: monospace; animation: inatDamageFloat 0.8s forwards ease-out; pointer-events: none; z-index: 30; }
      </style>

      <div id="inat-card-root" class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-cyan-500/50 rounded-3xl p-6 md:p-8 text-white shadow-2xl text-center animate-slide-in overflow-hidden">
        <button onclick="closeInatModu()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2 rounded-full hover:bg-slate-800 transition">✕</button>

        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-widest mb-3">
          <span>🤖</span> Arcade Felç Kırıcı: Glitch-Bot
        </div>

        <!-- Robot Sahnesi -->
        <div class="relative my-3 flex justify-center items-center min-h-[160px]" id="boss-container">
          <div id="boss-graphic" class="robot-anim-1">
            ${getRobotSVG(1)}
          </div>
          <div id="damage-overlay" class="absolute inset-0 flex items-center justify-center pointer-events-none"></div>
        </div>

        <h3 id="boss-name" class="text-xl md:text-2xl font-black text-cyan-400 tracking-tight">GLITCH-BOT (Model: SLOTH-3000)</h3>
        <p class="text-xs text-slate-400 font-mono mt-0.5">Hedef: "${currentTaskName}"</p>

        <!-- Kışkırtma Balonu -->
        <div id="boss-quote-box" class="my-4 p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs md:text-sm italic font-semibold leading-relaxed shadow-inner">
          "${randomKiskirtma}"
        </div>

        <!-- Can Barı (Pil Seviyesi / HP) -->
        <div class="space-y-1.5 mb-5 text-left">
          <div class="flex justify-between text-[11px] font-mono font-bold text-slate-400">
            <span id="boss-status-tag" class="text-cyan-400">MOD: %100 ŞARJLI & HAVALI</span>
            <span id="boss-hp-text" class="text-cyan-400 font-black">180 / 180 HP</span>
          </div>
          <div class="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5 shadow-inner">
            <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-300" style="width: 100%;"></div>
          </div>
        </div>

        <div id="inat-action-area">
          <button onclick="launchInatFight()" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-black text-base md:text-lg shadow-xl shadow-cyan-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
            <span>🎮</span> HODRİ MEYDAN! ROBOTU ÇÖKERT!
          </button>
          <p class="text-[11px] text-slate-500 mt-2">3 dakika masada kal, robotun bataryasını boşalt, felci kır!</p>
        </div>
      </div>
    `;
  };

  window.launchInatFight = function () {
    isFighting = true;
    playArcadeSound('punch');

    const actionArea = document.getElementById('inat-action-area');
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="space-y-2.5 animate-fade-in">
          <div class="text-4xl md:text-5xl font-mono font-black text-amber-400 tracking-tight" id="inat-time-display">
            03:00
          </div>
          <p id="boss-speech" class="text-xs text-cyan-300 font-bold italic h-5 transition-all">
            "Bip-bop! Süre başladı, ilk 30 saniyede kaçacaksın!"
          </p>
          <div class="p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700 text-slate-300 text-xs text-left flex items-center gap-2.5">
            <span class="text-xl">💡</span>
            <div>
              <span class="font-bold text-white">İnat Görevin:</span> Masada kal ve görevin ilk satırına 3 dk boyunca göz at. Bitirmek zorunda değilsin, sadece masadan kalkma!
            </div>
          </div>
        </div>
      `;
    }

    inatTimer = setInterval(tickInatFight, 1000);
  };

  function popDamageNumber(text, color = '#38bdf8') {
    const overlay = document.getElementById('damage-overlay');
    if (!overlay) return;
    const pop = document.createElement('div');
    pop.className = 'damage-popup text-base md:text-lg font-black';
    pop.style.color = color;
    const offsetX = (Math.random() * 80) - 40;
    const offsetY = (Math.random() * 40) - 20;
    pop.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    pop.textContent = text;
    overlay.appendChild(pop);
    setTimeout(() => pop.remove(), 800);
  }

  function tickInatFight() {
    if (!isFighting) return;
    remainingSeconds--;

    const hpBar = document.getElementById('boss-hp-bar');
    const hpText = document.getElementById('boss-hp-text');
    const timeDisplay = document.getElementById('inat-time-display');
    const speech = document.getElementById('boss-speech');
    const bossGraphic = document.getElementById('boss-graphic');
    const statusTag = document.getElementById('boss-status-tag');

    const phase = getPhase(remainingSeconds);

    // Can & Süre Güncelle
    const pct = Math.max(0, (remainingSeconds / TOTAL_HP) * 100);
    if (hpBar) {
      hpBar.style.width = pct + '%';
      if (phase === 4) hpBar.className = 'h-full bg-red-600 animate-pulse rounded-full';
      else if (phase === 3) hpBar.className = 'h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full';
      else if (phase === 2) hpBar.className = 'h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full';
    }
    if (hpText) hpText.textContent = `${remainingSeconds} / ${TOTAL_HP} HP`;

    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    if (timeDisplay) timeDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Faz Değişimleri ve Görsel/Sarsıntı Güncellemesi
    if (bossGraphic) {
      bossGraphic.className = `robot-anim-${phase}`;
      bossGraphic.innerHTML = getRobotSVG(phase);
    }

    if (statusTag) {
      const tags = {
        1: 'MOD: %100 ŞARJLI & HAVALI',
        2: 'MOD: AŞIRI ISINMA & TELAŞ',
        3: 'MOD: KIVILCIMLAR & DEVRE HASARI',
        4: 'MOD: SİSTEM HATASI 404 (ÇÖKÜŞ!)'
      };
      statusTag.textContent = tags[phase] || '';
      statusTag.className = phase === 4 ? 'text-rose-500 font-black animate-pulse' : phase === 3 ? 'text-orange-400 font-bold' : phase === 2 ? 'text-amber-400 font-bold' : 'text-cyan-400';
    }

    // Hasar ve Ses Efektleri
    if (remainingSeconds % 3 === 0) {
      playArcadeSound(phase >= 3 ? 'spark' : 'punch');
      popDamageNumber('-1 HP', phase === 4 ? '#ef4444' : phase === 3 ? '#f97316' : '#38bdf8');
    }

    if (remainingSeconds === 90) popDamageNumber('⚡ AŞIRI ISINMA!', '#facc15');
    if (remainingSeconds === 30) popDamageNumber('💥 DEVRE ÇÖKTÜ!', '#ef4444');

    // Dinamik Replikler
    for (const r of DOVUS_REPLIKLERI) {
      if (remainingSeconds === r.at && speech) {
        speech.textContent = `"${r.text}"`;
      }
    }

    // Zafer / Robot Çöktü!
    if (remainingSeconds <= 0) {
      clearInterval(inatTimer);
      inatTimer = null;
      renderInatVictory();
    }
  }

  function renderInatVictory() {
    playVictoryFanfare();
    if (typeof confetti === 'function') {
      confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
    }

    const modal = getModal();
    modal.innerHTML = `
      <div class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-cyan-400/60 rounded-3xl p-6 md:p-8 text-white text-center shadow-2xl animate-slide-in">
        <div class="text-7xl mb-2 animate-bounce">🤖 🏆 💥</div>
        <span class="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-black uppercase tracking-widest">
          SİSTEM HACKLENDİ! 0 HP
        </span>
        <h3 class="text-2xl md:text-3xl font-black text-white mt-3 tracking-tight">ROBOTU ÇÖKERTTİN, FELÇ KIRILDI!</h3>
        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
          Glitch-Bot'un erteleme protokolünü yıktın geçtin! En zor olan <span class="text-cyan-400 font-bold">başlama direncini kırdın</span> ve beynin artık dopaminle akışa girdi.
        </p>

        <div class="my-5 p-4 bg-white/10 dark:bg-slate-800/80 rounded-2xl border border-white/10 text-left space-y-1">
          <p class="text-[10px] font-black uppercase tracking-wider text-cyan-300">Kazanılan Başarı:</p>
          <p class="text-sm font-bold text-white">🎮 "Arcade Şampiyonu" — 180 Saniyelik İnat Zaferi</p>
        </div>

        <div class="space-y-3">
          <button onclick="closeInatModuAndStartTimer()" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black text-base shadow-xl shadow-cyan-500/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
            <span>🚀</span> İVMEYİ KAYBETME & 25 DK SEANSI BAŞLAT
          </button>
          <button onclick="closeInatModu()" class="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition">
            Pencereyi Kapat
          </button>
        </div>
      </div>
    `;
  }

  window.closeInatModu = function () {
    if (inatTimer) {
      clearInterval(inatTimer);
      inatTimer = null;
    }
    isFighting = false;
    const modal = getModal();
    modal.classList.add('hidden');
  };

  window.closeInatModuAndStartTimer = function () {
    window.closeInatModu();
    if (typeof toggleTaskTimer === 'function') {
      setTimeout(() => {
        toggleTaskTimer();
      }, 300);
    }
  };
})();
