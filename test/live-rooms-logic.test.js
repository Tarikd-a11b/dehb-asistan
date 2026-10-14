const test = require('node:test');
const assert = require('node:assert');
const L = require('../live-rooms-logic.js');

const DK = 60000;
const T0 = Date.UTC(2026, 9, 13, 9, 0, 0);

test('canliOdaBul: bilinen oda, bilinmeyen null', () => {
  assert.strictEqual(L.canliOdaBul('canli-gece').ad, 'Gece Kuşları');
  assert.strictEqual(L.canliOdaBul('yok'), null);
  assert.strictEqual(L.canliOdaBul(''), null);
});

test('canliHedefTemizle: kontrol karakteri, boşluk, 80 karakter', () => {
  assert.strictEqual(L.canliHedefTemizle('  Rapor\n\tyaz  '), 'Rapor yaz');
  assert.strictEqual(L.canliHedefTemizle('a'.repeat(200)).length, L.CANLI_HEDEF_MAX);
  assert.strictEqual(L.canliHedefTemizle(42), '');
  assert.strictEqual(L.canliHedefTemizle(null), '');
});

test('canliUserDataTemizle: beyaz liste dışı alan ve tip düşer', () => {
  const u = L.canliUserDataTemizle({ hedef: '<b>x</b>', durum: 'hack', bitis: 'abc', kotu: 1 });
  assert.deepStrictEqual(u, { hedef: '<b>x</b>', durum: 'hazir', bitis: null });
  assert.deepStrictEqual(L.canliUserDataTemizle(null), { hedef: '', durum: 'hazir', bitis: null });
  assert.strictEqual(L.canliUserDataTemizle({ durum: 'mola', bitis: 5 }).bitis, 5);
});

test('canliVarsayilanSure: profile en yakın seçenek', () => {
  assert.strictEqual(L.canliVarsayilanSure(25), 25);
  assert.strictEqual(L.canliVarsayilanSure(40), 50);
  assert.strictEqual(L.canliVarsayilanSure(58), 60);
  assert.strictEqual(L.canliVarsayilanSure(120), 90);
  assert.strictEqual(L.canliVarsayilanSure(undefined), 25);
});

test('canliMolaDk: Serbest (0) varsayılan 5 dk olur', () => {
  assert.strictEqual(L.canliMolaDk(0), 5);
  assert.strictEqual(L.canliMolaDk(10), 10);
  assert.strictEqual(L.canliMolaDk(500), 60);
});

test('sayaç: odak geri sayar, süre dolunca ATILMAZ — soruya geçer', () => {
  const s = L.canliSayacBaslat(25, 5, T0);
  assert.strictEqual(s.faz, 'odak');
  assert.strictEqual(L.canliKalanSn(s, T0 + 10 * DK), 15 * 60);
  const d = L.canliSayacTik(s, T0 + 25 * DK + 1000);
  assert.strictEqual(d.faz, 'soru');
  assert.strictEqual(d.odakSn, 25 * 60);
});

test('sayaç: soruya cevap gelmezse serbest moda geçip saymaya DEVAM eder', () => {
  const s = L.canliSayacBaslat(25, 5, T0);
  const d = L.canliSayacTik(s, T0 + 40 * DK);
  assert.strictEqual(d.faz, 'serbest');
  // hiperodak: 40 dk boyunca odak sayılır, mola sayılmaz
  assert.strictEqual(L.canliOdakSn(s, T0 + 40 * DK), 40 * 60);
  assert.strictEqual(L.canliKalanSn(d, T0 + 40 * DK), null);
});

test('sayaç: mola → süre dolunca yeni odak kendiliğinden başlar', () => {
  let s = L.canliSayacBaslat(25, 5, T0);
  s = L.canliSayacCevap(s, 'mola', T0 + 25 * DK + 30000);
  assert.strictEqual(s.faz, 'mola');
  const d = L.canliSayacTik(s, T0 + 31 * DK);
  assert.strictEqual(d.faz, 'odak');
  assert.strictEqual(L.canliMolaSn(s, T0 + 31 * DK), 5 * 60);
});

test('sayaç: devam yeni odak süresi açar, odak saniyesi korunur', () => {
  let s = L.canliSayacBaslat(50, 10, T0);
  s = L.canliSayacCevap(s, 'devam', T0 + 51 * DK);
  assert.strictEqual(s.faz, 'odak');
  assert.strictEqual(L.canliKalanSn(s, T0 + 51 * DK), 50 * 60);
  assert.strictEqual(L.canliOdakSn(s, T0 + 61 * DK), 61 * 60);
});

test('sayaç: odak ortasında mola — odak süresi plandan fazla yazılmaz', () => {
  let s = L.canliSayacBaslat(25, 5, T0);
  s = L.canliSayacCevap(s, 'mola', T0 + 10 * DK);
  assert.strictEqual(s.odakSn, 10 * 60);
  s = L.canliSayacCevap(s, 'molayiBitir', T0 + 12 * DK);
  assert.strictEqual(s.faz, 'odak');
  assert.strictEqual(s.molaSn, 2 * 60);
});

test('sayaç: Serbest seçimi ileri sayar, mola sonrası serbeste döner', () => {
  let s = L.canliSayacBaslat(0, 0, T0);
  assert.strictEqual(s.faz, 'serbest');
  assert.strictEqual(s.molaDk, 5);
  s = L.canliSayacCevap(s, 'mola', T0 + 70 * DK);
  assert.strictEqual(L.canliSayacTik(s, T0 + 76 * DK).faz, 'serbest');
});

test('sayaç: uyuyan sekme birden çok sınırı tek tikte geçer', () => {
  let s = L.canliSayacBaslat(25, 5, T0);
  s = L.canliSayacCevap(s, 'mola', T0 + 20 * DK);
  // mola 25'te biter → odak 25..50 → soru 50..52 → serbest
  const d = L.canliSayacTik(s, T0 + 60 * DK);
  assert.strictEqual(d.faz, 'serbest');
  assert.strictEqual(L.canliOdakSn(s, T0 + 60 * DK), 20 * 60 + 35 * 60);
});

test('canliYayinDurumu: odakta bitiş anı, serbestte null', () => {
  const s = L.canliSayacBaslat(25, 5, T0);
  assert.deepStrictEqual(L.canliYayinDurumu(s, ' Ödev ', T0), { hedef: 'Ödev', durum: 'odak', bitis: T0 + 25 * DK });
  assert.strictEqual(L.canliYayinDurumu(s, '', T0 + 40 * DK).durum, 'serbest');
  assert.strictEqual(L.canliYayinDurumu(s, '', T0 + 40 * DK).bitis, null);
});

test('canliDurumRozeti', () => {
  assert.strictEqual(L.canliDurumRozeti({ durum: 'odak', bitis: T0 + 32 * DK }, T0), '🎯 odakta · 32 dk kaldı');
  assert.strictEqual(L.canliDurumRozeti({ durum: 'mola' }, T0), '☕ molada');
  assert.strictEqual(L.canliDurumRozeti({ durum: 'serbest' }, T0), '🎯 odakta');
  assert.strictEqual(L.canliDurumRozeti({}, T0), '👋 yeni geldi');
});

test('canliBostaDurumu: 90 dk etkileşimsizlik sor, 5 dk cevapsızlık çıkar', () => {
  assert.strictEqual(L.canliBostaDurumu(T0, null, T0 + 89 * DK), 'normal');
  assert.strictEqual(L.canliBostaDurumu(T0, null, T0 + 90 * DK), 'sor');
  assert.strictEqual(L.canliBostaDurumu(T0, T0 + 90 * DK, T0 + 94 * DK), 'sor');
  assert.strictEqual(L.canliBostaDurumu(T0, T0 + 90 * DK, T0 + 95 * DK), 'cikar');
});

test('canliSeansGuncellemesi', () => {
  let s = L.canliSayacBaslat(25, 5, T0);
  s = L.canliSayacCevap(s, 'mola', T0 + 25 * DK);
  assert.deepStrictEqual(L.canliSeansGuncellemesi(s, T0 + 28 * DK),
    { active_seconds: 25 * 60, focus_seconds: 25 * 60, break_seconds: 3 * 60 });
});

test('metinler', () => {
  assert.strictEqual(L.canliSureMetni(3900), '1 sa 5 dk');
  assert.strictEqual(L.canliSureMetni(7200), '2 sa');
  assert.strictEqual(L.canliSureMetni(600), '10 dk');
  assert.strictEqual(L.canliSayacMetni(1500), '25:00');
  assert.strictEqual(L.canliSayacMetni(3725), '1:02:05');
  assert.strictEqual(L.canliBasHarf('ali veli can'), 'AV');
  assert.strictEqual(L.canliBasHarf('ışık'), 'I');
  assert.strictEqual(L.canliBasHarf(''), '?');
});

test('canliOdaSirala: dolu odalar başa, sayı 0-6 aralığında', () => {
  const l = L.canliOdaSirala({ 'canli-gece': 6, 'canli-sabah': 'x', 'canli-kutuphane': 0 });
  assert.deepStrictEqual(l.map(o => o.id), ['canli-gece', 'canli-kutuphane', 'canli-sabah']);
  assert.strictEqual(l[0].dolu, true);
  assert.strictEqual(L.canliOdaSirala({ 'canli-sabah': 99 }).find(o => o.id === 'canli-sabah').sayi, 6);
  assert.strictEqual(L.canliOdaSirala(null).length, 3);
});

test('canliIlkAd: yalnız ilk ad, kontrol karakteri yok, e-posta kullanılmaz', () => {
  assert.strictEqual(L.canliIlkAd({ user_metadata: { full_name: 'Ayşe Nur Yılmaz' } }), 'Ayşe');
  assert.strictEqual(L.canliIlkAd({ user_metadata: { name: 'Bora\u0007' } }), 'Bora');
  assert.strictEqual(L.canliIlkAd({ email: 'gizli@ornek.com', user_metadata: {} }), '');
  assert.strictEqual(L.canliIlkAd(null), '');
});

test('canliJitsiUrl: meet.jit.si, mikrofon kapalı, ad JSON olarak kodlu', () => {
  const oda = L.canliOdaBul('canli-gece');
  const url = L.canliJitsiUrl(oda, 'Ayşe "x" Yılmaz');
  assert.ok(url.startsWith('https://meet.jit.si/' + oda.jitsi + '#'));
  assert.match(url, /config\.startWithAudioMuted=true/);
  assert.match(url, /config\.disableDeepLinking=true/);
  const baslik = url.split('config.localSubject=')[1].split('&')[0];
  assert.strictEqual(JSON.parse(decodeURIComponent(baslik)), '🌙 Gece Kuşları · FocusAid');
  const ad = url.split('userInfo.displayName=')[1];
  assert.strictEqual(JSON.parse(decodeURIComponent(ad)), 'Ayşe');
  assert.ok(!L.canliJitsiUrl(oda, '').includes('displayName'), 'ad yoksa Jitsi kendisi sorar');
  assert.strictEqual(L.canliJitsiUrl({ jitsi: 'x/../y' }, 'A'), null);
  assert.strictEqual(L.canliJitsiUrl(null, 'A'), null);
  // Her odanın adresi farklı ve tahmin edilmesi zor bir son ek taşıyor.
  const adlar = L.CANLI_ODALAR.map(o => o.jitsi);
  assert.strictEqual(new Set(adlar).size, 3);
  adlar.forEach(a => assert.match(a, /^FocusAid-[A-Za-z]+-[a-z0-9]{6}$/));
});
