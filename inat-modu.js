/* ══════════════════════════════════════════════════════════════
   FocusAid — 🥊 İnat Modu: Hodri Meydan (DEHB Felç Kırıcı Boss Dövüşü v2)
   "3 dakika bile dayanamazsın" kışkırtmasıyla direnci inada ve eyleme çevirir.
   Kademeli acı çekme, sarsıntı ve tepkisel SVG boss animasyonu içerir.
   ══════════════════════════════════════════════════════════════ */

(function () {
  let inatTimer = null;
  let remainingSeconds = 180;
  const TOTAL_HP = 180;
  let currentTaskName = '';
  let isFighting = false;

  const KISKITMALAR = [
    "Hadi canım, masada 3 dakika kıpırdamadan durabileceğini mi sanıyorsun? Bence yine sekmeleri gezeceksin :P",
    "Bu görevin ilk satırına bakmaya bile cesaretin yok bence. Git başka şeyle oyalan :)",
    "Bahse girerim 60. saniyede pes edip telefonu eline alacaksın!",
    "Bırak bu işleri, git bir kahve daha koy, nasılsa bugün yapamayacaksın :D",
    "3 dakika odaklanmak mı? Senin gibi bir DEHB zihni için imkânsız bir meydan okuma..."
  ];

  const DOVUS_REPLIKLERI = [
    { at: 165, text: "Hahaha! İlk 15 saniye bitti, bence birazdan sıkılacaksın :P", mood: 'smug' },
    { at: 140, text: "Bir dakika... Hâlâ masada mısın sen? Şaka yapıyorsun!", mood: 'worried' },
    { at: 110, text: "Ah! Canım acıyor... 70 saniyedir buradasın, pes etsene be!", mood: 'pain' },
    { at: 75, text: "HAYIR! Zihnin odaklanıyor, gücüm eriyor... DUR!", mood: 'pain' },
    { at: 40, text: "YETERRR! BÖYLE BİR İNAT GÖRMEDİM, BEDENİM DAĞILIYOR!!", mood: 'critical' },
    { at: 15, text: "SON 15 SANİYE... YIKILIYORUM, FELÇ PARÇALANIYORR!!", mood: 'critical' }
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

  // 🔊 Ses Sentezleyicileri (Vurma, Kalp Atışı, Zafer)
  function playPunchSound(intensity = 1) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = intensity > 1.5 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(140 + (intensity * 20), ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25 * intensity, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  function playVictoryFanfare() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const t = ctx.currentTime + (i * 0.08);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (e) {}
  }

  // 👾 Özel SVG Boss Çizimi (Kademeli Yüz İfadeleri ve Alev Efekti)
  function getBossSVG(phase = 1) {
    let eyeLeft = '', eyeRight = '', mouth = '', auraColor = '', glowColor = '', sweat = '', cracks = '';

    if (phase === 1) {
      // Faz 1 (Kibirli & Alaycı)
      auraColor = '#8b5cf6'; glowColor = 'rgba(139, 92, 246, 0.5)';
      eyeLeft = '<polygon points="50,60 70,72 52,76" fill="#f43f5e" />';
      eyeRight = '<polygon points="110,60 90,72 108,76" fill="#f43f5e" />';
      mouth = '<path d="M 60 95 Q 80 115 100 95 Q 80 102 60 95" fill="#f43f5e" />';
    } else if (phase === 2) {
      // Faz 2 (Şaşırmış & Telaşlı)
      auraColor = '#f59e0b'; glowColor = 'rgba(245, 158, 11, 0.6)';
      eyeLeft = '<circle cx="60" cy="70" r="10" fill="#fbbf24" /><circle cx="60" cy="70" r="4" fill="#0f172a" />';
      eyeRight = '<circle cx="100" cy="70" r="10" fill="#fbbf24" /><circle cx="100" cy="70" r="4" fill="#0f172a" />';
      mouth = '<ellipse cx="80" cy="100" rx="12" ry="16" fill="#0f172a" stroke="#fbbf24" stroke-width="3" />';
      sweat = '<path d="M 120 50 Q 125 60 120 65 Q 115 60 120 50" fill="#38bdf8" class="animate-bounce" />';
    } else if (phase === 3) {
      // Faz 3 (Acı Çeken & Yaralanan)
      auraColor = '#f97316'; glowColor = 'rgba(249, 115, 22, 0.7)';
      eyeLeft = '<path d="M 50 68 L 70 76 M 50 76 L 70 68" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />';
      eyeRight = '<path d="M 90 76 L 110 68 M 90 68 L 110 76" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />';
      mouth = '<path d="M 55 105 Q 80 85 105 105" stroke="#ef4444" stroke-width="6" fill="none" stroke-linecap="round" />';
      cracks = '<path d="M 40 40 L 60 60 L 50 85 M 100 35 L 90 55 L 115 80" stroke="#fef08a" stroke-width="3" fill="none" class="animate-pulse" />';
      sweat = '<circle cx="125" cy="65" r="5" fill="#38bdf8" /><circle cx="35" cy="75" r="4" fill="#38bdf8" />';
    } else {
      // Faz 4 (Can Çekişen / Kritik)
      auraColor = '#ef4444'; glowColor = 'rgba(239, 68, 68, 0.9)';
      eyeLeft = '<path d="M 48 65 L 72 77 M 48 77 L 72 65" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />';
      eyeRight = '<path d="M 88 65 L 112 77 M 88 77 L 112 65" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />';
      mouth = '<path d="M 50 108 Q 80 80 110 108" stroke="#ffffff" stroke-width="8" fill="#450a0a" stroke-linecap="round" />';
      cracks = '<path d="M 30 30 L 60 60 L 40 90 L 80 110 L 120 70 L 135 35" stroke="#ffffff" stroke-width="4" fill="none" class="animate-ping" />';
    }

    return `
      <svg viewBox="0 0 160 160" class="w-36 h-36 md:w-44 md:h-44 transition-all duration-300" style="filter: drop-shadow(0 0 25px ${glowColor});">
        <!-- Boynuzlar -->
        <path d="M 35 45 Q 15 15 45 25 Q 40 38 35 45" fill="${auraColor}" stroke="#ffffff" stroke-width="2" />
        <path d="M 125 45 Q 145 15 115 25 Q 120 38 125 45" fill="${auraColor}" stroke="#ffffff" stroke-width="2" />
        
        <!-- Ana Gövde (Sis İblisi) -->
        <path d="M 80 20 C 130 20 145 60 140 100 C 135 135 115 145 80 145 C 45 145 25 135 20 100 C 15 60 30 20 80 20 Z" 
              fill="#0f172a" stroke="${auraColor}" stroke-width="4" />
        
        <!-- Yüz Öğeleri -->
        ${cracks}
        ${eyeLeft}
        ${eyeRight}
        ${mouth}
        ${sweat}
      </svg>
    `;
  }

  function getPhase(remaining) {
    if (remaining > 135) return 1; // 180-135 sn: Kibirli
    if (remaining > 90)  return 2; // 135-90 sn: Telaşlı
    if (remaining > 40)  return 3; // 90-40 sn: Acı çeken
    return 4;                      // 40-0 sn: Kritik / Dağılan
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
        @keyframes inatShakeLight { 0%, 100% { transform: translate(0, 0); } 25% { transform: translate(-3px, 2px); } 75% { transform: translate(3px, -2px); } }
        @keyframes inatShakeHard { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 20% { transform: translate(-8px, 6px) rotate(-3deg); } 40% { transform: translate(8px, -6px) rotate(3deg); } 60% { transform: translate(-6px, -4px) rotate(-2deg); } 80% { transform: translate(6px, 4px) rotate(2deg); } }
        @keyframes inatDamageFloat { 0% { opacity: 1; transform: translateY(0) scale(1.2); } 100% { opacity: 0; transform: translateY(-40px) scale(0.8); } }
        .inat-shake-1 { animation: inatShakeLight 2.5s infinite ease-in-out; }
        .inat-shake-2 { animation: inatShakeLight 0.6s infinite ease-in-out; }
        .inat-shake-3 { animation: inatShakeHard 0.35s infinite ease-in-out; }
        .inat-shake-4 { animation: inatShakeHard 0.15s infinite ease-in-out; }
        .damage-popup { position: absolute; font-weight: 900; font-family: monospace; animation: inatDamageFloat 0.8s forwards ease-out; pointer-events: none; z-index: 30; }
      </style>

      <div id="inat-card-root" class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-rose-500/50 rounded-3xl p-6 md:p-8 text-white shadow-2xl text-center animate-slide-in overflow-hidden">
        <button onclick="closeInatModu()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2 rounded-full hover:bg-slate-800 transition">✕</button>

        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-widest mb-3">
          <span>🥊</span> DEHB İnat Modu: Felç Kırıcı
        </div>

        <!-- Boss Görsel Alanı -->
        <div class="relative my-3 flex justify-center items-center min-h-[160px]" id="boss-container">
          <div id="boss-graphic" class="inat-shake-1">
            ${getBossSVG(1)}
          </div>
          <div id="damage-overlay" class="absolute inset-0 flex items-center justify-center pointer-events-none"></div>
        </div>

        <h3 id="boss-name" class="text-xl md:text-2xl font-black text-rose-400 tracking-tight">Erteleme İblisi: Procrastinon</h3>
        <p class="text-xs text-slate-400 font-mono mt-0.5">Hedef: "${currentTaskName}"</p>

        <!-- Kışkırtma Balonu -->
        <div id="boss-quote-box" class="my-4 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs md:text-sm italic font-semibold leading-relaxed shadow-inner">
          "${randomKiskirtma}"
        </div>

        <!-- Can Barı (HP) -->
        <div class="space-y-1.5 mb-5 text-left">
          <div class="flex justify-between text-[11px] font-mono font-bold text-slate-400">
            <span id="boss-status-tag" class="text-indigo-400">FAZ 1: KİBİRLİ VE RAHAT</span>
            <span id="boss-hp-text" class="text-rose-400 font-black">180 / 180 HP</span>
          </div>
          <div class="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5 shadow-inner">
            <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 rounded-full transition-all duration-300" style="width: 100%;"></div>
          </div>
        </div>

        <div id="inat-action-area">
          <button onclick="launchInatFight()" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-orange-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-base md:text-lg shadow-xl shadow-rose-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
            <span>🥊</span> HODRİ MEYDAN! GÖR BAK NASIL YAPIYORUM!
          </button>
          <p class="text-[11px] text-slate-500 mt-2">3 dakika masada kal, sekmeyi terk etme, canavarı devir!</p>
        </div>
      </div>
    `;
  };

  window.launchInatFight = function () {
    isFighting = true;
    playPunchSound(1);

    const actionArea = document.getElementById('inat-action-area');
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="space-y-2.5 animate-fade-in">
          <div class="text-4xl md:text-5xl font-mono font-black text-amber-400 tracking-tight" id="inat-time-display">
            03:00
          </div>
          <p id="boss-speech" class="text-xs text-rose-300 font-bold italic h-5 transition-all">
            "Hahaha! Süre başladı, ilk 30 saniyede kaçarsın!"
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

  function popDamageNumber(text, color = '#f43f5e') {
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
    const cardRoot = document.getElementById('inat-card-root');

    const phase = getPhase(remainingSeconds);

    // Can & Süre Güncelle
    const pct = Math.max(0, (remainingSeconds / TOTAL_HP) * 100);
    if (hpBar) {
      hpBar.style.width = pct + '%';
      if (phase === 4) hpBar.className = 'h-full bg-red-600 animate-pulse rounded-full';
      else if (phase === 3) hpBar.className = 'h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full';
    }
    if (hpText) hpText.textContent = `${remainingSeconds} / ${TOTAL_HP} HP`;

    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    if (timeDisplay) timeDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Faz Değişimleri ve Görsel/Sarsıntı Güncellemesi
    if (bossGraphic) {
      bossGraphic.className = `inat-shake-${phase}`;
      bossGraphic.innerHTML = getBossSVG(phase);
    }

    if (statusTag) {
      const tags = {
        1: 'FAZ 1: KİBİRLİ VE RAHAT',
        2: 'FAZ 2: TELAŞ VE ENDİŞE',
        3: 'FAZ 3: AĞIR HASAR & ÇATLAKLAR',
        4: 'FAZ 4: KRİTİK ÇÖKÜŞ!'
      };
      statusTag.textContent = tags[phase] || '';
      statusTag.className = phase === 4 ? 'text-rose-500 font-black animate-pulse' : phase === 3 ? 'text-orange-400 font-bold' : 'text-indigo-400';
    }

    // Hasar ve Ses Efektleri
    const intensity = phase >= 3 ? 1.8 : 1.0;
    if (remainingSeconds % 3 === 0) {
      playPunchSound(intensity);
      popDamageNumber('-1 HP', phase >= 3 ? '#ef4444' : '#fbbf24');
    }

    if (remainingSeconds === 90) popDamageNumber('💥 FELÇ ÇATLIYOR!', '#38bdf8');
    if (remainingSeconds === 30) popDamageNumber('⚡ KRİTİK DARBE!', '#f43f5e');

    // Dinamik Replikler
    for (const r of DOVUS_REPLIKLERI) {
      if (remainingSeconds === r.at && speech) {
        speech.textContent = `"${r.text}"`;
      }
    }

    // Zafer / Boss Devrildi!
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
      <div class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-emerald-500/60 rounded-3xl p-6 md:p-8 text-white text-center shadow-2xl animate-slide-in">
        <div class="text-7xl mb-2 animate-bounce">💥 🏆 💥</div>
        <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-widest">
          NAKAVT EDİLDİ! 0 HP
        </span>
        <h3 class="text-2xl md:text-3xl font-black text-white mt-3 tracking-tight">İNAT ETTİN VE BAŞLADIN!</h3>
        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
          Erteleme İblisini yerle bir ettin! En zor olan <span class="text-amber-400 font-bold">başlama felcini kırdın</span> ve beynin artık dopaminle akışa girdi.
        </p>

        <div class="my-5 p-4 bg-white/10 dark:bg-slate-800/80 rounded-2xl border border-white/10 text-left space-y-1">
          <p class="text-[10px] font-black uppercase tracking-wider text-indigo-300">Kazanılan Başarı:</p>
          <p class="text-sm font-bold text-white">🥊 "İnatçı Şampiyon" — 180 Saniyelik Direnç Kırıldı</p>
        </div>

        <div class="space-y-3">
          <button onclick="closeInatModuAndStartTimer()" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black text-base shadow-xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
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
