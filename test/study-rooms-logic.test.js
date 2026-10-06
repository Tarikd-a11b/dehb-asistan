const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CALISMA_ODALARI, odaBul, youtubeVideoIdCikar, odaSuresiMetni, ozelOdalariTemizle
} = require('../study-rooms-logic.js');
const L = require('../study-rooms-logic.js');

test('oda katalogu dolu ve her odanin gecerli bir video kimligi var', () => {
  assert.ok(CALISMA_ODALARI.length >= 5);
  for (const o of CALISMA_ODALARI) {
    assert.match(o.videoId, /^[A-Za-z0-9_-]{11}$/, `${o.id}: gecersiz video kimligi`);
    assert.ok(o.ad && o.aciklama && o.simge, `${o.id}: eksik alan`);
    assert.ok(o.dakika > 0, `${o.id}: sure yok`);
  }
});

test('oda kimlikleri ve video kimlikleri benzersiz', () => {
  // Ayni videoyu iki odaya koymak kullaniciya cesitlilik varmis gibi gosterir.
  const idler = CALISMA_ODALARI.map(o => o.id);
  const videolar = CALISMA_ODALARI.map(o => o.videoId);
  assert.equal(new Set(idler).size, idler.length, 'oda kimligi tekrar ediyor');
  assert.equal(new Set(videolar).size, videolar.length, 'ayni video iki odada');
});

test('odaBul katalogdan getirir, bilinmeyende null doner', () => {
  assert.equal(odaBul('lofi-kafe').videoId, 'EXn8_dJ6msE');
  assert.equal(odaBul('olmayan-oda'), null);
  assert.equal(odaBul(''), null);
  assert.equal(odaBul(undefined), null);
});

test('youtubeVideoIdCikar yaygin adres bicimlerini cozer', () => {
  const bekle = 'dQw4w9WgXcQ';
  assert.equal(youtubeVideoIdCikar('https://www.youtube.com/watch?v=' + bekle), bekle);
  assert.equal(youtubeVideoIdCikar('https://youtu.be/' + bekle), bekle);
  assert.equal(youtubeVideoIdCikar('https://m.youtube.com/watch?v=' + bekle + '&t=90s'), bekle);
  assert.equal(youtubeVideoIdCikar('https://www.youtube.com/embed/' + bekle), bekle);
  assert.equal(youtubeVideoIdCikar('https://www.youtube.com/live/' + bekle), bekle);
  assert.equal(youtubeVideoIdCikar('https://www.youtube.com/shorts/' + bekle), bekle);
  assert.equal(youtubeVideoIdCikar('youtube.com/watch?v=' + bekle), bekle, 'sema olmadan da colmeli');
  assert.equal(youtubeVideoIdCikar('  ' + bekle + '  '), bekle, 'ciplak kimlik');
});

test('youtubeVideoIdCikar YouTube disini ve bozuk girdiyi REDDEDER', () => {
  // ⚠️ Donen deger dogrudan iframe adresine giriyor: beyaz liste sart.
  assert.equal(youtubeVideoIdCikar('https://kotusite.example/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(youtubeVideoIdCikar('javascript:alert(1)'), null);
  assert.equal(youtubeVideoIdCikar('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(youtubeVideoIdCikar('https://www.youtube.com/watch?v=kisa'), null);
  assert.equal(youtubeVideoIdCikar('https://www.youtube.com/watch?v=cok-uzun-bir-kimlik-degeri'), null);
  assert.equal(youtubeVideoIdCikar('https://www.youtube.com/watch?v=abc"><img src=x>'), null);
  assert.equal(youtubeVideoIdCikar(''), null);
  assert.equal(youtubeVideoIdCikar(null), null);
  assert.equal(youtubeVideoIdCikar(42), null);
});

test('youtubeVideoIdCikar youtube.com benzeri sahte alan adina kanmaz', () => {
  assert.equal(youtubeVideoIdCikar('https://youtube.com.kotu.example/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(youtubeVideoIdCikar('https://notyoutube.com/watch?v=dQw4w9WgXcQ'), null);
});

test('odaSuresiMetni saat ve dakikayi okunur yazar', () => {
  assert.equal(odaSuresiMetni(45), '45 dk');
  assert.equal(odaSuresiMetni(60), '1 sa');
  assert.equal(odaSuresiMetni(61), '1 sa 1 dk');
  assert.equal(odaSuresiMetni(241), '4 sa 1 dk');
  assert.equal(odaSuresiMetni(487), '8 sa 7 dk');
  assert.equal(odaSuresiMetni(0), '0 dk');
  assert.equal(odaSuresiMetni(undefined), '0 dk');
});

test('ozelOdalariTemizle gecersiz kaydi atar, tekrari eler', () => {
  const giris = [
    { ad: 'Benim odam', url: 'https://youtu.be/dQw4w9WgXcQ' },
    { ad: 'Ayni video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, // tekrar
    { ad: 'Kotu', url: 'https://kotusite.example/x' },                        // reddedilmeli
    null, 'metin', { ad: 'Kimliksiz' }
  ];
  const cikti = ozelOdalariTemizle(giris);
  assert.equal(cikti.length, 1);
  assert.equal(cikti[0].videoId, 'dQw4w9WgXcQ');
  assert.equal(cikti[0].ad, 'Benim odam');
  assert.equal(cikti[0].ozel, true);
});

test('ozelOdalariTemizle bos adi ve asiri uzun adi toparlar', () => {
  const cikti = ozelOdalariTemizle([
    { ad: '   ', videoId: 'dQw4w9WgXcQ' },
    { ad: 'x'.repeat(200), videoId: 'aaaaaaaaaaa' }
  ]);
  assert.equal(cikti[0].ad, 'Kendi odam');
  assert.equal(cikti[1].ad.length, 40);
});

test('ozelOdalariTemizle dizi olmayan girdide bos doner', () => {
  assert.deepEqual(ozelOdalariTemizle(null), []);
  assert.deepEqual(ozelOdalariTemizle('abc'), []);
  assert.deepEqual(ozelOdalariTemizle(undefined), []);
});

// ── odaSureleri: oda sayacı profilden ──
test('odaSureleri profildeki odak suresini ve mola stilini kullanir', () => {
  assert.deepStrictEqual(L.odaSureleri(40, 15), { odak: 40, mola: 15 });
  assert.deepStrictEqual(L.odaSureleri(25, 5), { odak: 25, mola: 5 });
});

test('odaSureleri serbest mola (0) korunur — mola fazi atlanacak', () => {
  assert.strictEqual(L.odaSureleri(25, 0).mola, 0);
});

test('odaSureleri bozuk profilde guvenli varsayilana duser', () => {
  assert.deepStrictEqual(L.odaSureleri(undefined, undefined), { odak: 25, mola: 5 });
  assert.deepStrictEqual(L.odaSureleri('abc', -3), { odak: 25, mola: 5 });
  assert.strictEqual(L.odaSureleri(500, 5).odak, 90);
  assert.strictEqual(L.odaSureleri(3, 5).odak, 10);
});
