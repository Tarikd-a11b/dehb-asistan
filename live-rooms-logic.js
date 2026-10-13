/* ══════════════════════════════════════════════════════════════
   FocusAid — 🟢 Canlı Çalışma Odaları (saf mantık)

   Kameralı body doubling: kalıcı odalar (Daily.co), herkesin KENDİ sayacı.
   Spec: docs/superpowers/specs/2026-10-13-canli-calisma-odalari-design.md

   Kullanıcı kararları bu dosyanın şeklini belirliyor:
   - Oda sabit sürede KAPANMAZ; hiperodakta 1-2 saat kalan bölünmemeli.
   - Sayaç bitince kimse atılmaz: "mola / devam / bitir" sorulur, cevap
     gelmezse sayaç serbest modda saymaya devam eder.
   - Kotayı koruyan şey sabit süre değil: boşta kalma kontrolü + sunucudaki
     günlük üst sınır.

   Sayaç ZAMAN DAMGASIYLA çalışır (saniye saymaz): arka plan sekmesinde
   setInterval yavaşlıyor, sayaçla birlikte süre ölçümü de kayardı.

   DOM'a ve ağa dokunmaz; `test/live-rooms-logic.test.js` test eder.
   Arayüz `live-rooms.js` içinde.
   ══════════════════════════════════════════════════════════════ */

const CANLI_ODALAR = [
  { id: 'canli-kutuphane', ad: 'Sessiz Kütüphane', simge: '📚', aciklama: 'Herkes kendi işinde. Kamera açık, mikrofon kapalı.' },
  { id: 'canli-sabah', ad: 'Sabah Kulübü', simge: '☀️', aciklama: 'Güne birlikte başlamak isteyenler için.' },
  { id: 'canli-gece', ad: 'Gece Kuşları', simge: '🌙', aciklama: 'Akşam ve gece çalışanların odası.' }
];

const CANLI_MAKS_KISI = 6;
/** 0 = Serbest (sayaç ileri sayar, süre bitimi yok). */
const CANLI_SURE_SECENEKLERI = [25, 50, 60, 90, 0];
const CANLI_HEDEF_MAX = 80;
const CANLI_VARSAYILAN_MOLA_DK = 5;
/** Etkileşimsiz bu kadar dakika → "Hâlâ burada mısın?" */
const CANLI_BOSTA_DK = 90;
/** Soruya bu kadar dakika cevap yoksa nazikçe çıkış. */
const CANLI_BOSTA_CEVAP_DK = 5;
/** Süre bitince sorulan "mola / devam" sorusu bu kadar cevapsız kalırsa serbest moda geçilir. */
const CANLI_SORU_BEKLEME_DK = 2;

const _CANLI_DK = 60000;

function canliOdaBul(id) {
  if (!id) return null;
  return CANLI_ODALAR.find(o => o.id === id) || null;
}

/**
 * Hedef cümlesi diğer katılımcıların ekranına gider: kontrol karakterleri
 * atılır, boşluklar tekleştirilir, 80 karaktere kırpılır. HTML kaçışı
 * BURADA yapılmaz — arayüz kullanıcı metnini yalnız textContent ile basar.
 */
function canliHedefTemizle(metin) {
  if (typeof metin !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return metin.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CANLI_HEDEF_MAX);
}

/**
 * Başka katılımcıdan gelen `userData` GÜVENİLMEZ girdidir (istemci istediğini
 * yazabilir). Yalnız beyaz listedeki alanlar, doğrulanmış tiplerle geçer.
 */
function canliUserDataTemizle(veri) {
  const v = (veri && typeof veri === 'object') ? veri : {};
  const durum = ['odak', 'mola', 'serbest', 'hazir'].includes(v.durum) ? v.durum : 'hazir';
  const bitis = Number(v.bitis);
  return {
    hedef: canliHedefTemizle(v.hedef),
    durum,
    bitis: Number.isFinite(bitis) && bitis > 0 ? bitis : null
  };
}

/** Profildeki odak süresine en yakın seçenek (Serbest hariç). */
function canliVarsayilanSure(focusPeriod) {
  const fp = Number(focusPeriod);
  const secenekler = CANLI_SURE_SECENEKLERI.filter(s => s > 0);
  if (!Number.isFinite(fp) || fp <= 0) return 25;
  return secenekler.reduce((en, s) => (Math.abs(s - fp) < Math.abs(en - fp) ? s : en), secenekler[0]);
}

/** Mola stili "Serbest" (0) odada da mola verilebilsin diye varsayılana düşer. */
function canliMolaDk(molaDk) {
  const m = Math.round(Number(molaDk));
  return Number.isFinite(m) && m > 0 ? Math.min(60, m) : CANLI_VARSAYILAN_MOLA_DK;
}

/* ── Kişisel sayaç ───────────────────────────────────────────────
   faz: 'odak'    → planDk dolana kadar geri sayar
        'soru'    → süre doldu, "mola / devam / bitir" bekleniyor (odak sürüyor sayılır)
        'serbest' → ileri sayar (Serbest seçildi ya da soruya cevap gelmedi)
        'mola'    → molaDk dolana kadar geri sayar, sonra yeni odak
   odakSn / molaSn: önceki fazlardan biriken saniye. */

function canliSayacBaslat(planDk, molaDk, nowMs) {
  const p = Math.max(0, Math.round(Number(planDk) || 0));
  return { faz: p > 0 ? 'odak' : 'serbest', fazBasi: nowMs, planDk: p, molaDk: canliMolaDk(molaDk), odakSn: 0, molaSn: 0 };
}

function _canliGecenSn(s, nowMs) {
  return Math.max(0, Math.floor((nowMs - s.fazBasi) / 1000));
}

/** Geri sayan fazlarda kalan saniye; ileri sayan fazlarda null. */
function canliKalanSn(s, nowMs) {
  if (s.faz === 'odak') return Math.max(0, s.planDk * 60 - _canliGecenSn(s, nowMs));
  if (s.faz === 'mola') return Math.max(0, s.molaDk * 60 - _canliGecenSn(s, nowMs));
  return null;
}

/** Faz sınırlarını geçirir. Sekme uzun süre uyuduysa birden çok sınırı tek çağrıda geçer. */
function canliSayacTik(s, nowMs) {
  let d = { ...s };
  for (let i = 0; i < 100; i++) {
    if (d.faz === 'odak' && nowMs - d.fazBasi >= d.planDk * _CANLI_DK) {
      // Soru süresi odak sayılır; serbest moda geçilirse aynı başlangıçtan sayılmaya devam eder.
      d = { ...d, faz: 'soru', fazBasi: d.fazBasi + d.planDk * _CANLI_DK, odakSn: d.odakSn + d.planDk * 60 };
    } else if (d.faz === 'soru' && nowMs - d.fazBasi >= CANLI_SORU_BEKLEME_DK * _CANLI_DK) {
      d = { ...d, faz: 'serbest' };
    } else if (d.faz === 'mola' && nowMs - d.fazBasi >= d.molaDk * _CANLI_DK) {
      const bitti = d.fazBasi + d.molaDk * _CANLI_DK;
      d = { ...d, faz: d.planDk > 0 ? 'odak' : 'serbest', fazBasi: bitti, molaSn: d.molaSn + d.molaDk * 60 };
    } else {
      break;
    }
  }
  return d;
}

/**
 * Kullanıcının cevabı / düğmesi. 'mola' her odak fazından (soru, serbest,
 * odak) çağrılabilir; 'devam' yeni bir odak süresi başlatır; 'molayiBitir'
 * molayı erken keser.
 */
function canliSayacCevap(s, cevap, nowMs) {
  const d = canliSayacTik(s, nowMs);
  const gecen = _canliGecenSn(d, nowMs);
  if (cevap === 'mola' && d.faz !== 'mola') {
    const odakEk = d.faz === 'odak' ? Math.min(gecen, d.planDk * 60) : gecen;
    return { ...d, faz: 'mola', fazBasi: nowMs, odakSn: d.odakSn + odakEk };
  }
  if (cevap === 'devam' && (d.faz === 'soru' || d.faz === 'serbest')) {
    return { ...d, faz: d.planDk > 0 ? 'odak' : 'serbest', fazBasi: nowMs, odakSn: d.odakSn + gecen };
  }
  if (cevap === 'molayiBitir' && d.faz === 'mola') {
    return { ...d, faz: d.planDk > 0 ? 'odak' : 'serbest', fazBasi: nowMs, molaSn: d.molaSn + gecen };
  }
  return d;
}

/** Toplam odak saniyesi (o anki faz dahil). */
function canliOdakSn(s, nowMs) {
  const d = canliSayacTik(s, nowMs);
  const gecen = _canliGecenSn(d, nowMs);
  if (d.faz === 'mola') return d.odakSn;
  if (d.faz === 'odak') return d.odakSn + Math.min(gecen, d.planDk * 60);
  return d.odakSn + gecen;
}

/** Toplam mola saniyesi (o anki faz dahil). */
function canliMolaSn(s, nowMs) {
  const d = canliSayacTik(s, nowMs);
  return d.molaSn + (d.faz === 'mola' ? Math.min(_canliGecenSn(d, nowMs), d.molaDk * 60) : 0);
}

/** Diğerlerine yayınlanan durum (setUserData). bitis = geri sayımın bittiği an. */
function canliYayinDurumu(s, hedef, nowMs) {
  const d = canliSayacTik(s, nowMs);
  const durum = d.faz === 'mola' ? 'mola' : (d.faz === 'odak' ? 'odak' : 'serbest');
  let bitis = null;
  if (d.faz === 'odak') bitis = d.fazBasi + d.planDk * _CANLI_DK;
  if (d.faz === 'mola') bitis = d.fazBasi + d.molaDk * _CANLI_DK;
  return { hedef: canliHedefTemizle(hedef), durum, bitis };
}

/** 3900 → "1 sa 5 dk", 600 → "10 dk", 30 → "0 dk" */
function canliSureMetni(sn) {
  const dk = Math.floor(Math.max(0, Number(sn) || 0) / 60);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60);
  const kalan = dk % 60;
  return kalan ? `${sa} sa ${kalan} dk` : `${sa} sa`;
}

/** Sayaç gösterimi: 1500 → "25:00", 3725 → "1:02:05" */
function canliSayacMetni(sn) {
  const s = Math.max(0, Math.floor(Number(sn) || 0));
  const sa = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  const kalan = String(s % 60).padStart(2, '0');
  return sa > 0 ? `${sa}:${String(dk).padStart(2, '0')}:${kalan}` : `${String(dk).padStart(2, '0')}:${kalan}`;
}

/** Başkasının kutucuğundaki rozet. */
function canliDurumRozeti(userData, nowMs) {
  const u = canliUserDataTemizle(userData);
  if (u.durum === 'mola') return '☕ molada';
  if (u.durum === 'serbest') return '🎯 odakta';
  if (u.durum === 'odak') {
    if (!u.bitis) return '🎯 odakta';
    const dk = Math.max(0, Math.ceil((u.bitis - nowMs) / _CANLI_DK));
    return dk > 0 ? `🎯 odakta · ${dk} dk kaldı` : '🎯 odakta';
  }
  return '👋 yeni geldi';
}

/**
 * Boşta kalma: 'normal' | 'sor' | 'cikar'.
 * Ölçüt YALNIZ etkileşim (fare/klavye/dokunma) — yüz algılama yok.
 */
function canliBostaDurumu(sonEtkilesimMs, soruBasiMs, nowMs) {
  if (Number.isFinite(soruBasiMs) && soruBasiMs > 0) {
    return nowMs - soruBasiMs >= CANLI_BOSTA_CEVAP_DK * _CANLI_DK ? 'cikar' : 'sor';
  }
  return nowMs - sonEtkilesimMs >= CANLI_BOSTA_DK * _CANLI_DK ? 'sor' : 'normal';
}

/** room_sessions satırına 60 sn'de bir yazılan alanlar. */
function canliSeansGuncellemesi(s, nowMs) {
  return {
    active_seconds: canliOdakSn(s, nowMs),
    focus_seconds: canliOdakSn(s, nowMs),
    break_seconds: canliMolaSn(s, nowMs)
  };
}

/** Lobi sırası: içinde kişi olan odalar başa; eşitlikte katalog sırası. */
function canliOdaSirala(presence) {
  const p = (presence && typeof presence === 'object') ? presence : {};
  return CANLI_ODALAR
    .map((oda, i) => {
      const sayi = Math.max(0, Math.min(CANLI_MAKS_KISI, Math.floor(Number(p[oda.id]) || 0)));
      return { ...oda, sayi, dolu: sayi >= CANLI_MAKS_KISI, _i: i };
    })
    .sort((a, b) => (b.sayi > 0) - (a.sayi > 0) || a._i - b._i)
    .map(({ _i, ...o }) => o);
}

/** Görünen ad → baş harf(ler) (kamerasız kart). */
function canliBasHarf(ad) {
  const parcalar = String(ad || '').trim().split(/\s+/).filter(Boolean);
  if (!parcalar.length) return '?';
  return parcalar.slice(0, 2).map(p => p[0].toLocaleUpperCase('tr-TR')).join('');
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    CANLI_ODALAR, CANLI_MAKS_KISI, CANLI_SURE_SECENEKLERI, CANLI_HEDEF_MAX,
    canliOdaBul, canliHedefTemizle, canliUserDataTemizle, canliVarsayilanSure, canliMolaDk,
    canliSayacBaslat, canliKalanSn, canliSayacTik, canliSayacCevap, canliOdakSn, canliMolaSn,
    canliYayinDurumu, canliSureMetni, canliSayacMetni, canliDurumRozeti, canliBostaDurumu,
    canliSeansGuncellemesi, canliOdaSirala, canliBasHarf
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CANLI_ODALAR, CANLI_MAKS_KISI, CANLI_SURE_SECENEKLERI, CANLI_HEDEF_MAX,
    CANLI_BOSTA_DK, CANLI_BOSTA_CEVAP_DK, CANLI_SORU_BEKLEME_DK, CANLI_VARSAYILAN_MOLA_DK,
    canliOdaBul, canliHedefTemizle, canliUserDataTemizle, canliVarsayilanSure, canliMolaDk,
    canliSayacBaslat, canliKalanSn, canliSayacTik, canliSayacCevap, canliOdakSn, canliMolaSn,
    canliYayinDurumu, canliSureMetni, canliSayacMetni, canliDurumRozeti, canliBostaDurumu,
    canliSeansGuncellemesi, canliOdaSirala, canliBasHarf
  };
}
