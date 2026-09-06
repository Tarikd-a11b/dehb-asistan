/* ══════════════════════════════════════════════════════════════
   FocusAid — 📺 Çalışma Odaları (arayüz)

   Saf mantık `study-rooms-logic.js` içinde (katalog, kimlik çözümleme,
   süre metni). Burası yalnızca DOM ve oynatıcı.

   Neden `<iframe>`, neden YouTube IFrame API değil: odaya girmek "videoyu
   göster ve çekil" işi. API bir betik daha indirip global bir nesne kurardı;
   kazancı (programatik oynat/duraklat) burada bir işe yaramıyor, kullanıcı
   zaten oynatıcının kendi düğmelerini kullanıyor. Adres `youtube-nocookie`:
   izleme çerezi kullanıcı oynatmadan yazılmıyor.

   ⚠️ iframe adresine giren kimlik YALNIZCA `youtubeVideoIdCikar`tan gelir;
   o da 11 karakterlik beyaz listeye uymayan her şeyi reddeder. Kullanıcının
   yapıştırdığı metni doğrudan adrese koymak enjeksiyon kapısıdır.
   ══════════════════════════════════════════════════════════════ */

const OZEL_ODA_ANAHTARI = 'focusaid_ozel_odalar';
const SON_ODA_ANAHTARI = 'focusaid_son_oda';

const OdaState = {
  aktifOda: null,
  kalanSaniye: 50 * 60,
  toplamSaniye: 50 * 60,
  molada: false,
  calisiyor: false,
  sayacId: null
};

const ODA_ODAK_DK = 50;
const ODA_MOLA_DK = 10;

function ozelOdalariOku() {
  try {
    return ozelOdalariTemizle(JSON.parse(localStorage.getItem(OZEL_ODA_ANAHTARI) || '[]'));
  } catch (e) {
    return [];
  }
}

function ozelOdalariYaz(liste) {
  try {
    localStorage.setItem(OZEL_ODA_ANAHTARI, JSON.stringify(
      liste.map(o => ({ ad: o.ad, videoId: o.videoId }))
    ));
  } catch (e) { /* gizli sekmede depo kapalı olabilir; oda yine de açılır */ }
}

function tumOdalar() {
  return CALISMA_ODALARI.concat(ozelOdalariOku());
}

function odaKartiHtml(oda) {
  const sure = oda.dakika ? odaSuresiMetni(oda.dakika) : 'kendi eklediğin';
  const dongu = oda.dongu ? `<span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-[11px] font-bold">${oda.dongu}</span>` : '';
  return `
    <button type="button" data-oda="${oda.id}"
            class="oda-karti group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg transition-all active:scale-[0.99]">
      <div class="flex items-start gap-3">
        <span class="text-3xl shrink-0">${oda.simge}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-black text-slate-800 dark:text-slate-100">${oda.ad}</span>
            ${dongu}
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">${oda.aciklama}</p>
          <div class="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
            <span>⏱ ${sure}</span>
            ${oda.kanal ? `<span class="truncate">· ${oda.kanal}</span>` : ''}
          </div>
        </div>
      </div>
    </button>`;
}

function odalariCiz() {
  const kap = document.getElementById('oda-listesi');
  if (!kap) return;
  kap.innerHTML = tumOdalar().map(odaKartiHtml).join('');
  kap.querySelectorAll('[data-oda]').forEach(b => {
    b.addEventListener('click', () => odayaGir(b.dataset.oda));
  });
}

function odayaGir(odaId) {
  const oda = tumOdalar().find(o => o.id === odaId);
  if (!oda) return;
  OdaState.aktifOda = oda;
  try { localStorage.setItem(SON_ODA_ANAHTARI, oda.id); } catch (e) {}

  const sahne = document.getElementById('oda-sahne');
  const liste = document.getElementById('oda-liste-bolum');
  if (!sahne || !liste) return;
  liste.classList.add('hidden');
  sahne.classList.remove('hidden');

  document.getElementById('oda-baslik').textContent = `${oda.simge} ${oda.ad}`;
  document.getElementById('oda-altbaslik').textContent =
    oda.kanal ? `${oda.kanal} · ${oda.aciklama}` : oda.aciklama;

  // Kimlik beyaz listeden geçmiş olsa da adresi burada da kendimiz kuruyoruz;
  // hiçbir kullanıcı metni sorgu dizesine karışmıyor.
  //
  // ⚠️ `modestbranding` KULLANMA: YouTube onu 2023 Ağustos'ta kaldırdı (artık
  // hiçbir etkisi yok) ve amacı YouTube markasını gizlemekti. Gömme izni,
  // oynatıcının olduğu gibi gösterilmesi şartına bağlı — oynatıcıyı ya da
  // videoyu değiştirmek, markasını örtmek, reklamları engellemek gömme
  // hakkını düşürür. Oynatıcıya dokunmuyoruz.
  const cerceve = document.getElementById('oda-oynatici');
  cerceve.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(oda.videoId)}?rel=0&playsinline=1`;

  // Atıf: videoyu kaynağında açma yolu her zaman görünür dursun.
  const kaynak = document.getElementById('oda-kaynak');
  if (kaynak) {
    kaynak.href = `https://www.youtube.com/watch?v=${encodeURIComponent(oda.videoId)}`;
    kaynak.textContent = oda.kanal ? `▶ ${oda.kanal} — YouTube'da aç` : "▶ YouTube'da aç";
  }

  odaSayacSifirla();
}

function odadanCik() {
  const sahne = document.getElementById('oda-sahne');
  const liste = document.getElementById('oda-liste-bolum');
  const cerceve = document.getElementById('oda-oynatici');
  // Videoyu gerçekten durdurmak için adresi değiştirmek şart; sadece gizlemek
  // sesi arka planda çalmaya devam ettirir.
  // ⚠️ `src = ''` YAZMA: boş dize göreli adres sayılır ve iframe uygulamanın
  // KENDİSİNİ yükler (X-Frame-Options SAMEORIGIN olduğu için de yüklenir) —
  // iç içe bir FocusAid açılır. `about:blank` boş bir belge verir.
  if (cerceve) cerceve.src = 'about:blank';
  if (sahne) sahne.classList.add('hidden');
  if (liste) liste.classList.remove('hidden');
  odaSayacDurdur();
  OdaState.aktifOda = null;
}

/* ── Odanın kendi 50/10 sayacı ─────────────────────────────────
   Bugün ekranındaki görev sayacından bilinçli olarak AYRI: oradaki sayaç
   belirli bir göreve bağlı, buradaki odada geçirdiğin süreye. İkisini
   birbirine bağlamak, görev seçmeden odaya giren kullanıcıyı kilitlerdi. */

function odaSayacMetni() {
  const s = Math.max(0, OdaState.kalanSaniye);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function odaSayacCiz() {
  const kutu = document.getElementById('oda-sayac');
  const etiket = document.getElementById('oda-sayac-etiket');
  const btn = document.getElementById('oda-sayac-btn');
  if (kutu) kutu.textContent = odaSayacMetni();
  if (etiket) etiket.textContent = OdaState.molada ? 'MOLA' : 'ODAK';
  if (btn) btn.textContent = OdaState.calisiyor ? '⏸ Duraklat' : '▶ Başlat';
  const halka = document.getElementById('oda-sayac-halka');
  if (halka) {
    const oran = OdaState.toplamSaniye > 0 ? OdaState.kalanSaniye / OdaState.toplamSaniye : 0;
    halka.style.strokeDashoffset = String(251.32 - oran * 251.32);
  }
}

function odaSayacBaslat() {
  if (OdaState.calisiyor) return;
  OdaState.calisiyor = true;
  OdaState.sayacId = setInterval(() => {
    if (OdaState.kalanSaniye > 0) {
      OdaState.kalanSaniye--;
      odaSayacCiz();
      if (OdaState.kalanSaniye === 0) odaFazDegistir();
    }
  }, 1000);
  odaSayacCiz();
}

function odaSayacDurdur() {
  OdaState.calisiyor = false;
  if (OdaState.sayacId) clearInterval(OdaState.sayacId);
  OdaState.sayacId = null;
  odaSayacCiz();
}

function odaSayacDegistir() {
  if (OdaState.calisiyor) odaSayacDurdur(); else odaSayacBaslat();
}

function odaSayacSifirla() {
  odaSayacDurdur();
  OdaState.molada = false;
  OdaState.toplamSaniye = ODA_ODAK_DK * 60;
  OdaState.kalanSaniye = OdaState.toplamSaniye;
  odaSayacCiz();
}

/** Odak bitti → mola, mola bitti → odak. Sayaç kendiliğinden devam eder. */
function odaFazDegistir() {
  OdaState.molada = !OdaState.molada;
  OdaState.toplamSaniye = (OdaState.molada ? ODA_MOLA_DK : ODA_ODAK_DK) * 60;
  OdaState.kalanSaniye = OdaState.toplamSaniye;
  odaSayacCiz();
  if (typeof showToast === 'function') {
    showToast(OdaState.molada ? '☕ Mola zamanı — 10 dakika' : '🎯 Odak zamanı — 50 dakika', 'info');
  }
  if (typeof NotificationManager !== 'undefined' && NotificationManager.notifySessionComplete && !OdaState.molada) {
    NotificationManager.notifySessionComplete();
  }
}

function ozelOdaEkle() {
  const girisAlani = document.getElementById('ozel-oda-url');
  const adAlani = document.getElementById('ozel-oda-ad');
  if (!girisAlani) return;
  const videoId = youtubeVideoIdCikar(girisAlani.value);
  if (!videoId) {
    if (typeof showToast === 'function') showToast('Geçerli bir YouTube bağlantısı yapıştır.', 'error');
    return;
  }
  const mevcut = ozelOdalariOku();
  if (mevcut.some(o => o.videoId === videoId)) {
    if (typeof showToast === 'function') showToast('Bu video zaten odalarında.', 'info');
    return;
  }
  mevcut.push({ ad: (adAlani && adAlani.value) || 'Kendi odam', videoId });
  ozelOdalariYaz(ozelOdalariTemizle(mevcut));
  girisAlani.value = '';
  if (adAlani) adAlani.value = '';
  odalariCiz();
  if (typeof showToast === 'function') showToast('Oda eklendi.', 'success');
}

/** `loadPage('study-rooms')` bunu çağırıyor. */
function initStudyRooms() {
  odalariCiz();
  document.getElementById('oda-cik-btn')?.addEventListener('click', odadanCik);
  document.getElementById('oda-sayac-btn')?.addEventListener('click', odaSayacDegistir);
  document.getElementById('oda-sayac-sifirla')?.addEventListener('click', odaSayacSifirla);
  document.getElementById('ozel-oda-ekle-btn')?.addEventListener('click', ozelOdaEkle);
  document.getElementById('ozel-oda-url')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); ozelOdaEkle(); }
  });
  odaSayacCiz();
}

/** Sayfa değişince odadaki video arka planda çalmaya devam etmemeli. */
function odalardanAyril() {
  if (OdaState.aktifOda) odadanCik();
  else odaSayacDurdur();
}

if (typeof window !== 'undefined') {
  window.initStudyRooms = initStudyRooms;
  window.odayaGir = odayaGir;
  window.odadanCik = odadanCik;
  window.odalardanAyril = odalardanAyril;
  window.OdaState = OdaState;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OdaState, ODA_ODAK_DK, ODA_MOLA_DK };
}
