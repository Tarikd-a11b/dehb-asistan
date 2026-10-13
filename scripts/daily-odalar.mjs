// FocusAid — canlı çalışma odalarını Daily.co'da oluşturur / günceller (idempotent).
//
//   PowerShell:  $env:DAILY_API_KEY = '<anahtar>'; node scripts/daily-odalar.mjs
//   bash:        DAILY_API_KEY=<anahtar> node scripts/daily-odalar.mjs
//
// Oda listesi serve.py CANLI_ODALAR ve live-rooms-logic.js CANLI_ODALAR ile AYNI olmalı.
// Odalar kalıcı (exp yok): içinde kimse yokken ücret yazmaz.
// Kayıt bilerek kapalı: enable_recording hiç verilmiyor (varsayılan kapalı).

const ODALAR = ['canli-kutuphane', 'canli-sabah', 'canli-gece'];
const AYARLAR = {
  privacy: 'private',                 // girmek için sunucunun ürettiği token şart
  properties: {
    max_participants: 6,
    enable_chat: false,                // dikkat dağıtır; durum kartı yeterli
    enable_screenshare: false,
    enable_knocking: false,
    enable_prejoin_ui: false,
    start_audio_off: true,
    start_video_off: false
  }
};

const anahtar = process.env.DAILY_API_KEY;
if (!anahtar) {
  console.error('DAILY_API_KEY tanımlı değil.');
  process.exit(1);
}

async function daily(yontem, yol, govde) {
  const y = await fetch('https://api.daily.co/v1' + yol, {
    method: yontem,
    headers: { Authorization: 'Bearer ' + anahtar, 'Content-Type': 'application/json' },
    body: govde ? JSON.stringify(govde) : undefined
  });
  const metin = await y.text();
  return { durum: y.status, govde: metin ? JSON.parse(metin) : {} };
}

let hata = 0;
for (const ad of ODALAR) {
  const var_ = await daily('GET', '/rooms/' + ad);
  const sonuc = var_.durum === 200
    ? await daily('POST', '/rooms/' + ad, AYARLAR)
    : await daily('POST', '/rooms', { name: ad, ...AYARLAR });
  if (sonuc.durum === 200) {
    console.log(`✔ ${ad}  ${var_.durum === 200 ? 'güncellendi' : 'oluşturuldu'}  ${sonuc.govde.url || ''}`);
  } else {
    hata++;
    console.error(`✘ ${ad}  HTTP ${sonuc.durum}`, sonuc.govde.info || sonuc.govde.error || '');
  }
}
process.exit(hata ? 1 : 0);
