/* ══════════════════════════════════════════════════════════════
   FocusAid — 🟢 Canlı Çalışma Odaları (arayüz)

   Saf mantık `live-rooms-logic.js` içinde (sayaç fazları, boşta durumu,
   userData temizleme). Burası DOM + Daily + Supabase.
   Spec: docs/superpowers/specs/2026-10-13-canli-calisma-odalari-design.md

   SAĞLAYICI (bkz. CANLI_SAGLAYICI_VARSAYILAN): varsayılan 'jitsi' — oda
   meet.jit.si'de YENİ SEKMEDE açılır; bu sekmede yalnız kişisel sayaç, mola,
   oturum kaydı ve çıkış sorusu çalışır. Jitsi'nin ücretsiz sürümü gömülünce
   5 dk'da kesiyor, o yüzden iframe değil. Jitsi'de görüşme başka sekmede
   olduğu için `call` yerine boş bir vekil nesne durur (_canliJitsiOturumu)
   ve boşta kontrolü KAPALI (kullanıcı haklı olarak bu sekmeye dokunmuyor).
   Testler window.FOCUSAID_CANLI_SAGLAYICI = 'daily' ile Daily yolunu da koşar.

   Neden Daily "call object" (Prebuilt iframe değil): kamerasız katılanın
   hedef kartı, "☕ molada" rozeti ve sakin görünüm ancak kendi ızgaramızla
   olur. Kutucuklar burada çiziliyor.

   ⚠️ ODA KATMANI BODY SEVİYESİNDE (`#canli-oda-katman`), şablonun içinde
   DEĞİL: `loadPage` main'i her sayfa değişiminde siliyor; görüntü öğeleri
   orada olsaydı bağlantı her gezinmede kopardı. Sayfa değişince katman
   mini görünüme iner (`canliSayfaDegisti`), oda bağlantısı sürer.
   Ayrıca şablon içinde position:fixed yasak (bkz. CLAUDE.md Tuzaklar).

   ⚠️ Başkalarından gelen ad/hedef GÜVENİLMEZ: yalnız textContent ile basılır,
   innerHTML'e hiç girmez.
   ══════════════════════════════════════════════════════════════ */

const CANLI_DAILY_JS = 'https://unpkg.com/@daily-co/daily-js@0.92.2/dist/daily.js';
const CANLI_SON_ODA_ANAHTARI = 'focusaid_son_canli_oda';

const CanliState = {
  call: null,
  oda: null,
  sayac: null,
  hedef: '',
  taskId: null,
  taskAd: '',
  seansId: null,
  gorunum: 'tam',
  kamera: true,
  mikrofon: false,
  sonEtkilesim: 0,
  bostaSoruBasi: null,
  tikId: null,
  kalpId: null,
  cikiliyor: false,
  gizlenenler: new Set(),
  sonFaz: null,
  onayVar: null,
  jitsiAdlari: null,
  jitsiAdZamani: 0
};

// Ad haftada bir değişir (Pazartesi 04:00); açık kalan sekme eskisini tutmasın.
const CANLI_JITSI_AD_ONBELLEK_MS = 30 * 60 * 1000;

function _canliSaglayici() {
  const z = typeof window !== 'undefined' && window.FOCUSAID_CANLI_SAGLAYICI;
  return z === 'daily' || z === 'jitsi' ? z : CANLI_SAGLAYICI_VARSAYILAN;
}

function _canliJitsiMi() {
  return _canliSaglayici() === 'jitsi';
}

function _canliMisafir() {
  return (typeof isGuestMode !== 'undefined' && isGuestMode) || typeof currentUser === 'undefined' || !currentUser;
}

function _canliSb() {
  return (typeof sb !== 'undefined' && sb) || window.supabaseClient;
}

async function _canliToken() {
  try {
    const { data } = await _canliSb().auth.getSession();
    if (data?.session?.access_token) return data.session.access_token;
  } catch (e) { /* aşağıdaki yedek */ }
  return (typeof AppState !== 'undefined' && AppState.supabaseToken) || null;
}

function _canliToast(metin, tur = 'info') {
  if (typeof showToast === 'function') showToast(metin, tur);
}

function _el(etiket, sinif, metin) {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metin !== undefined) e.textContent = metin;
  return e;
}

function _canliSonOdaOku() {
  try { return JSON.parse(localStorage.getItem(CANLI_SON_ODA_ANAHTARI) || 'null'); } catch (e) { return null; }
}

/* ── Lobi (Çalışma Odaları sayfasının üst bölümü) ───────────────── */

async function initCanliOdalar() {
  const kap = document.getElementById('canli-oda-listesi');
  const not = document.getElementById('canli-oda-not');
  if (!kap) return;
  kap.innerHTML = '';
  if (_canliMisafir()) {
    if (not) not.textContent = 'Canlı odalar Google ile giriş yapınca açılır.';
    _canliKartlariCiz(kap, canliOdaSirala(null), true);
    return;
  }
  if (CanliState.call) {
    if (not) not.textContent = '';
    const b = _el('button', 'w-full p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-left transition',
      `🟢 ${CanliState.oda.simge} ${CanliState.oda.ad} odasındasın — büyütmek için dokun`);
    b.type = 'button';
    b.dataset.canliDon = '1';
    b.addEventListener('click', () => canliGorunum('tam'));
    kap.appendChild(b);
    return;
  }
  if (_canliJitsiMi()) {
    if (not) not.textContent = 'Oda Jitsi Meet\'te yeni sekmede açılır; sayacın bu sekmede işler. Odaya ilk giren bir kez Google ile giriş yapar.';
    _canliSonOdaDugmesi(kap);
    _canliKartlariCiz(kap, canliOdaSirala(null), false, true);
    _canliJitsiAdlariGetir();       // girişe kadar hazır olsun
    return;
  }
  _canliKartlariCiz(kap, canliOdaSirala(null), false);
  if (not) not.textContent = 'Kim var bakılıyor…';
  const presence = await _canliPresenceGetir();
  if (!document.body.contains(kap)) return;
  if (presence === 'kapali') {
    if (not) not.textContent = 'Canlı odalar şu an kapalı. Video odaları aşağıda.';
    _canliKartlariCiz(kap, canliOdaSirala(null), true);
    return;
  }
  if (not) not.textContent = presence ? '' : 'Doluluk okunamadı; yine de girebilirsin.';
  kap.innerHTML = '';
  _canliSonOdaDugmesi(kap);
  _canliKartlariCiz(kap, canliOdaSirala(presence || null), false, true);
}

function _canliSonOdaDugmesi(kap) {
  const son = _canliSonOdaOku();
  if (son && canliOdaBul(son.oda)) {
    const b = _el('button', 'w-full md:col-span-3 p-3 rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition',
      `↩ Son odana dön: ${canliOdaBul(son.oda).simge} ${canliOdaBul(son.oda).ad}`);
    b.type = 'button';
    b.dataset.canliSonOda = '1';
    b.addEventListener('click', () => canliSonOdayaDon());
    kap.appendChild(b);
  }
}

async function _canliPresenceGetir() {
  const token = await _canliToken();
  if (!token) return null;
  try {
    const y = await fetch('/api/rooms/presence', { headers: { Authorization: 'Bearer ' + token } });
    if (y.status === 503) return 'kapali';
    if (!y.ok) return null;
    return (await y.json()).rooms || null;
  } catch (e) {
    return null;
  }
}

/** Jitsi oda adları sunucudan (giriş şart). Dönüş: { odaId: ad } ya da null. */
async function _canliJitsiAdlariGetir() {
  if (CanliState.jitsiAdlari && Date.now() - CanliState.jitsiAdZamani < CANLI_JITSI_AD_ONBELLEK_MS) {
    return CanliState.jitsiAdlari;
  }
  const token = await _canliToken();
  if (!token) return null;
  try {
    const y = await fetch('/api/rooms/jitsi', { headers: { Authorization: 'Bearer ' + token } });
    if (!y.ok) return null;
    const adlar = (await y.json()).rooms;
    if (!adlar || typeof adlar !== 'object') return null;
    CanliState.jitsiAdlari = adlar;
    CanliState.jitsiAdZamani = Date.now();
    return adlar;
  } catch (e) {
    return null;
  }
}

/** Tıklama anında await'siz okunur (sekme kullanıcı etkinliği içinde açılmalı). */
function _canliJitsiAdi(odaId) {
  const adlar = CanliState.jitsiAdlari;
  return adlar && Date.now() - CanliState.jitsiAdZamani < CANLI_JITSI_AD_ONBELLEK_MS ? adlar[odaId] : null;
}

function _canliKartlariCiz(kap, odalar, kapali, ekle) {
  if (!ekle) kap.innerHTML = '';
  for (const oda of odalar) {
    const b = _el('button', 'text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed');
    b.type = 'button';
    b.dataset.canliOda = oda.id;
    b.disabled = kapali || oda.dolu;
    const ust = _el('div', 'flex items-center gap-2');
    ust.appendChild(_el('span', 'text-2xl', oda.simge));
    ust.appendChild(_el('span', 'font-black text-slate-800 dark:text-slate-100', oda.ad));
    b.appendChild(ust);
    b.appendChild(_el('p', 'text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug', oda.aciklama));
    const durum = _canliJitsiMi() ? '↗ Jitsi Meet\'te açılır'
      : oda.dolu ? 'Dolu' : oda.sayi > 0 ? `🟢 ${oda.sayi} kişi çalışıyor` : 'Şu an boş — ilk sen gir';
    b.appendChild(_el('p', 'text-[11px] font-bold mt-2 ' + (oda.sayi > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'), durum));
    b.addEventListener('click', () => canliGirisPaneliAc(oda.id));
    kap.appendChild(b);
  }
}

/* ── Giriş paneli: hedef, süre, kamera, KVKK ───────────────────── */

async function _canliOnayVarMi() {
  if (CanliState.onayVar !== null) return CanliState.onayVar;
  try {
    const { data } = await _canliSb().from('profiles').select('room_consent_at').eq('id', currentUser.id).single();
    CanliState.onayVar = !!(data && data.room_consent_at);
  } catch (e) {
    CanliState.onayVar = false;
  }
  return CanliState.onayVar;
}

async function _canliBugunGorevleri() {
  try {
    const gun = typeof localDayISO === 'function' ? localDayISO() : new Date().toISOString().slice(0, 10);
    const { data } = await _canliSb().from('tasks').select('id,name').eq('day', gun).eq('completed', false).limit(6);
    return Array.isArray(data) ? data.filter(t => t && t.id && t.name) : [];
  } catch (e) {
    return [];
  }
}

async function canliGirisPaneliAc(odaId) {
  const oda = canliOdaBul(odaId);
  if (!oda || _canliMisafir()) return;
  document.getElementById('canli-giris')?.remove();

  const [onay, gorevler] = await Promise.all([_canliOnayVarMi(), _canliBugunGorevleri(),
    _canliJitsiMi() ? _canliJitsiAdlariGetir() : null]);
  const profil = (typeof userProfile !== 'undefined' && userProfile) || {};
  let secilenSure = canliVarsayilanSure(profil.focusPeriod);
  let secilenGorev = null;

  const perde = _el('div', 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm');
  perde.id = 'canli-giris';
  const kart = _el('div', 'w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl');
  perde.appendChild(kart);
  kart.appendChild(_el('h3', 'text-xl font-black text-slate-900 dark:text-slate-100', `${oda.simge} ${oda.ad}`));

  kart.appendChild(_el('label', 'block text-sm font-bold text-slate-700 dark:text-slate-200', 'Bu oturumda ne yapacaksın?'));
  const hedef = _el('input', 'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm outline-none focus:border-emerald-500');
  hedef.id = 'canli-hedef';
  hedef.maxLength = CANLI_HEDEF_MAX;
  hedef.placeholder = 'ör. Raporun giriş bölümü (isteğe bağlı)';
  kart.appendChild(hedef);

  if (gorevler.length) {
    const satir = _el('div', 'flex flex-wrap gap-2');
    gorevler.forEach(g => {
      const c = _el('button', 'px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40', g.name.slice(0, 40));
      c.type = 'button';
      c.addEventListener('click', () => {
        secilenGorev = g;
        hedef.value = canliHedefTemizle(g.name);
        satir.querySelectorAll('button').forEach(x => x.classList.remove('ring-2', 'ring-emerald-500'));
        c.classList.add('ring-2', 'ring-emerald-500');
      });
      satir.appendChild(c);
    });
    hedef.addEventListener('input', () => { if (secilenGorev && hedef.value !== canliHedefTemizle(secilenGorev.name)) secilenGorev = null; });
    kart.appendChild(satir);
  }

  kart.appendChild(_el('p', 'text-sm font-bold text-slate-700 dark:text-slate-200', 'Ne kadar odaklanacaksın?'));
  const sureler = _el('div', 'grid grid-cols-5 gap-2');
  CANLI_SURE_SECENEKLERI.forEach(dk => {
    const b = _el('button', 'py-2 rounded-xl text-sm font-bold transition', dk ? `${dk}` : 'Serbest');
    b.type = 'button';
    b.dataset.canliSure = String(dk);
    const boya = () => {
      const secili = dk === secilenSure;
      b.className = 'py-2 rounded-xl text-sm font-bold transition ' + (secili
        ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300');
    };
    b._boya = boya;
    boya();
    b.addEventListener('click', () => { secilenSure = dk; sureler.querySelectorAll('button').forEach(x => x._boya()); });
    sureler.appendChild(b);
  });
  kart.appendChild(sureler);
  kart.appendChild(_el('p', 'text-[11px] text-slate-400', 'Süre bitince odadan atılmazsın; mola mı devam mı diye sorulur.'));

  const kameraSatir = _el('label', 'flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200');
  const kamera = _el('input');
  kamera.type = 'checkbox';
  kamera.checked = true;
  kamera.id = 'canli-kamera';
  kameraSatir.appendChild(kamera);
  kameraSatir.appendChild(_el('span', '', 'Kameram açık girsin (mikrofon her zaman kapalı başlar)'));
  if (!_canliJitsiMi()) kart.appendChild(kameraSatir);

  let onayKutusu = null;
  if (!onay) {
    const kvkk = _el('div', 'rounded-2xl bg-slate-50 dark:bg-slate-800 p-3 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed');
    kvkk.appendChild(_el('p', 'font-bold', '🔒 Görüntü ve gizlilik'));
    kvkk.appendChild(_el('p', '', _canliJitsiMi()
      ? 'Görüşme Jitsi Meet\'te (meet.jit.si, 8x8 — yurt dışı sunucular) yeni sekmede açılır; FocusAid görüntüne erişmez ve hiçbir şey kaydetmez. Jitsi\'ye yalnız ilk adın gider, e-postan paylaşılmaz. Kamerayı ve mikrofonu Jitsi\'de istediğin an kapatabilirsin. Odaya ilk giren kişiden Jitsi bir kez Google vb. ile giriş ister.'
      : 'Kameran yalnız o an odada olan kişilere canlı gider; hiçbir şey kaydedilmez. Odalar Daily.co altyapısında (ABD) çalışır, yani görüntü yurt dışındaki sunuculardan geçer. Diğerleri yalnız ilk adını ve hedef cümleni görür; e-postan paylaşılmaz. Kamerasız katılmak her zaman mümkün.'));
    const l = _el('label', 'flex items-center gap-2 font-bold');
    onayKutusu = _el('input');
    onayKutusu.type = 'checkbox';
    onayKutusu.id = 'canli-onay';
    l.appendChild(onayKutusu);
    l.appendChild(_el('span', '', 'Okudum, kabul ediyorum'));
    kvkk.appendChild(l);
    kart.appendChild(kvkk);
  }

  const dugmeler = _el('div', 'flex gap-2 pt-2');
  const vazgec = _el('button', 'flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-sm font-bold', 'Vazgeç');
  vazgec.type = 'button';
  vazgec.addEventListener('click', () => perde.remove());
  const girMetni = _canliJitsiMi() ? 'Odaya gir ↗' : 'Odaya gir';
  const gir = _el('button', 'flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50', girMetni);
  gir.type = 'button';
  gir.id = 'canli-gir-btn';
  if (onayKutusu) {
    gir.disabled = true;
    onayKutusu.addEventListener('change', () => { gir.disabled = !onayKutusu.checked; });
  }
  gir.addEventListener('click', async () => {
    gir.disabled = true;
    gir.textContent = 'Bağlanıyor…';
    // Onay girişten SONRA yazılır: Jitsi sekmesi tıklamayla aynı anda (await'ten
    // önce) açılmalı, yoksa tarayıcı açılır pencere engeline takar.
    const tamam = await canliOdayaGir(oda.id, {
      hedef: hedef.value, planDk: secilenSure, kamera: kamera.checked,
      taskId: secilenGorev ? secilenGorev.id : null, taskAd: secilenGorev ? secilenGorev.name : ''
    });
    if (onayKutusu && tamam) await _canliOnayYaz();
    if (tamam) perde.remove();
    else { gir.disabled = false; gir.textContent = girMetni; }
  });
  dugmeler.appendChild(vazgec);
  dugmeler.appendChild(gir);
  kart.appendChild(dugmeler);
  document.body.appendChild(perde);
  setTimeout(() => hedef.focus(), 0);
}

async function _canliOnayYaz() {
  try {
    await _canliSb().from('profiles').update({ room_consent_at: new Date().toISOString() }).eq('id', currentUser.id);
  } catch (e) { /* onay yazılamasa da kullanıcı kabul etti; bir dahaki girişte yine sorulur */ }
  CanliState.onayVar = true;
}

async function canliSonOdayaDon() {
  const son = _canliSonOdaOku();
  if (!son || !canliOdaBul(son.oda)) return;
  // Onay önbellekteyse await'siz geç: Jitsi sekmesi tıklamayla aynı anda açılsın.
  const onay = CanliState.onayVar !== null ? CanliState.onayVar : await _canliOnayVarMi();
  if (!onay) return canliGirisPaneliAc(son.oda);
  if (_canliJitsiMi() && !_canliJitsiAdi(son.oda)) await _canliJitsiAdlariGetir();
  return canliOdayaGir(son.oda, { hedef: '', planDk: son.planDk, kamera: son.kamera !== false });
}

/* ── Odaya giriş / çıkış ─────────────────────────────────────── */

function _canliDailyYukle() {
  const hazir = () => window.Daily || window.DailyIframe;
  if (hazir()) return Promise.resolve(hazir());
  return new Promise((coz, reddet) => {
    const s = document.createElement('script');
    s.src = CANLI_DAILY_JS;
    s.crossOrigin = 'anonymous';
    s.onload = () => (hazir() ? coz(hazir()) : reddet(new Error('daily_yok')));
    s.onerror = () => reddet(new Error('daily_yuklenemedi'));
    document.head.appendChild(s);
  });
}

/** Jitsi'de görüşme başka sekmede: "odadayım" bayrağı + leave/destroy için boş vekil. */
function _canliJitsiOturumu(url) {
  return {
    jitsi: true, url,
    on() {}, leave() {}, destroy() {}, participants() { return {}; },
    setUserData() {}, setLocalVideo() {}, setLocalAudio() {}
  };
}

/** Sekmeyi açar. noopener: Jitsi sayfası window.opener ile bu sekmeyi yönlendiremesin. */
function _canliJitsiAc(url) {
  try { window.open(url, '_blank', 'noopener'); } catch (e) {}
}

function canliOdayaGir(odaId, secenek) {
  const oda = canliOdaBul(odaId);
  if (!oda || CanliState.call) return Promise.resolve(false);
  if (_canliJitsiMi()) {
    const url = canliJitsiUrl(oda, _canliJitsiAdi(oda.id),
      canliIlkAd(typeof currentUser !== 'undefined' ? currentUser : null));
    if (!url) {
      _canliJitsiAdlariGetir();     // bir sonraki denemeye hazır olsun
      _canliToast('Oda adresi alınamadı. Birkaç saniye sonra tekrar dene.', 'error');
      return Promise.resolve(false);
    }
    // SENKRON: await'ten önce, tıklamanın kullanıcı etkinliği içinde.
    _canliJitsiAc(url);
    return _canliOdayiBaslat(oda, _canliJitsiOturumu(url), { ...secenek, kamera: false });
  }
  return _canliDailyyeGir(oda, secenek);
}

async function _canliDailyyeGir(oda, { hedef, planDk, kamera, taskId, taskAd }) {
  const token = await _canliToken();
  let giris;
  try {
    const y = await fetch('/api/rooms/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseToken: token, room: oda.id })
    });
    giris = await y.json().catch(() => ({}));
    if (y.status === 429) { _canliToast('Bugünkü oda süren doldu. Yarın yine buradayız 👋', 'info'); return false; }
    if (y.status === 503) { _canliToast('Canlı odalar şu an kapalı.', 'error'); return false; }
    if (!y.ok || !giris.token || !giris.url) throw new Error('token_' + y.status);
  } catch (e) {
    console.warn('[Canlı oda] token alınamadı:', e.message);
    _canliToast('Odaya bağlanılamadı. Biraz sonra tekrar dene.', 'error');
    return false;
  }

  let Daily;
  try { Daily = await _canliDailyYukle(); } catch (e) {
    _canliToast('Görüntü bileşeni yüklenemedi. İnternetini kontrol et.', 'error');
    return false;
  }

  const call = Daily.createCallObject({ subscribeToTracksAutomatically: true });
  _canliDurumKur(oda, call, { hedef, planDk, kamera, taskId, taskAd });

  ['participant-joined', 'participant-updated', 'participant-left', 'track-started', 'track-stopped']
    .forEach(ev => call.on(ev, () => _canliIzgaraCiz()));
  // Günlük sınır (token'daki eject_after_elapsed) dolunca Daily 'ejected' gönderir.
  call.on('ejected', () => { if (!CanliState.cikiliyor) canliOdadanCik('sure'); });
  call.on('left-meeting', () => { if (!CanliState.cikiliyor) canliOdadanCik('kesildi'); });
  call.on('error', (e) => {
    console.warn('[Canlı oda] hata:', e && e.errorMsg);
    if (!CanliState.cikiliyor) canliOdadanCik('kesildi');
  });

  try {
    await call.join({ url: giris.url, token: giris.token, startVideoOff: !kamera, startAudioOff: true });
  } catch (e) {
    console.warn('[Canlı oda] katılamadı:', e && e.message);
    try { call.destroy(); } catch (x) {}
    CanliState.call = null;
    _canliToast(kamera ? 'Odaya girilemedi. Kamera izni verildi mi?' : 'Odaya girilemedi.', 'error');
    return false;
  }
  // Düşük çözünürlük: hem dikkat hem bant genişliği. Desteklenmezse sessiz geç.
  try { await call.updateSendSettings({ video: 'bandwidth-optimized' }); } catch (e) {}
  return _canliOdayiBaslat(oda, call, { hedef, planDk, kamera, taskId, taskAd }, true);
}

function _canliDurumKur(oda, call, { hedef, planDk, kamera, taskId, taskAd }) {
  CanliState.call = call;
  CanliState.oda = oda;
  CanliState.hedef = canliHedefTemizle(hedef);
  CanliState.taskId = taskId || null;
  CanliState.taskAd = taskAd || '';
  CanliState.kamera = !!kamera;
  CanliState.mikrofon = false;
  CanliState.cikiliyor = false;
  CanliState.gizlenenler = new Set();
  CanliState.bostaSoruBasi = null;
  CanliState.sonEtkilesim = Date.now();
  const profil = (typeof userProfile !== 'undefined' && userProfile) || {};
  const molaDk = (typeof BREAK_MAP !== 'undefined' && profil.breakStyle in BREAK_MAP) ? BREAK_MAP[profil.breakStyle] : 5;
  CanliState.sayac = canliSayacBaslat(planDk, molaDk, Date.now());
  CanliState.sonFaz = CanliState.sayac.faz;
}

/** Ortak: bağlantı kurulduktan sonra katman, sayaç, oturum kaydı. */
async function _canliOdayiBaslat(oda, call, { hedef, planDk, kamera, taskId, taskAd }, durumHazir) {
  if (!durumHazir) _canliDurumKur(oda, call, { hedef, planDk, kamera, taskId, taskAd });
  try {
    localStorage.setItem(CANLI_SON_ODA_ANAHTARI, JSON.stringify({ oda: oda.id, planDk, kamera: !!kamera }));
  } catch (e) {}

  _canliKatmanKur();
  _canliYayinla();
  await _canliSeansAc(planDk);
  CanliState.tikId = setInterval(_canliTik, 1000);
  CanliState.kalpId = setInterval(_canliKalpAtisi, 60000);
  _canliEtkilesimDinle(true);
  _canliIzgaraCiz();
  _canliTik();
  if (typeof NotificationManager !== 'undefined') NotificationManager.requestPermission?.();
  return true;
}

async function _canliSeansAc(planDk) {
  try {
    const { data, error } = await _canliSb().from('room_sessions').insert({
      room: CanliState.oda.id,
      planned_minutes: planDk > 0 ? planDk : null,
      goal: CanliState.hedef || null,
      task_id: CanliState.taskId
    }).select('id').single();
    if (error) throw error;
    CanliState.seansId = data && data.id;
  } catch (e) {
    console.warn('[Canlı oda] oturum kaydı açılamadı:', e && (e.code || e.message));
    CanliState.seansId = null;
  }
}

async function _canliKalpAtisi() {
  if (!CanliState.seansId || !CanliState.sayac) return;
  try {
    await _canliSb().from('room_sessions').update(canliSeansGuncellemesi(CanliState.sayac, Date.now())).eq('id', CanliState.seansId);
  } catch (e) { /* bir sonraki atışta yeniden denenir */ }
}

/**
 * neden: 'kullanici' (Bitir / Çık) → hedef sorusu
 *        'bosta'     → soru yok, "tek tıkla dön" bildirimi
 *        'sure'      → Daily günlük sınırda attı; soru yok
 *        'kesildi'   → bağlantı koptu; soru yok
 */
async function canliOdadanCik(neden = 'kullanici') {
  if (!CanliState.call || CanliState.cikiliyor) return;
  CanliState.cikiliyor = true;
  clearInterval(CanliState.tikId);
  clearInterval(CanliState.kalpId);
  _canliEtkilesimDinle(false);
  const simdi = Date.now();
  const ozet = canliSeansGuncellemesi(CanliState.sayac, simdi);
  const seansId = CanliState.seansId;
  const oda = CanliState.oda;
  const gorev = CanliState.taskId ? { id: CanliState.taskId, ad: CanliState.taskAd } : null;
  const call = CanliState.call;
  try { await call.leave(); } catch (e) {}
  try { call.destroy(); } catch (e) {}
  document.getElementById('canli-oda-katman')?.remove();
  Object.assign(CanliState, { call: null, oda: null, sayac: null, seansId: null, tikId: null, kalpId: null });

  if (seansId) {
    try {
      await _canliSb().from('room_sessions').update({ ...ozet, left_at: new Date(simdi).toISOString() }).eq('id', seansId);
    } catch (e) {}
  }
  if (neden === 'kullanici') {
    _canliHedefSorusu(seansId, ozet, gorev);
  } else if (neden === 'bosta') {
    _canliDonusKarti(oda, 'Bir süredir hareket yoktu, seni odadan nazikçe çıkardık.');
  } else if (neden === 'sure') {
    _canliToast(`Bugünkü oda süren doldu (${canliSureMetni(ozet.focus_seconds + ozet.break_seconds)} bu oturumda). Yarın yine buradayız 👋`, 'info');
  } else {
    _canliDonusKarti(oda, 'Oda bağlantın koptu.');
  }
  if (document.getElementById('canli-oda-listesi')) initCanliOdalar();
}

function _canliDonusKarti(oda, metin) {
  document.getElementById('canli-donus')?.remove();
  const k = _el('div', 'fixed bottom-6 inset-x-0 mx-auto w-[min(26rem,calc(100%-2rem))] z-[60] rounded-2xl bg-slate-900 text-white p-4 shadow-2xl space-y-3');
  k.id = 'canli-donus';
  k.appendChild(_el('p', 'text-sm', metin));
  const s = _el('div', 'flex gap-2');
  const don = _el('button', 'flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold', '↩ Odaya dön');
  don.type = 'button';
  don.addEventListener('click', () => { k.remove(); if (oda) canliSonOdayaDon(); });
  const kapat = _el('button', 'px-4 py-2 rounded-xl bg-slate-700 text-sm font-bold', 'Kapat');
  kapat.type = 'button';
  kapat.addEventListener('click', () => k.remove());
  s.appendChild(don);
  s.appendChild(kapat);
  k.appendChild(s);
  document.body.appendChild(k);
}

/** Çıkışta "hedefine ulaştın mı?" — tek dokunuş, atlanabilir. */
function _canliHedefSorusu(seansId, ozet, gorev) {
  document.getElementById('canli-hedef-sorusu')?.remove();
  const perde = _el('div', 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm');
  perde.id = 'canli-hedef-sorusu';
  const kart = _el('div', 'w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl text-center');
  perde.appendChild(kart);
  kart.appendChild(_el('p', 'text-3xl', '🎯'));
  kart.appendChild(_el('h3', 'text-lg font-black text-slate-900 dark:text-slate-100', 'Hedefine ulaştın mı?'));
  kart.appendChild(_el('p', 'text-sm text-slate-500 dark:text-slate-400', `Odada ${canliSureMetni(ozet.focus_seconds)} odaklandın.`));

  let gorevKutusu = null;
  if (gorev) {
    const l = _el('label', 'flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300');
    gorevKutusu = _el('input');
    gorevKutusu.type = 'checkbox';
    gorevKutusu.checked = true;
    l.appendChild(gorevKutusu);
    l.appendChild(_el('span', '', `"${gorev.ad.slice(0, 40)}" görevini tamamlandı say (Evet dersen)`));
    kart.appendChild(l);
  }

  const satir = _el('div', 'grid grid-cols-3 gap-2');
  [['yes', 'Evet'], ['partly', 'Kısmen'], ['no', 'Hayır']].forEach(([deger, ad]) => {
    const b = _el('button', 'py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-sm font-bold', ad);
    b.type = 'button';
    b.dataset.canliHedef = deger;
    b.addEventListener('click', async () => {
      perde.remove();
      if (seansId) {
        try { await _canliSb().from('room_sessions').update({ goal_met: deger }).eq('id', seansId); } catch (e) {}
      }
      if (deger === 'yes' && gorev && gorevKutusu && gorevKutusu.checked) await _canliGoreviTamamla(gorev.id, ozet.focus_seconds);
      _canliToast(deger === 'yes' ? 'Harika iş! 🎉' : 'Kaydedildi. Her oturum sayılır 💪', 'success');
    });
    satir.appendChild(b);
  });
  kart.appendChild(satir);
  const atla = _el('button', 'text-xs text-slate-400 hover:underline', 'Atla');
  atla.type = 'button';
  atla.addEventListener('click', () => perde.remove());
  kart.appendChild(atla);
  document.body.appendChild(perde);
}

/** Odadaki odak süresi görevin ölçümüne eklenir → mevcut kalibrasyon aynen işler. */
async function _canliGoreviTamamla(taskId, odakSn) {
  try {
    const { data: gorev, error } = await _canliSb().from('tasks').select('*').eq('id', taskId).single();
    if (error || !gorev || gorev.completed) return;
    const simdi = Date.now();
    const birlesik = {
      ...gorev,
      started_at: gorev.started_at || new Date(simdi - odakSn * 1000).toISOString(),
      active_seconds: (Number(gorev.active_seconds) || 0) + odakSn,
      longest_stretch_sec: Math.max(Number(gorev.longest_stretch_sec) || 0, odakSn)
    };
    const { patch } = analysisCompletionPatch(birlesik, simdi);
    await _canliSb().from('tasks').update({
      completed: true, started_at: birlesik.started_at, active_seconds: birlesik.active_seconds,
      longest_stretch_sec: birlesik.longest_stretch_sec, ...patch
    }).eq('id', taskId);
  } catch (e) {
    console.warn('[Canlı oda] görev tamamlanamadı:', e && e.message);
  }
}

/* ── Oda katmanı (tam / mini) ─────────────────────────────────── */

function _canliStilKur() {
  if (document.getElementById('canli-stil')) return;
  const s = document.createElement('style');
  s.id = 'canli-stil';
  // Tailwind derlemesine bağlı kalmasın diye katman kendi stilini taşıyor
  // (oda her temada koyu: görüntü odaklı bir alan).
  s.textContent = `
#canli-oda-katman{position:fixed;z-index:45;background:#0b1020;color:#e2e8f0;display:flex;flex-direction:column;font-size:14px}
#canli-oda-katman[data-gorunum="tam"]{inset:0}
@media (min-width:768px){#canli-oda-katman[data-gorunum="tam"]{left:16rem}}
#canli-oda-katman[data-gorunum="mini"]{right:16px;bottom:16px;width:min(320px,calc(100vw - 32px));border-radius:20px;box-shadow:0 20px 50px rgba(0,0,0,.45);overflow:hidden}
.co-ust{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
.co-baslik{font-weight:800;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.co-btn{border:0;border-radius:12px;padding:8px 12px;font-weight:700;font-size:13px;background:rgba(255,255,255,.08);color:inherit;cursor:pointer}
.co-btn:hover{background:rgba(255,255,255,.16)}
.co-btn.co-ana{background:#059669;color:#fff}.co-btn.co-ana:hover{background:#047857}
.co-btn.co-kirmizi{background:#be123c;color:#fff}
.co-govde{flex:1;min-height:0;display:flex;gap:16px;padding:16px;overflow:auto}
.co-izgara{flex:1;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));align-content:start}
.co-kutu{position:relative;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:#1e293b}
.co-kutu video{width:100%;height:100%;object-fit:cover;display:block}
.co-kutu.co-ben video{transform:scaleX(-1)}
.co-avatar{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;text-align:center}
.co-harf{width:64px;height:64px;border-radius:999px;background:#334155;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800}
.co-hedef-k{font-size:12px;color:#cbd5e1;line-height:1.35}
.co-alt{position:absolute;left:0;right:0;bottom:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,.75));font-size:12px}
.co-ad{font-weight:800}.co-rozet{color:#a7f3d0}
.co-kutu.co-mola .co-rozet{color:#fde68a}
.co-menu{position:absolute;top:6px;right:6px;display:flex;gap:4px;opacity:0;transition:opacity .2s}
.co-kutu:hover .co-menu,.co-kutu:focus-within .co-menu{opacity:1}
.co-menu button{border:0;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;background:rgba(0,0,0,.6);color:#fff;cursor:pointer}
.co-gizli{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#94a3b8}
.co-panel{width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:20px;background:rgba(255,255,255,.05);align-self:flex-start}
.co-etiket{font-size:11px;font-weight:900;letter-spacing:.15em;color:#6ee7b7}
.co-sure{font-size:40px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1}
.co-hedef{font-size:13px;color:#cbd5e1}
.co-soru{border-radius:16px;background:#fef3c7;color:#78350f;padding:12px;display:flex;flex-direction:column;gap:8px}
.co-soru .co-btn{background:rgba(120,53,15,.12)}.co-soru .co-btn.co-ana{background:#059669;color:#fff}
.co-satir{display:flex;gap:6px;flex-wrap:wrap}
.co-bosta{position:absolute;inset:0;z-index:2;background:rgba(2,6,23,.85);display:flex;align-items:center;justify-content:center;padding:16px}
.co-bosta>div{max-width:320px;text-align:center;display:flex;flex-direction:column;gap:12px;background:#0f172a;padding:20px;border-radius:20px}
#canli-oda-katman[data-gorunum="mini"] .co-govde{flex-direction:column;padding:10px;gap:10px}
#canli-oda-katman[data-gorunum="mini"] .co-izgara{grid-template-columns:repeat(3,1fr);gap:6px}
#canli-oda-katman[data-gorunum="mini"] .co-kutu{border-radius:10px}
#canli-oda-katman[data-gorunum="mini"] .co-alt,#canli-oda-katman[data-gorunum="mini"] .co-menu,#canli-oda-katman[data-gorunum="mini"] .co-hedef-k,
#canli-oda-katman[data-gorunum="mini"] .co-tam-only{display:none}
#canli-oda-katman[data-gorunum="mini"] .co-harf{width:32px;height:32px;font-size:13px}
#canli-oda-katman[data-gorunum="mini"] .co-panel{width:auto;padding:10px;flex-direction:row;align-items:center;flex-wrap:wrap}
#canli-oda-katman[data-gorunum="mini"] .co-sure{font-size:22px}
#canli-oda-katman[data-gorunum="tam"] .co-mini-only{display:none}
#canli-oda-katman[data-saglayici="jitsi"] [data-co="kamera"],#canli-oda-katman[data-saglayici="jitsi"] [data-co="mikrofon"]{display:none}
.co-jitsi{flex:1;display:flex;flex-direction:column;gap:10px;align-items:flex-start;padding:20px;border-radius:20px;background:rgba(255,255,255,.05);line-height:1.5;align-self:flex-start}
.co-jitsi a{text-decoration:none}.co-kucuk{font-size:11px;color:#94a3b8}
#canli-oda-katman[data-gorunum="mini"] .co-jitsi{padding:10px;flex-direction:row;align-items:center;flex-wrap:wrap}
@media (max-width:767px){#canli-oda-katman[data-gorunum="tam"] .co-jitsi{flex:none;align-self:stretch}}
@media (max-width:767px){#canli-oda-katman[data-gorunum="tam"] .co-govde{flex-direction:column}#canli-oda-katman[data-gorunum="tam"] .co-panel{width:auto;align-self:stretch}.co-izgara{grid-template-columns:repeat(2,1fr)}}
`;
  document.head.appendChild(s);
}

function _canliKatmanKur() {
  _canliStilKur();
  document.getElementById('canli-oda-katman')?.remove();
  const k = _el('div');
  k.id = 'canli-oda-katman';
  k.dataset.gorunum = 'tam';
  k.dataset.saglayici = CanliState.call && CanliState.call.jitsi ? 'jitsi' : 'daily';
  k.setAttribute('role', 'region');
  k.setAttribute('aria-label', 'Canlı çalışma odası');
  // Sabit iskelet: içinde kullanıcı metni YOK; ad/hedef sonradan textContent ile.
  k.innerHTML = `
    <div class="co-ust">
      <span class="co-baslik" data-co="baslik"></span>
      <button type="button" class="co-btn co-tam-only" data-co="kamera"></button>
      <button type="button" class="co-btn co-tam-only" data-co="mikrofon"></button>
      <button type="button" class="co-btn co-tam-only" data-co="kucult" title="Küçült">▁ Küçült</button>
      <button type="button" class="co-btn co-mini-only" data-co="buyut" title="Büyüt">⤢</button>
      <button type="button" class="co-btn co-kirmizi" data-co="cik">Çık</button>
    </div>
    <div class="co-govde">
      <div class="co-izgara" data-co="izgara"></div>
      <div class="co-panel">
        <span class="co-etiket" data-co="etiket">ODAK</span>
        <span class="co-sure" data-co="sure">00:00</span>
        <span class="co-hedef co-tam-only" data-co="hedef"></span>
        <div data-co="soru"></div>
        <div class="co-satir" data-co="dugmeler"></div>
      </div>
    </div>`;
  const q = (ad) => k.querySelector(`[data-co="${ad}"]`);
  q('baslik').textContent = `${CanliState.oda.simge} ${CanliState.oda.ad}`;
  q('hedef').textContent = CanliState.hedef ? `🎯 ${CanliState.hedef}` : '';
  q('kamera').addEventListener('click', () => canliKameraDegistir());
  q('mikrofon').addEventListener('click', () => canliMikrofonDegistir());
  q('kucult').addEventListener('click', () => canliGorunum('mini'));
  q('buyut').addEventListener('click', () => canliGorunum('tam'));
  q('cik').addEventListener('click', () => canliOdadanCik('kullanici'));
  if (CanliState.call && CanliState.call.jitsi) {
    const bilgi = _el('div', 'co-jitsi');
    bilgi.appendChild(_el('strong', '', '🎥 Görüşmen Jitsi sekmesinde'));
    bilgi.appendChild(_el('span', 'co-tam-only', 'Kameranı ve mikrofonunu oradan yönet. Bu sekmede sayacın işliyor; süre dolunca bildirim gelir. İşin bitince buradan "Çık"a bas.'));
    const a = _el('a', 'co-btn co-ana', '↗ Jitsi\'yi aç');
    a.href = CanliState.call.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.dataset.co = 'jitsi-ac';
    bilgi.appendChild(a);
    bilgi.appendChild(_el('span', 'co-kucuk co-tam-only', 'Sekme açılmadıysa (açılır pencere engeli) bu düğmeye bas.'));
    q('izgara').replaceWith(bilgi);
  }
  document.body.appendChild(k);
  _canliDugmeMetinleri();
}

function canliGorunum(gorunum) {
  const k = document.getElementById('canli-oda-katman');
  if (!k) return;
  CanliState.gorunum = gorunum === 'mini' ? 'mini' : 'tam';
  k.dataset.gorunum = CanliState.gorunum;
  _canliEtkilesim();
}

/** loadPage her sayfa değişiminde çağırıyor: bağlantıyı KOPARMA, küçült. */
function canliSayfaDegisti() {
  if (CanliState.call) canliGorunum('mini');
}

function _canliDugmeMetinleri() {
  const k = document.getElementById('canli-oda-katman');
  if (!k) return;
  k.querySelector('[data-co="kamera"]').textContent = CanliState.kamera ? '📷 Kamera açık' : '📷 Kamera kapalı';
  k.querySelector('[data-co="mikrofon"]').textContent = CanliState.mikrofon ? '🎙 Mikrofon açık' : '🔇 Mikrofon kapalı';
}

function canliKameraDegistir(zorla) {
  if (!CanliState.call) return;
  CanliState.kamera = typeof zorla === 'boolean' ? zorla : !CanliState.kamera;
  try { CanliState.call.setLocalVideo(CanliState.kamera); } catch (e) {}
  _canliDugmeMetinleri();
  _canliIzgaraCiz();
}

function canliMikrofonDegistir() {
  if (!CanliState.call) return;
  CanliState.mikrofon = !CanliState.mikrofon;
  try { CanliState.call.setLocalAudio(CanliState.mikrofon); } catch (e) {}
  _canliDugmeMetinleri();
  if (CanliState.mikrofon) _canliToast('Mikrofonun açık. Sessiz oda: konuşmadan önce bir düşün 🙂', 'info');
}

/* ── Izgara ──────────────────────────────────────────────────── */

function _canliKatilimcilar() {
  try { return Object.values(CanliState.call.participants() || {}); } catch (e) { return []; }
}

function _canliIzgaraCiz() {
  const izgara = document.querySelector('#canli-oda-katman [data-co="izgara"]');
  if (!izgara || !CanliState.call || CanliState.call.jitsi) return;
  const simdi = Date.now();
  const kisiler = _canliKatilimcilar().sort((a, b) => (b.local === true) - (a.local === true));
  const gorulen = new Set();
  for (const p of kisiler) {
    const id = p.session_id;
    if (!id) continue;
    gorulen.add(id);
    let kutu = izgara.querySelector(`[data-kisi="${CSS.escape(id)}"]`);
    if (!kutu) {
      kutu = _el('div', 'co-kutu' + (p.local ? ' co-ben' : ''));
      kutu.dataset.kisi = id;
      izgara.appendChild(kutu);
    }
    _canliKutuGuncelle(kutu, p, simdi);
  }
  izgara.querySelectorAll('[data-kisi]').forEach(k => { if (!gorulen.has(k.dataset.kisi)) k.remove(); });
}

function _canliKutuGuncelle(kutu, p, simdi) {
  const veri = p.local ? canliYayinDurumu(CanliState.sayac, CanliState.hedef, simdi) : canliUserDataTemizle(p.userData);
  const ad = String(p.user_name || 'FocusAid').slice(0, 40);
  kutu.classList.toggle('co-mola', veri.durum === 'mola');

  if (!p.local && CanliState.gizlenenler.has(p.session_id)) {
    kutu.replaceChildren(_el('div', 'co-gizli', 'Bu kişiyi gizledin'));
    const goster = _el('button', '', 'Göster');
    goster.type = 'button';
    goster.addEventListener('click', () => { CanliState.gizlenenler.delete(p.session_id); kutu.replaceChildren(); _canliIzgaraCiz(); });
    const m = _el('div', 'co-menu');
    m.style.opacity = '1';
    m.appendChild(goster);
    kutu.appendChild(m);
    return;
  }

  const izTrack = p.tracks && p.tracks.video;
  const videoVar = izTrack && izTrack.state === 'playable' && izTrack.persistentTrack;
  let video = kutu.querySelector('video');
  let avatar = kutu.querySelector('.co-avatar');
  if (videoVar) {
    avatar?.remove();
    if (!video) {
      video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      kutu.prepend(video);
    }
    const akim = video.srcObject;
    if (!akim || akim.getVideoTracks()[0] !== izTrack.persistentTrack) {
      video.srcObject = new MediaStream([izTrack.persistentTrack]);
      video.play?.().catch(() => {});
    }
  } else {
    video?.remove();
    if (!avatar) {
      avatar = _el('div', 'co-avatar');
      avatar.appendChild(_el('div', 'co-harf'));
      avatar.appendChild(_el('div', 'co-hedef-k'));
      kutu.prepend(avatar);
    }
    avatar.querySelector('.co-harf').textContent = canliBasHarf(ad);
    avatar.querySelector('.co-hedef-k').textContent = veri.hedef ? `🎯 ${veri.hedef}` : '';
  }

  // Ses: yalnız başkalarının, yalnız mikrofonu açıksa.
  if (!p.local) {
    const ses = p.tracks && p.tracks.audio;
    let audio = kutu.querySelector('audio');
    if (ses && ses.state === 'playable' && ses.persistentTrack) {
      if (!audio) { audio = document.createElement('audio'); audio.autoplay = true; kutu.appendChild(audio); }
      if (!audio.srcObject || audio.srcObject.getAudioTracks()[0] !== ses.persistentTrack) {
        audio.srcObject = new MediaStream([ses.persistentTrack]);
        audio.play?.().catch(() => {});
      }
    } else if (audio) {
      audio.remove();
    }
  }

  let alt = kutu.querySelector('.co-alt');
  if (!alt) {
    alt = _el('div', 'co-alt');
    alt.appendChild(_el('div', 'co-ad'));
    alt.appendChild(_el('div', 'co-rozet'));
    kutu.appendChild(alt);
  }
  alt.querySelector('.co-ad').textContent = p.local ? `${ad} (sen)` : ad;
  alt.querySelector('.co-rozet').textContent = canliDurumRozeti(veri, simdi) + (videoVar && veri.hedef ? ` · ${veri.hedef}` : '');

  if (!p.local && !kutu.querySelector('.co-menu')) {
    const m = _el('div', 'co-menu');
    const gizle = _el('button', '', 'Gizle');
    gizle.type = 'button';
    gizle.title = 'Yalnız senin ekranında gizlenir';
    gizle.addEventListener('click', () => { CanliState.gizlenenler.add(p.session_id); kutu.replaceChildren(); _canliIzgaraCiz(); });
    const bildir = _el('button', '', 'Bildir');
    bildir.type = 'button';
    bildir.addEventListener('click', () => _canliBildirAc(p));
    m.appendChild(gizle);
    m.appendChild(bildir);
    kutu.appendChild(m);
  }
}

function _canliBildirAc(p) {
  document.getElementById('canli-bildir')?.remove();
  const perde = _el('div', 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm');
  perde.id = 'canli-bildir';
  const kart = _el('div', 'w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-3 shadow-2xl');
  kart.appendChild(_el('h3', 'font-black text-slate-900 dark:text-slate-100', 'Bu kişiyi bildir'));
  kart.appendChild(_el('p', 'text-xs text-slate-500', 'Kişi senin ekranında hemen gizlenir. Bildirimi biz inceleriz; karşı taraf kimin bildirdiğini görmez.'));
  const neden = _el('textarea', 'w-full h-24 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm outline-none');
  neden.maxLength = 500;
  neden.placeholder = 'Ne oldu? (isteğe bağlı)';
  kart.appendChild(neden);
  const s = _el('div', 'flex gap-2');
  const vazgec = _el('button', 'flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-sm font-bold', 'Vazgeç');
  vazgec.type = 'button';
  vazgec.addEventListener('click', () => perde.remove());
  const gonder = _el('button', 'flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold', 'Bildir');
  gonder.type = 'button';
  gonder.addEventListener('click', async () => {
    perde.remove();
    CanliState.gizlenenler.add(p.session_id);
    _canliIzgaraCiz();
    const uuid = /^[0-9a-f-]{36}$/i.test(String(p.user_id || '')) ? p.user_id : null;
    try {
      const { error } = await _canliSb().from('room_reports').insert({
        reported_user_id: uuid, reported_name: String(p.user_name || '').slice(0, 60),
        room: CanliState.oda ? CanliState.oda.id : 'bilinmiyor', reason: neden.value.trim().slice(0, 500) || null
      });
      if (error) throw error;
      _canliToast('Bildirimin alındı. Teşekkürler.', 'success');
    } catch (e) {
      _canliToast('Bildirim gönderilemedi; kişi yine de gizlendi.', 'error');
    }
  });
  s.appendChild(vazgec);
  s.appendChild(gonder);
  kart.appendChild(s);
  perde.appendChild(kart);
  document.body.appendChild(perde);
}

/* ── Kişisel sayaç + boşta kontrolü ──────────────────────────── */

function _canliYayinla() {
  if (!CanliState.call || !CanliState.sayac) return;
  try { CanliState.call.setUserData(canliYayinDurumu(CanliState.sayac, CanliState.hedef, Date.now())); } catch (e) {}
}

function canliSayacCevapla(cevap) {
  if (!CanliState.sayac) return;
  const simdi = Date.now();
  const onceki = CanliState.sayac.faz;
  CanliState.sayac = canliSayacCevap(CanliState.sayac, cevap, simdi);
  const yeni = CanliState.sayac.faz;
  // Molada kamera kapanır (odadan çıkılmaz); dönünce kullanıcının seçimine geri açılır.
  if (yeni === 'mola' && onceki !== 'mola' && CanliState.kamera) { canliKameraDegistir(false); CanliState._molaKamera = true; }
  if (onceki === 'mola' && yeni !== 'mola' && CanliState._molaKamera) { CanliState._molaKamera = false; canliKameraDegistir(true); }
  _canliEtkilesim();
  _canliTik();
}

function _canliTik() {
  const k = document.getElementById('canli-oda-katman');
  if (!k || !CanliState.sayac) return;
  const simdi = Date.now();
  const onceki = CanliState.sonFaz;
  CanliState.sayac = canliSayacTik(CanliState.sayac, simdi);
  const s = CanliState.sayac;
  if (s.faz !== onceki) {
    CanliState.sonFaz = s.faz;
    if (s.faz === 'soru') {
      _canliToast('⏱ Süren doldu — mola mı, devam mı?', 'info');
      if (typeof NotificationManager !== 'undefined') NotificationManager.send?.('⏱ Süren doldu', { body: 'Mola mı, devam mı? Cevap vermezsen sayaç saymaya devam eder.', tag: 'focusaid-canli' });
    }
    if (onceki === 'mola' && s.faz !== 'mola') {
      if (CanliState._molaKamera) { CanliState._molaKamera = false; canliKameraDegistir(true); }
      if (typeof NotificationManager !== 'undefined') NotificationManager.notifyBreakComplete?.();
    }
    _canliYayinla();
    _canliIzgaraCiz();
  }

  const kalan = canliKalanSn(s, simdi);
  const etiket = { odak: 'ODAK', soru: 'SÜRE DOLDU', serbest: 'ODAK · SERBEST', mola: 'MOLA' }[s.faz];
  k.querySelector('[data-co="etiket"]').textContent = etiket;
  k.querySelector('[data-co="sure"]').textContent = kalan === null
    ? canliSayacMetni(Math.floor((simdi - s.fazBasi) / 1000))
    : canliSayacMetni(kalan);

  const soruKutu = k.querySelector('[data-co="soru"]');
  const dugmeler = k.querySelector('[data-co="dugmeler"]');
  const anahtar = s.faz;
  if (dugmeler.dataset.faz !== anahtar) {
    dugmeler.dataset.faz = anahtar;
    dugmeler.replaceChildren();
    soruKutu.replaceChildren();
    const dugme = (metin, sinif, is, veri) => {
      const b = _el('button', 'co-btn ' + sinif, metin);
      b.type = 'button';
      b.dataset.canliCevap = veri;
      b.addEventListener('click', is);
      return b;
    };
    if (s.faz === 'soru') {
      const kart = _el('div', 'co-soru');
      kart.appendChild(_el('strong', '', '⏱ Süren doldu'));
      kart.appendChild(_el('span', '', 'Cevap vermezsen sayaç saymaya devam eder.'));
      const satir = _el('div', 'co-satir');
      satir.appendChild(dugme('☕ Mola', 'co-ana', () => canliSayacCevapla('mola'), 'mola'));
      satir.appendChild(dugme('▶ Devam', '', () => canliSayacCevapla('devam'), 'devam'));
      satir.appendChild(dugme('Bitir', '', () => canliOdadanCik('kullanici'), 'bitir'));
      kart.appendChild(satir);
      soruKutu.appendChild(kart);
    } else if (s.faz === 'mola') {
      dugmeler.appendChild(dugme('▶ Molayı bitir', 'co-ana', () => canliSayacCevapla('molayiBitir'), 'molayiBitir'));
    } else {
      dugmeler.appendChild(dugme('☕ Mola ver', '', () => canliSayacCevapla('mola'), 'mola'));
      if (s.faz === 'serbest' && s.planDk > 0) dugmeler.appendChild(dugme(`▶ Yeni ${s.planDk} dk`, '', () => canliSayacCevapla('devam'), 'devam'));
    }
  }

  // Rozetlerdeki "X dk kaldı" yazıları dakikada bir değişir; 15 sn'de bir tazelemek yeter.
  if (simdi % 15000 < 1000) _canliIzgaraCiz();
  // Jitsi'de kullanıcı haklı olarak başka sekmede: bu sekmedeki etkileşimsizlik boşta demek değil.
  if (!(CanliState.call && CanliState.call.jitsi)) _canliBostaKontrol(simdi);
}

function _canliEtkilesim() {
  CanliState.sonEtkilesim = Date.now();
  if (CanliState.bostaSoruBasi) {
    CanliState.bostaSoruBasi = null;
    document.querySelector('#canli-oda-katman .co-bosta')?.remove();
  }
}

let _canliSonHareket = 0;
function _canliHareket() {
  // pointermove çok sık; saniyede bir yeter.
  const s = Date.now();
  if (s - _canliSonHareket < 1000) return;
  _canliSonHareket = s;
  _canliEtkilesim();
}

function _canliEtkilesimDinle(ac) {
  const yontem = ac ? 'addEventListener' : 'removeEventListener';
  ['keydown', 'pointerdown', 'touchstart', 'wheel'].forEach(ev => document[yontem](ev, _canliEtkilesim, { passive: true }));
  document[yontem]('pointermove', _canliHareket, { passive: true });
  window[yontem]('pagehide', _canliSayfaKapandi);
}

function _canliSayfaKapandi() {
  // Sekme kapanırken: odadan düş ki başkalarının ızgarasında "hayalet" kalmasın.
  try { CanliState.call?.leave(); } catch (e) {}
}

function _canliBostaKontrol(simdi) {
  const durum = canliBostaDurumu(CanliState.sonEtkilesim, CanliState.bostaSoruBasi, simdi);
  if (durum === 'cikar') { canliOdadanCik('bosta'); return; }
  if (durum === 'sor' && !CanliState.bostaSoruBasi) {
    CanliState.bostaSoruBasi = simdi;
    const k = document.getElementById('canli-oda-katman');
    if (!k) return;
    canliGorunum('tam');
    CanliState.bostaSoruBasi = simdi;  // canliGorunum etkileşim sayıp sıfırlıyor; soruyu yeniden işaretle
    const perde = _el('div', 'co-bosta');
    const kart = _el('div');
    kart.appendChild(_el('strong', '', '👋 Hâlâ burada mısın?'));
    kart.appendChild(_el('span', '', '5 dakika içinde cevap gelmezse seni odadan nazikçe çıkaracağız; tek tıkla dönebilirsin.'));
    const b = _el('button', 'co-btn co-ana', 'Buradayım');
    b.type = 'button';
    b.dataset.canliBurada = '1';
    b.addEventListener('click', () => _canliEtkilesim());
    kart.appendChild(b);
    perde.appendChild(kart);
    k.appendChild(perde);
    if (typeof NotificationManager !== 'undefined') NotificationManager.send?.('👋 Hâlâ çalışma odasında mısın?', { body: '5 dakika içinde cevap gelmezse odadan çıkarılacaksın.', tag: 'focusaid-canli' });
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    CanliState, initCanliOdalar, canliGirisPaneliAc, canliOdayaGir, canliOdadanCik,
    canliGorunum, canliSayfaDegisti, canliKameraDegistir, canliMikrofonDegistir,
    canliSayacCevapla, canliSonOdayaDon
  });
}
