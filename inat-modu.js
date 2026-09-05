/* ══════════════════════════════════════════════════════════════
   FocusAid — 🥊 İnat Modu: Hodri Meydan (Sakin & Kademeli Yorulma v3)
   DEHB dostu, dikkat dağıtmayan, kademeli yorulma ve teslim olma mekaniği.
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

  const SAKIN_DURUM_METINLERI = [
    { at: 180, tag: "FAZ 1: DİK & KENDİNE GÜVENEN", quote: "3 dakika masada kal, pes ettiğimi gör!" },
    { at: 135, tag: "FAZ 2: HAFİFÇE YORULUYOR", quote: "Vay canına... Ciddi misin sen? Hâlâ buradasın." },
    { at: 90,  tag: "FAZ 3: DİZ ÇÖKÜYOR & NEFES NEFESE", quote: "Zihnin açılıyor... Gücüm tükeniyor, dayanamıyorum." },
    { at: 45,  tag: "FAZ 4: DİRENCİ TÜKENDİ (KRİTİK)", quote: "Son saniyeler... Böyle bir inat görmedim, teslim oluyorum..." }
  ];

  function getModal() {
    let modal = document.getElementById('inat-modu-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'inat-modu-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md hidden transition-all duration-300 select-none';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function playSoftVictory() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const notes = [261.63, 329.63, 392.00, 523.25];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        const t = ctx.currentTime + (i * 0.1);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (e) {}
  }

  function getPhase(remaining) {
    if (remaining > 135) return 1; // 180-135 sn: Dik & Kendine güvenen
    if (remaining > 90)  return 2; // 135-90 sn: Hafif yorulma
    if (remaining > 45)  return 3; // 90-45 sn: Diz çökme & Nefes nefese
    return 4;                      // 45-0 sn: Yere yığılma / Teslim olma
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
        /* Sakin, huzurlu nefes alma animasyonları (Dikkat dağıtmaz) */
        @keyframes calmBreathe1 {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.02); }
        }
        @keyframes calmTired2 {
          0%, 100% { transform: translateY(0) scale(0.98) rotate(0deg); opacity: 0.95; }
          50% { transform: translateY(4px) scale(0.95) rotate(-2deg); opacity: 0.9; }
        }
        @keyframes calmKneel3 {
          0%, 100% { transform: translateY(12px) scale(0.9, 0.85) rotate(-4deg); opacity: 0.85; }
          50% { transform: translateY(16px) scale(0.88, 0.82) rotate(-5deg); opacity: 0.8; }
        }
        @keyframes calmExhausted4 {
          0%, 100% { transform: translateY(22px) scale(0.82, 0.75) rotate(-8deg); opacity: 0.75; }
          50% { transform: translateY(26px) scale(0.8, 0.72) rotate(-10deg); opacity: 0.65; }
        }

        .calm-phase-1 { animation: calmBreathe1 3.5s infinite ease-in-out; }
        .calm-phase-2 { animation: calmTired2 2.5s infinite ease-in-out; }
        .calm-phase-3 { animation: calmKneel3 1.8s infinite ease-in-out; }
        .calm-phase-4 { animation: calmExhausted4 1.2s infinite ease-in-out; }
      </style>

      <div id="inat-card-root" class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/60 rounded-3xl p-6 md:p-8 text-white shadow-2xl text-center animate-slide-in overflow-hidden">
        <button onclick="closeInatModu()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2 rounded-full hover:bg-slate-800 transition">✕</button>

        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
          <span>🥊</span> DEHB İnat Modu: 3 Dakika Odak
        </div>

        <!-- SAKİN KARAKTER ALANI -->
        <div class="relative my-4 flex justify-center items-center min-h-[200px] md:min-h-[230px]" id="boss-arena">
          <!-- Zemin Gölgesi -->
          <div class="absolute bottom-2 w-32 h-4 bg-black/40 rounded-full blur-sm pointer-events-none transition-all duration-500" id="char-shadow"></div>

          <!-- Karakter Görseli -->
          <div id="boss-character-wrap" class="calm-phase-1 relative transition-all duration-700">
            <img id="boss-character-img" src="inat-boss.png" alt="Karakter" 
                 class="w-44 h-44 md:w-52 md:h-52 object-contain select-none pointer-events-none transition-all duration-700">
          </div>
        </div>

        <h3 id="boss-name" class="text-lg md:text-xl font-bold text-slate-200 tracking-tight">Erteleme Direnci</h3>
        <p class="text-xs text-slate-400 font-mono mt-0.5">Hedef: "${currentTaskName}"</p>

        <!-- Kışkırtma / Durum Balonu -->
        <div id="boss-quote-box" class="my-4 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs md:text-sm italic leading-relaxed">
          "${randomKiskirtma}"
        </div>

        <!-- İnce Can & Süre Barı -->
        <div class="space-y-1.5 mb-5 text-left">
          <div class="flex justify-between text-[11px] font-mono font-bold text-slate-400">
            <span id="boss-status-tag" class="text-indigo-300">FAZ 1: DİK & KENDİNE GÜVENEN</span>
            <span id="boss-hp-text" class="text-slate-300 font-semibold">180 / 180 sn</span>
          </div>
          <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/80">
            <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 rounded-full transition-all duration-500" style="width: 100%;"></div>
          </div>
        </div>

        <div id="inat-action-area">
          <button onclick="launchInatFight()" class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-base shadow-lg shadow-indigo-600/25 active:scale-98 transition-all flex items-center justify-center gap-2">
            <span>🥊</span> HODRİ MEYDAN! SÜREYİ BAŞLAT
          </button>
          <p class="text-[11px] text-slate-500 mt-2">Sadece 3 dakika masada kal ve göreve göz at. Başlama felcini kır!</p>
        </div>
      </div>
    `;
  };

  window.launchInatFight = function () {
    isFighting = true;

    const actionArea = document.getElementById('inat-action-area');
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="space-y-2 animate-fade-in">
          <div class="text-4xl md:text-5xl font-mono font-bold text-amber-300 tracking-tight" id="inat-time-display">
            03:00
          </div>
          <p id="boss-speech" class="text-xs text-slate-400 italic h-5 transition-all">
            "Süre işliyor... Sadece masada kal ve göreve odaklan."
          </p>
          <div class="p-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50 text-slate-300 text-xs text-left flex items-center gap-2.5">
            <span class="text-base">💡</span>
            <div class="text-[11px] text-slate-400">
              Görevi bitirmek zorunda değilsin, sadece masadan kalkma. Direnç kademe kademe eriyecek.
            </div>
          </div>
        </div>
      `;
    }

    inatTimer = setInterval(tickInatFight, 1000);
  };

  function tickInatFight() {
    if (!isFighting) return;
    remainingSeconds--;

    const hpBar = document.getElementById('boss-hp-bar');
    const hpText = document.getElementById('boss-hp-text');
    const timeDisplay = document.getElementById('inat-time-display');
    const speech = document.getElementById('boss-speech');
    const charWrap = document.getElementById('boss-character-wrap');
    const statusTag = document.getElementById('boss-status-tag');
    const charImg = document.getElementById('boss-character-img');
    const shadow = document.getElementById('char-shadow');

    const phase = getPhase(remainingSeconds);

    // Can & Süre Güncelle
    const pct = Math.max(0, (remainingSeconds / TOTAL_HP) * 100);
    if (hpBar) {
      hpBar.style.width = pct + '%';
    }
    if (hpText) hpText.textContent = `${remainingSeconds} / ${TOTAL_HP} sn`;

    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    if (timeDisplay) timeDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Sakin Kademeli Yorulma Durumu
    if (charWrap) {
      charWrap.className = `calm-phase-${phase} relative transition-all duration-700`;
    }

    if (charImg) {
      if (phase === 4) {
        charImg.style.filter = 'grayscale(60%) opacity(0.7)';
      } else if (phase === 3) {
        charImg.style.filter = 'grayscale(35%) opacity(0.85)';
      } else if (phase === 2) {
        charImg.style.filter = 'grayscale(15%) opacity(0.95)';
      } else {
        charImg.style.filter = 'none';
      }
    }

    if (shadow) {
      if (phase === 4) shadow.style.width = '24px';
      else if (phase === 3) shadow.style.width = '28px';
      else shadow.style.width = '32px';
    }

    // Durum Başlığı ve Replik
    for (const item of SAKIN_DURUM_METINLERI) {
      if (remainingSeconds <= item.at) {
        if (statusTag) statusTag.textContent = item.tag;
        if (speech && remainingSeconds === item.at) {
          speech.textContent = `"${item.quote}"`;
        }
      }
    }

    // Zafer / Direnç Tamamen Kırıldı!
    if (remainingSeconds <= 0) {
      clearInterval(inatTimer);
      inatTimer = null;
      renderInatVictory();
    }
  }

  function renderInatVictory() {
    playSoftVictory();
    if (typeof confetti === 'function') {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    const modal = getModal();
    modal.innerHTML = `
      <div class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-3xl p-6 md:p-8 text-white text-center shadow-2xl animate-slide-in">
        <div class="text-6xl mb-2 animate-bounce">🏳️ ✨ 🏆</div>
        <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          DİRENÇ KIRILDI! 3 DAKİKA TAMAMLANDI
        </span>
        <h3 class="text-xl md:text-2xl font-bold text-white mt-3 tracking-tight">HARİKASIN, İNAT ETTİN VE BAŞLADIN!</h3>
        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
          Erteleme hissi teslim oldu. En zor olan <span class="text-emerald-400 font-bold">ilk adımı attın</span> ve beynin artık odaklanmaya hazır.
        </p>

        <div class="my-5 p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-left">
          <p class="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Kazanılan İvme:</p>
          <p class="text-xs text-slate-200">🥊 3 dakikalık direnç eşiği aşıldı, odak akışı devrede.</p>
        </div>

        <div class="space-y-2.5">
          <button onclick="closeInatModuAndStartTimer()" class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2">
            <span>🚀</span> İVMEYLE DEVAM ET (25 DK ODAK SEANSI)
          </button>
          <button onclick="closeInatModu()" class="w-full py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition">
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
