/* ══════════════════════════════════════════════════════════════
   FocusAid — 🥊 İnat Modu: Hodri Meydan (DEHB Felç Kırıcı Boss Dövüşü)
   "3 dakika bile dayanamazsın" kışkırtmasıyla direnci inada ve eyleme çevirir.
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
    "3 dakika odaklanmak mı? Senin gibi bir DEHB zihni için imkânsız bir görev..."
  ];

  const DOVUS_REPLIKLERI = [
    { at: 150, text: "Vay canına... Ciddi misin sen? Hâlâ buradasın!" },
    { at: 110, text: "Ah! Canım yanıyor... 70 saniyedir masadasın, pes etmeyecek misin?!" },
    { at: 60, text: "HAYIR! Zihnin odaklanıyor, gücümü kaybediyorum!" },
    { at: 20, text: "SON 20 SANİYE! BÖYLE BİR İNAT GÖRMEDİM, YIKILIYORUM!!" }
  ];

  function getModal() {
    let modal = document.getElementById('inat-modu-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'inat-modu-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md hidden transition-all duration-300';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function playPunchSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  function playVictoryFanfare() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        const t = ctx.currentTime + (i * 0.1);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    } catch (e) {}
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
      <div class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-rose-500/50 rounded-3xl p-6 md:p-8 text-white shadow-2xl shadow-rose-950/80 text-center animate-slide-in overflow-hidden">
        <button onclick="closeInatModu()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2 rounded-full hover:bg-slate-800 transition">✕</button>

        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-widest mb-4">
          <span>🥊</span> DEHB İnat Modu: Felç Kırıcı
        </div>

        <div class="relative my-4 flex justify-center">
          <div id="boss-avatar" class="text-7xl md:text-8xl filter drop-shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-bounce duration-1000">
            👾
          </div>
        </div>

        <h3 class="text-xl font-black text-rose-400 tracking-tight">Erteleme Canavarı (Seviye 99)</h3>
        <p class="text-xs text-slate-400 font-mono mt-0.5">Hedef: "${currentTaskName}"</p>

        <!-- Kışkırtma Balonu -->
        <div class="my-5 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-sm italic font-semibold leading-relaxed shadow-inner">
          "${randomKiskirtma}"
        </div>

        <!-- Can Barı -->
        <div class="space-y-1.5 mb-6 text-left">
          <div class="flex justify-between text-[11px] font-mono font-bold text-slate-400">
            <span>CANAVARIN CANI (HP)</span>
            <span id="boss-hp-text" class="text-rose-400 font-black">180 / 180</span>
          </div>
          <div class="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
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
    playPunchSound();

    const actionArea = document.getElementById('inat-action-area');
    if (actionArea) {
      actionArea.innerHTML = `
        <div class="space-y-3 animate-fade-in">
          <div class="text-4xl md:text-5xl font-mono font-black text-amber-400 tracking-tight" id="inat-time-display">
            03:00
          </div>
          <p id="boss-speech" class="text-xs text-rose-300 font-bold italic h-6 transition-all">
            "Hahaha! Süre başladı, ilk 30 saniyede kaçarsın!"
          </p>
          <div class="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 text-slate-300 text-xs text-left flex items-center gap-3">
            <span class="text-2xl">💡</span>
            <div>
              <span class="font-bold text-white">İnat Görevin:</span> Sadece masada kal ve görevin ilk satırına/dosyasına 3 dakika boyunca göz at. Bitirmek zorunda değilsin, sadece masadan kalkma!
            </div>
          </div>
        </div>
      `;
    }

    const bossAvatar = document.getElementById('boss-avatar');
    if (bossAvatar) {
      bossAvatar.classList.remove('animate-bounce');
      bossAvatar.classList.add('animate-pulse');
    }

    inatTimer = setInterval(tickInatFight, 1000);
  };

  function tickInatFight() {
    if (!isFighting) return;
    remainingSeconds--;

    // Can & Süre Güncelle
    const hpBar = document.getElementById('boss-hp-bar');
    const hpText = document.getElementById('boss-hp-text');
    const timeDisplay = document.getElementById('inat-time-display');
    const speech = document.getElementById('boss-speech');
    const bossAvatar = document.getElementById('boss-avatar');

    const pct = Math.max(0, (remainingSeconds / TOTAL_HP) * 100);
    if (hpBar) hpBar.style.width = pct + '%';
    if (hpText) hpText.textContent = `${remainingSeconds} / ${TOTAL_HP}`;

    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    if (timeDisplay) timeDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Boss Vurulma Efekti (Punch)
    if (remainingSeconds % 5 === 0) playPunchSound();

    // Dinamik Replikler
    for (const r of DOVUS_REPLIKLERI) {
      if (remainingSeconds === r.at && speech) {
        speech.textContent = `"${r.text}"`;
        if (bossAvatar) bossAvatar.textContent = '😫';
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
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }

    const modal = getModal();
    modal.innerHTML = `
      <div class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-emerald-500/60 rounded-3xl p-6 md:p-8 text-white text-center shadow-2xl animate-slide-in">
        <div class="text-7xl mb-3 animate-bounce">💥 🏆 💥</div>
        <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-widest">
          NAKAVT EDİLDİ! 0 HP
        </span>
        <h3 class="text-2xl md:text-3xl font-black text-white mt-3 tracking-tight">İNAT ETTİN VE BAŞLADIN!</h3>
        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
          Erteleme canavarını ezdin geçtin! En zor olan <span class="text-amber-400 font-bold">başlama felcini kırdın</span> ve beynin artık odaklanmaya hazır.
        </p>

        <div class="my-6 p-4 bg-white/10 dark:bg-slate-800/80 rounded-2xl border border-white/10 text-left space-y-1">
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
    // Normal görev sayacını başlat
    if (typeof toggleTaskTimer === 'function') {
      setTimeout(() => {
        toggleTaskTimer();
      }, 300);
    }
  };
})();
