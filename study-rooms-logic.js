/* ══════════════════════════════════════════════════════════════
   FocusAid — 📺 Çalışma Odaları (saf mantık)

   "Study with me" videolarıyla body doubling: kullanıcı bir odaya girer,
   ekranda gerçek biri (uzun bir çalışma yayını) çalışır, kendi sayacı
   yanında işler. Bir dönem burada animasyonlu bir arkadaş (Sherlock) vardı;
   kullanıcı kararıyla kaldırıldı — ekranda GERÇEK bir insanın çalışıyor
   olması aranan şeydi.

   Bu dosya DOM'a ve ağa hiç dokunmaz — oda kataloğu, süre biçimlendirme
   ve YouTube kimliği çözümleme burada, hepsi `test/` altında test ediliyor.
   Oynatıcı ve arayüz `study-rooms.js` içinde.

   ⚠️ ODA VİDEOLARI GERÇEKTEN GÖMÜLEBİLİR OLMALI. Buradaki 8 kimliğin
   hepsi YouTube IFrame API ile tek tek açılıp `onReady` aldığı doğrulandı
   (2026-09-06); sahibi gömmeyi kapatmış bir video sessizce siyah kutu
   olarak kalır, kullanıcı da uygulamayı bozuk sanır. Yeni oda eklerken
   `onError` kodlarına bak: 101/150 = gömme yasak.
   ══════════════════════════════════════════════════════════════ */

const CALISMA_ODALARI = [
  {
    id: 'lofi-kafe',
    ad: 'Lo-fi Kafe',
    simge: '☕',
    aciklama: '50 dakika çalış, 10 dakika mola. Sıcak kafe uğultusu ve lo-fi.',
    videoId: 'EXn8_dJ6msE',
    kanal: 'Study with me',
    dakika: 241,
    dongu: '50/10'
  },
  {
    id: 'kutuphane',
    ad: 'Kütüphane',
    simge: '📚',
    aciklama: 'Gerçek bir kütüphanede, sayfa çevirme sesleri arasında.',
    videoId: 'mWY81fGPDh0',
    kanal: 'Study with me',
    dakika: 111,
    dongu: '50/10'
  },
  {
    id: 'sessiz-asmr',
    ad: 'Sessiz ASMR',
    simge: '🤫',
    aciklama: 'Müzik yok denecek kadar az; kalem sesi, kağıt hışırtısı.',
    videoId: 'cg1GkRWcrVU',
    kanal: 'Study with me',
    dakika: 111,
    dongu: '50/10'
  },
  {
    id: 'uzun-maraton',
    ad: 'Uzun Maraton',
    simge: '🏃',
    aciklama: 'Sekiz saatlik yayın. Uzun bir güne eşlik etmesi için.',
    videoId: 'ySiiD5tBHOA',
    kanal: "It's Kind of a Study Story",
    dakika: 487,
    dongu: '50/10/70'
  },
  {
    id: 'kis-sakinligi',
    ad: 'Kış Sakinliği',
    simge: '❄️',
    aciklama: 'Sakin lo-fi, pencerede kar. Yavaş bir tempo istediğinde.',
    videoId: 'CY5AxrrzZ9s',
    kanal: 'Study with me',
    dakika: 171,
    dongu: '50/10'
  },
  {
    id: 'gunes-isigi',
    ad: 'Güneşli Masa',
    simge: '☀️',
    aciklama: 'Aydınlık bir oda, hafif müzik. Sabah seansları için.',
    videoId: '9GaaznbPGGU',
    kanal: 'Study with me',
    dakika: 111,
    dongu: '50/10'
  },
  {
    id: 'sadece-sayac',
    ad: 'Sadece Sayaç',
    simge: '⏱️',
    aciklama: 'Kimse yok, sadece 50/10 sayacı ve hafif müzik.',
    videoId: 'VJhd3hvsMTo',
    kanal: 'Study Pomodoro',
    dakika: 180,
    dongu: '50/10'
  },
  {
    id: 'devlet-kutuphanesi',
    ad: 'Kısa Seans',
    simge: '🕐',
    aciklama: 'Bir saatlik tek seans. Başlamakta zorlandığın günler için.',
    videoId: '6wVZBOQbvYo',
    kanal: 'elleene',
    dakika: 61,
    dongu: '50/10'
  }
];

/** Katalogdan oda getirir; bilinmeyen kimlikte null döner. */
function odaBul(id) {
  if (!id) return null;
  return CALISMA_ODALARI.find(o => o.id === id) || null;
}

/**
 * Kullanıcının yapıştırdığı adresten YouTube video kimliğini çıkarır.
 *
 * ⚠️ GÜVENLİK: dönen değer doğrudan bir iframe adresine giriyor. Bu yüzden
 * kimlik, YouTube'un biçimine (tam 11 karakter, `[A-Za-z0-9_-]`) UYMAK
 * ZORUNDA; uymayan her şey null. Serbest metni iframe'e taşımak `javascript:`
 * ya da parametre enjeksiyonuna kapı açardı. Beyaz liste, kara liste değil.
 */
function youtubeVideoIdCikar(girdi) {
  if (typeof girdi !== 'string') return null;
  const metin = girdi.trim();
  if (!metin) return null;

  const gecerli = (k) => (/^[A-Za-z0-9_-]{11}$/.test(k) ? k : null);

  // Çıplak kimlik
  if (/^[A-Za-z0-9_-]{11}$/.test(metin)) return metin;

  let u;
  try {
    u = new URL(metin.includes('://') ? metin : 'https://' + metin);
  } catch (e) {
    return null;
  }

  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const izinli = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'];
  if (!izinli.includes(host)) return null;

  if (host === 'youtu.be') return gecerli(u.pathname.slice(1).split('/')[0]);

  const v = u.searchParams.get('v');
  if (v) return gecerli(v);

  // /embed/ID, /live/ID, /shorts/ID, /v/ID
  const m = u.pathname.match(/^\/(?:embed|live|shorts|v)\/([^/?#]+)/);
  if (m) return gecerli(m[1]);

  return null;
}

/** 241 → "4 sa 1 dk", 61 → "1 sa 1 dk", 45 → "45 dk" */
function odaSuresiMetni(dakika) {
  const d = Math.max(0, Math.round(Number(dakika) || 0));
  if (d < 60) return `${d} dk`;
  const saat = Math.floor(d / 60);
  const kalan = d % 60;
  return kalan ? `${saat} sa ${kalan} dk` : `${saat} sa`;
}

/**
 * Kullanıcının eklediği özel odaları güvenli hale getirir: yalnızca geçerli
 * kimliği olanlar kalır, adlar kırpılır. Depodan (localStorage) gelen veri
 * bozulmuş olabilir; buraya güvenilmez girdi geliyormuş gibi bakıyoruz.
 */
function ozelOdalariTemizle(liste) {
  if (!Array.isArray(liste)) return [];
  const gorulen = new Set();
  const cikti = [];
  for (const o of liste) {
    if (!o || typeof o !== 'object') continue;
    const videoId = youtubeVideoIdCikar(o.videoId || o.url || '');
    if (!videoId || gorulen.has(videoId)) continue;
    gorulen.add(videoId);
    const ad = String(o.ad || '').trim().slice(0, 40) || 'Kendi odam';
    cikti.push({ id: 'ozel-' + videoId, ad, simge: '📌', aciklama: 'Senin eklediğin oda.',
                 videoId, kanal: '', dakika: 0, dongu: '', ozel: true });
  }
  return cikti;
}

if (typeof window !== 'undefined') {
  window.CALISMA_ODALARI = CALISMA_ODALARI;
  window.odaBul = odaBul;
  window.youtubeVideoIdCikar = youtubeVideoIdCikar;
  window.odaSuresiMetni = odaSuresiMetni;
  window.ozelOdalariTemizle = ozelOdalariTemizle;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CALISMA_ODALARI, odaBul, youtubeVideoIdCikar, odaSuresiMetni, ozelOdalariTemizle };
}
