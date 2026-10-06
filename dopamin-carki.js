/* ══════════════════════════════════════════════════════════════
   FocusAid — 🎡 Dopamin Şans Çarkı (Wheel of Dopamine)
   Günün tüm görevleri bittiğinde kullanıcının hak ettiği ödülü
   eğlenceli, dopamin dolu bir çarkla kutlar.
   ══════════════════════════════════════════════════════════════ */

(function () {
  let isSpinning = false;
  let currentRotation = 0;

  /* Günde bir kez: kayıt tasks-logic.js'teki bugununCarkOdulu ile okunuyor. */
  function bugun() {
    return typeof bugunIstanbul === 'function' ? bugunIstanbul() : new Date().toISOString().slice(0, 10);
  }
  function anahtar() {
    return carkAnahtari(typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null);
  }
  function kazanilanOdul() {
    try { return bugununCarkOdulu(localStorage.getItem(anahtar()), bugun()); }
    catch (e) { return null; }
  }
  function odulKaydet(odul) {
    try { localStorage.setItem(anahtar(), JSON.stringify({ tarih: bugun(), odul })); } catch (e) {}
  }
  window.bugununCarkOdulunuAl = kazanilanOdul;

  /* ── Hesaptaki kayıt (profiles.cark_tarihi / cark_odulu) ──────────
     localStorage tek başına yetmiyordu: başka cihazdan aynı gün yeniden
     çevrilebiliyordu. Hak artık TEK bir koşullu UPDATE ile alınıyor —
     "cark_tarihi bugün değilse yaz". Satır dönerse hak bizim; dönmezse
     bugün başka bir yerde çevrilmiş demektir. İki cihaz aynı anda bassa
     bile Postgres yalnızca birini günceller.

     ⚠️ Bu kolonlar profileToRow'a BİLEREK eklenmedi: profil kaydı tüm satırı
     upsert ediyor; eski bir sekmeden yapılan profil kaydı bugünün çarkını
     silip hakkı geri verirdi.

     Ağ/şema hatasında kullanıcı CEZALANDIRILMAZ: yerel kayıtla devam edilir
     (fix-profiles-add-cark.sql çalıştırılmamışsa da böyle davranır). */
  function sunucuKullanilabilir() {
    return typeof isGuestMode !== 'undefined' && !isGuestMode
      && typeof currentUser !== 'undefined' && currentUser && currentUser.id
      && window.supabaseClient;
  }

  /** Hesapta bugünün ödülü: string | null (yok) | undefined (okunamadı). */
  async function sunucudakiOdul() {
    if (!sunucuKullanilabilir()) return undefined;
    try {
      const { data, error } = await window.supabaseClient
        .from('profiles').select('cark_tarihi, cark_odulu')
        .eq('id', currentUser.id).maybeSingle();
      if (error) throw error;
      return data && data.cark_tarihi === bugun() && data.cark_odulu ? data.cark_odulu : null;
    } catch (e) {
      console.warn('[Çark] hesaptaki kayıt okunamadı:', e);
      return undefined;
    }
  }

  /** Hakkı hesapta al. → {durum:'alindi'} | {durum:'zaten', odul} | {durum:'yerel'} */
  async function hakkiAl(odul) {
    if (!sunucuKullanilabilir()) return { durum: 'yerel' };
    const gun = bugun();
    try {
      const { data, error } = await window.supabaseClient
        .from('profiles')
        .update({ cark_tarihi: gun, cark_odulu: odul })
        .eq('id', currentUser.id)
        .or(`cark_tarihi.is.null,cark_tarihi.neq.${gun}`)
        .select('id');
      if (error) throw error;
      if (data && data.length) return { durum: 'alindi' };
      const onceki = await sunucudakiOdul();
      // Satır hiç yoksa (profili hiç kaydedilmemiş kullanıcı) güncellenecek bir
      // şey de yok — yerel kayıtla devam.
      return onceki ? { durum: 'zaten', odul: onceki } : { durum: 'yerel' };
    } catch (e) {
      console.warn('[Çark] hak hesapta alınamadı, yerel kayıtla devam:', e);
      return { durum: 'yerel' };
    }
  }

  /** İbreyi animasyonsuz kazanılan dilime getir. */
  function dilimeGetir(odul) {
    const slices = getSlices();
    const idx = slices.findIndex(d => d.text === odul);
    const spinner = document.getElementById('wheel-spinner');
    if (idx < 0 || !spinner) return;
    const arc = 360 / slices.length;
    spinner.style.transition = 'none';
    spinner.style.transform = `rotate(${270 - (idx * arc + arc / 2)}deg)`;
  }

  function getWheelModal() {
    let modal = document.getElementById('dopamin-carki-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dopamin-carki-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md hidden transition-all duration-300';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function getSlices() {
    let customReward = '🎯 Özel Profil Ödülün';
    try {
      if (window.userProfile && window.userProfile.motivationNote && window.userProfile.motivationNote.trim()) {
        customReward = '🎁 ' + window.userProfile.motivationNote.trim().slice(0, 30);
      }
    } catch (e) {}

    return [
      { text: customReward, bg: '#f59e0b', color: '#ffffff' },
      { text: '🛋️ Sıfır Vicdan Azabıyla Tembellik', bg: '#6366f1', color: '#ffffff' },
      { text: '🍫 Tatlı / Kahve Ismarla', bg: '#ec4899', color: '#ffffff' },
      { text: '🎬 Favori Dizinden 2 Bölüm', bg: '#8b5cf6', color: '#ffffff' },
      { text: '🎮 45 Dk Oyun / Sosyal Medya', bg: '#10b981', color: '#ffffff' },
      { text: '🚶 Müzikle Yürüyüş / Rahatlama', bg: '#06b6d4', color: '#ffffff' }
    ];
  }

  function playTickSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {}
  }

  function drawWheelCanvas() {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const slices = getSlices();
    const numSlices = slices.length;
    const arc = (2 * Math.PI) / numSlices;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    slices.forEach((slice, i) => {
      const angle = i * arc;
      ctx.beginPath();
      ctx.fillStyle = slice.bg;
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + arc);
      ctx.lineTo(cx, cy);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Dilim Metni
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = slice.color;
      ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(slice.text, radius - 20, 4);
      ctx.restore();
    });

    // Merkez halka
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();
  }

  window.openDopaminCarki = function () {
    if (isSpinning) return;
    const modal = getWheelModal();
    modal.classList.remove('hidden');

    modal.innerHTML = `
      <div class="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl p-6 md:p-8 text-white shadow-2xl text-center animate-slide-in overflow-hidden">
        <button onclick="closeDopaminCarki()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2 rounded-full hover:bg-slate-800 transition">✕</button>

        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest mb-2">
          <span>🎡</span> Günün Zafer Ödülü
        </div>

        <h3 class="text-2xl md:text-3xl font-black text-white tracking-tight">Dopamin Şans Çarkı</h3>
        <p class="text-xs text-slate-400 mt-1">Bugünün tüm hedeflerini bitirdin! Hak ettiğin ödülü belirlemek için çarkı çevir.</p>

        <!-- Çark Konteynırı -->
        <div class="relative my-6 flex items-center justify-center">
          <!-- İbre -->
          <div class="absolute -top-3 left-1/2 -translate-x-1/2 z-20 text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
            🔻
          </div>
          <div id="wheel-spinner" class="transition-all duration-[4000ms] ease-out" style="transform: rotate(0deg);">
            <canvas id="wheel-canvas" width="340" height="340" class="rounded-full shadow-2xl shadow-indigo-500/20"></canvas>
          </div>
        </div>

        <div id="wheel-action-area">
          <button id="spin-wheel-btn" onclick="spinWheel()" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-lg shadow-xl shadow-amber-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
            <span>🎡</span> ÇARKI ÇEVİR & ÖDÜLÜNÜ AL!
          </button>
        </div>
      </div>
    `;

    setTimeout(drawWheelCanvas, 50);
    // Bugün zaten çevrildiyse düğme yerine kazanılan ödül gösterilir.
    const odul = kazanilanOdul();
    if (odul) {
      dilimeGetir(odul);
      showWinningReward(odul, true);
      return;
    }
    // Bu cihazda kayıt yok — başka bir cihazda bugün çevrilmiş olabilir.
    sunucudakiOdul().then(sunucuda => {
      if (!sunucuda || isSpinning || modal.classList.contains('hidden')) return;
      odulKaydet(sunucuda);
      dilimeGetir(sunucuda);
      showWinningReward(sunucuda, true);
    });
  };

  window.spinWheel = async function () {
    if (isSpinning) return;
    const onceki = kazanilanOdul();
    if (onceki) { dilimeGetir(onceki); showWinningReward(onceki, true); return; }
    isSpinning = true;
    const btn = document.getElementById('spin-wheel-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Çark Dönüyor...';
    }

    const slices = getSlices();
    const numSlices = slices.length;
    const arcDegree = 360 / numSlices;

    // Rastgele bir dilim seç
    const winningIndex = Math.floor(Math.random() * numSlices);
    // Sonuç dönüş BAŞLAMADAN hesapta alınıyor (bkz. hakkiAl); yerelde de
    // tutuluyor ki çark dönerken modal kapatılıp açılırsa ikinci hak doğmasın.
    const hak = await hakkiAl(slices[winningIndex].text);
    if (hak.durum === 'zaten') {
      isSpinning = false;
      odulKaydet(hak.odul);
      dilimeGetir(hak.odul);
      showWinningReward(hak.odul, true);
      return;
    }
    odulKaydet(slices[winningIndex].text);
    // İbre tepede (270 derece) duruyor; o yüzden hesaplama:
    const extraRounds = 5 * 360; // 5 tam tur
    const targetSliceDegree = 270 - (winningIndex * arcDegree + arcDegree / 2);
    const finalDegree = currentRotation + extraRounds + ((targetSliceDegree - (currentRotation % 360) + 360) % 360);
    currentRotation = finalDegree;

    const spinner = document.getElementById('wheel-spinner');
    if (spinner) {
      spinner.style.transform = `rotate(${finalDegree}deg)`;
    }

    // Tıklama ses efekti aralığı
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      playTickSound();
      tickCount++;
      if (tickCount > 25) clearInterval(tickInterval);
    }, 150);

    setTimeout(() => {
      isSpinning = false;
      showWinningReward(slices[winningIndex].text);
    }, 4100);
  };

  function showWinningReward(rewardText, dahaOnceKazanildi) {
    if (!dahaOnceKazanildi && typeof confetti === 'function') {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }

    const actionArea = document.getElementById('wheel-action-area');
    if (actionArea) {
      // rewardText dilim metnidir; biri profildeki serbest metinden (motivationNote)
      // geliyor, o yüzden HTML olarak değil kaçırılarak basılır.
      rewardText = String(rewardText).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      actionArea.innerHTML = `
        <div class="p-6 bg-gradient-to-br from-amber-500/20 via-indigo-500/20 to-purple-500/20 rounded-3xl border-2 border-amber-400/60 shadow-2xl animate-slide-in space-y-3">
          <div class="text-4xl${dahaOnceKazanildi ? '' : ' animate-bounce'}">🎉 🏆 🎉</div>
          <span class="px-3 py-1 bg-amber-400/20 text-amber-300 text-xs font-black rounded-full uppercase tracking-widest">
            KAZANILAN GÜN SONU ÖDÜLÜ
          </span>
          <h4 class="text-2xl font-black text-white">${rewardText}</h4>
          <p class="text-xs text-slate-300">
            ${dahaOnceKazanildi
              ? 'Bugünün ödülünü zaten kazandın — çark günde bir kez döner. Yarın yeni bir zafer seni bekliyor!'
              : 'Tüm hedeflerini tamamladın. Vicdan azabı yok, ertelenmiş yük yok. Şimdi bu ödülün tadını çıkar!'}
          </p>
          <button onclick="closeDopaminCarki()" class="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition active:scale-95">
            Harika! Ödülümü Almaya Gidiyorum ➔
          </button>
        </div>
      `;
    }
  }

  window.closeDopaminCarki = function () {
    isSpinning = false;
    const modal = getWheelModal();
    modal.classList.add('hidden');
  };
})();
