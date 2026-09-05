/* ══════════════════════════════════════════════════════════════
   FocusAid — 🥊 İnat Modu: Hodri Meydan (Büyük Karakter & Zıplama/Dönme Animasyonları)
   Kullanıcının seçtiği karakter görseliyle canı azaldıkça
   zıplayan, dönen, sarsılan ve acı çeken dinamik dövüş motoru.
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
    { at: 165, text: "Hahaha! İlk 15 saniye bitti, birazdan sıkılacaksın :P" },
    { at: 140, text: "Bir dakika... Hâlâ masada mısın sen?! Şaka yapıyorsun!" },
    { at: 110, text: "Ah! Canım yanıyor... 70 saniyedir buradasın, dur artık!" },
    { at: 75, text: "HAYIR! Zihnin odaklanıyor, gücüm tükeniyor, DURRR!" },
    { at: 40, text: "YETERRR! BÖYLE BİR İNAT GÖRMEDİM, BAŞIM DÖNÜYORRR!!" },
    { at: 15, text: "SON 15 SANİYE! DİRENCİM PARÇALANDI, YIKILIYORUMMM!!" }
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

  // 🔊 8-Bit & Vuruş Ses Efektleri
  function playHitSound(phase = 1) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = phase >= 3 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(120 + (phase * 30), ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
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
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const t = ctx.currentTime + (i * 0.08);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (e) {}
  }

  function getPhase(remaining) {
    if (remaining > 135) return 1; // 180-135 sn: Sakin & Kibirli süzülme
    if (remaining > 90)  return 2; // 135-90 sn: Telaşlı Zıplama & Terleme
    if (remaining > 40)  return 3; // 90-40 sn: Şiddetli Zıplama + Sağa Sola Dönme
    return 4;                      // 40-0 sn: Çılgınca Fırıldak Dönme + Şiddetli Sarsıntı
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
        /* 1. Faz: Kibirli hafif süzülme */
        @keyframes charFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(2deg); }
        }
        /* 2. Faz: Telaşlı Zıplama */
        @keyframes charJumpPanic {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
          30% { transform: translateY(-35px) scale(1.08) rotate(-6deg); }
          60% { transform: translateY(6px) scale(0.95) rotate(4deg); }
        }
        /* 3. Faz: Ağır Hasar - Zıplama + Sağa Sola Dönüşler */
        @keyframes charTwistJump {
          0% { transform: translateY(0) rotate(0deg) scale(1); filter: drop-shadow(0 0 15px rgba(249, 115, 22, 0.7)); }
          25% { transform: translateY(-45px) rotate(-18deg) scale(1.12); }
          50% { transform: translateY(8px) rotate(18deg) scale(0.92); }
          75% { transform: translateY(-25px) rotate(-10deg) scale(1.05); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        /* 4. Faz: Kritik Çöküş - Kendi Etrafında Fırıldak Gibi Dönme + Titreme */
        @keyframes charSpinFrenzy {
          0% { transform: translateY(0) rotate(0deg) scale(1.1); filter: drop-shadow(0 0 25px rgba(239, 68, 68, 0.95)) hue-rotate(0deg); }
          25% { transform: translateY(-30px) rotate(90deg) scale(1.2); }
          50% { transform: translateY(10px) rotate(180deg) scale(0.85); }
          75% { transform: translateY(-30px) rotate(270deg) scale(1.2); }
          100% { transform: translateY(0) rotate(360deg) scale(1.1); filter: drop-shadow(0 0 30px rgba(239, 68, 68, 1)) hue-rotate(90deg); }
        }
        /* Hasar Sayaçları */
        @keyframes damagePopupFloat {
          0% { opacity: 1; transform: translateY(0) scale(1.3); }
          100% { opacity: 0; transform: translateY(-50px) scale(0.8); }
        }

        .char-phase-1 { animation: charFloat 2.2s infinite ease-in-out; }
        .char-phase-2 { animation: charJumpPanic 0.7s infinite ease-in-out; }
        .char-phase-3 { animation: charTwistJump 0.45s infinite ease-in-out; }
        .char-phase-4 { animation: charSpinFrenzy 0.35s infinite linear; }
        .damage-float-tag { position: absolute; font-weight: 900; font-family: monospace; animation: damagePopupFloat 0.75s forwards ease-out; pointer-events: none; z-index: 40; }
      </style>

      <div id="inat-card-root" class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-6 md:p-8 text-white shadow-2xl text-center animate-slide-in overflow-hidden">
        <button onclick="closeInatModu()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2 rounded-full hover:bg-slate-800 transition">✕</button>

        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest mb-2">
          <span>🥊</span> DEHB İnat Modu: Felç Kırıcı
        </div>

        <!-- BÜYÜK KARAKTER ARENASI -->
        <div class="relative my-4 flex justify-center items-center min-h-[220px] md:min-h-[260px] overflow-visible" id="boss-arena">
          <!-- Gölge Efekti -->
          <div class="absolute bottom-2 w-36 h-6 bg-black/50 rounded-full blur-md pointer-events-none"></div>

          <!-- Ana Karakter (Büyük Boyut) -->
          <div id="boss-character-wrap" class="char-phase-1 relative transition-all duration-300">
            <img id="boss-character-img" src="inat-boss.png" alt="Erteleme Karakteri" 
                 class="w-52 h-52 md:w-64 md:h-64 object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] select-none pointer-events-none transition-all duration-300">
            
            <!-- Ter / Kıvılcım Efektleri -->
            <div id="char-effects-overlay" class="absolute inset-0 flex items-center justify-center pointer-events-none"></div>
          </div>

          <div id="damage-overlay" class="absolute inset-0 flex items-center justify-center pointer-events-none"></div>
        </div>

        <h3 id="boss-name" class="text-xl md:text-2xl font-black text-amber-400 tracking-tight">Erteleme Efendisi</h3>
        <p class="text-xs text-slate-400 font-mono mt-0.5">Hedef: "${currentTaskName}"</p>

        <!-- Kışkırtma Balonu -->
        <div id="boss-quote-box" class="my-3 p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs md:text-sm italic font-semibold leading-relaxed shadow-inner">
          "${randomKiskirtma}"
        </div>

        <!-- Can Barı (HP) -->
        <div class="space-y-1.5 mb-5 text-left">
          <div class="flex justify-between text-[11px] font-mono font-bold text-slate-400">
            <span id="boss-status-tag" class="text-amber-400">FAZ 1: KİBİRLİ VE RAHAT</span>
            <span id="boss-hp-text" class="text-amber-400 font-black">180 / 180 HP</span>
          </div>
          <div class="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5 shadow-inner">
            <div id="boss-hp-bar" class="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-full transition-all duration-300" style="width: 100%;"></div>
          </div>
        </div>

        <div id="inat-action-area">
          <button onclick="launchInatFight()" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-base md:text-lg shadow-xl shadow-amber-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
            <span>🥊</span> HODRİ MEYDAN! GÖR BAK NASIL YAPIYORUM!
          </button>
          <p class="text-[11px] text-slate-500 mt-2">3 dakika masada kal, sekmeyi terk etme, canavarı devir!</p>
        </div>
      </div>
    `;
  };

  window.launchInatFight = function () {
    isFighting = true;
    playHitSound(1);

    const actionArea = document.getElementById('inat-action-area');
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="space-y-2.5 animate-fade-in">
          <div class="text-4xl md:text-5xl font-mono font-black text-amber-400 tracking-tight" id="inat-time-display">
            03:00
          </div>
          <p id="boss-speech" class="text-xs text-amber-300 font-bold italic h-5 transition-all">
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

  function popDamageNumber(text, color = '#fbbf24') {
    const overlay = document.getElementById('damage-overlay');
    if (!overlay) return;
    const pop = document.createElement('div');
    pop.className = 'damage-float-tag text-lg md:text-xl font-black';
    pop.style.color = color;
    const offsetX = (Math.random() * 120) - 60;
    const offsetY = (Math.random() * 60) - 30;
    pop.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    pop.textContent = text;
    overlay.appendChild(pop);
    setTimeout(() => pop.remove(), 750);
  }

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

    const phase = getPhase(remainingSeconds);

    // Can & Süre Güncelle
    const pct = Math.max(0, (remainingSeconds / TOTAL_HP) * 100);
    if (hpBar) {
      hpBar.style.width = pct + '%';
      if (phase === 4) hpBar.className = 'h-full bg-rose-600 animate-pulse rounded-full';
      else if (phase === 3) hpBar.className = 'h-full bg-gradient-to-r from-rose-500 to-orange-500 rounded-full';
      else if (phase === 2) hpBar.className = 'h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full';
    }
    if (hpText) hpText.textContent = `${remainingSeconds} / ${TOTAL_HP} HP`;

    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    if (timeDisplay) timeDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Faz Değişimleri: Zıplama, Dönme, Sarsıntı
    if (charWrap) {
      charWrap.className = `char-phase-${phase} relative transition-all duration-300`;
    }

    if (charImg) {
      if (phase === 4) {
        charImg.style.filter = 'drop-shadow(0 0 25px rgba(239, 68, 68, 0.9)) saturate(1.8) contrast(1.2)';
      } else if (phase === 3) {
        charImg.style.filter = 'drop-shadow(0 0 20px rgba(249, 115, 22, 0.8)) saturate(1.5)';
      } else if (phase === 2) {
        charImg.style.filter = 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.6))';
      } else {
        charImg.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,0.6))';
      }
    }

    if (statusTag) {
      const tags = {
        1: 'FAZ 1: KİBİRLİ VE RAHAT',
        2: 'FAZ 2: TELAŞLA ZIPLIYOR & TERLİYOR!',
        3: 'FAZ 3: AĞIR HASAR - SAĞA SOLA KIVRANIYOR!',
        4: 'FAZ 4: BAŞI DÖNÜYOR - FIRILDAK GİBİ FIRLIYOR!!'
      };
      statusTag.textContent = tags[phase] || '';
      statusTag.className = phase === 4 ? 'text-rose-500 font-black animate-pulse' : phase === 3 ? 'text-orange-400 font-bold' : phase === 2 ? 'text-amber-400 font-bold' : 'text-amber-300';
    }

    // Hasar ve Ses Efektleri
    if (remainingSeconds % 3 === 0) {
      playHitSound(phase);
      popDamageNumber('-1 HP', phase === 4 ? '#ef4444' : phase === 3 ? '#f97316' : '#fbbf24');
    }

    if (remainingSeconds === 90) popDamageNumber('💥 ZIPLAYARAK KAÇIYOR!', '#38bdf8');
    if (remainingSeconds === 30) popDamageNumber('⚡ BAŞI DÖNÜYOR!', '#ef4444');

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
      <div class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-amber-400/60 rounded-3xl p-6 md:p-8 text-white text-center shadow-2xl animate-slide-in">
        <div class="text-7xl mb-2 animate-bounce">🏆 💥 🏆</div>
        <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-widest">
          NAKAVT EDİLDİ! 0 HP
        </span>
        <h3 class="text-2xl md:text-3xl font-black text-white mt-3 tracking-tight">İNAT ETTİN VE BAŞLADIN!</h3>
        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
          Erteleme canavarını dize getirdin! En zor olan <span class="text-amber-400 font-bold">başlama felcini kırdın</span> ve beynin artık dopaminle akışa girdi.
        </p>

        <div class="my-5 p-4 bg-white/10 dark:bg-slate-800/80 rounded-2xl border border-white/10 text-left space-y-1">
          <p class="text-[10px] font-black uppercase tracking-wider text-amber-300">Kazanılan Başarı:</p>
          <p class="text-sm font-bold text-white">🥊 "İnatçı Şampiyon" — 180 Saniyelik Direnç Kırıldı</p>
        </div>

        <div class="space-y-3">
          <button onclick="closeInatModuAndStartTimer()" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-base shadow-xl shadow-amber-500/25 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
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
