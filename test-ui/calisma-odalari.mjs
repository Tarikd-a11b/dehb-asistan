/**
 * FocusAid — 📺 Çalışma Odaları (tarayıcı testleri)
 *
 *   node test-ui/calisma-odalari.mjs        veya     npm run test:ui
 *
 * NEDEN VAR: odalar bir `<iframe>`e dayanıyor ve üç şey sessizce kırılabilir:
 *   1. Video arka planda çalmaya devam etmesi — kullanıcı odadan çıkar ya da
 *      başka sayfaya geçer, ses devam eder. Sadece gizlemek yetmiyor,
 *      `src` boşaltılmalı.
 *   2. Kullanıcının yapıştırdığı adresin doğrudan iframe'e girmesi. Kimlik
 *      beyaz listeden geçmezse enjeksiyon kapısı olur.
 *   3. Mobil yerleşim: 16/9 oynatıcı + sayaç kartı dar ekranda taşabiliyor.
 *
 * Video kimliklerinin GÖMÜLEBİLİR olduğu ayrıca doğrulandı (2026-09-06,
 * YouTube IFrame API ile onReady); bu dosya ağa çıkıp videoyu oynatmıyor,
 * yalnızca uygulamanın kendi davranışını ölçüyor.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBIL = { width: 390, height: 844 };
const MASAUSTU = { width: 1280, height: 800 };

const TIPLER = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon'
};

let sunucu, tarayici, taban;

before(async () => {
  sunucu = http.createServer((istek, yanit) => {
    const yol = decodeURIComponent(istek.url.split('?')[0]);
    const dosya = path.join(KOK, yol === '/' ? '/index.html' : yol);
    if (!dosya.startsWith(KOK)) { yanit.writeHead(403).end(); return; }
    fs.readFile(dosya, (hata, veri) => {
      if (hata) { yanit.writeHead(404).end('yok'); return; }
      yanit.writeHead(200, {
        'Content-Type': TIPLER[path.extname(dosya).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      }).end(veri);
    });
  });
  await new Promise(c => sunucu.listen(0, '127.0.0.1', c));
  taban = `http://127.0.0.1:${sunucu.address().port}`;
  tarayici = await chromium.launch({ channel: 'chrome', headless: true });
});

after(async () => {
  await tarayici?.close();
  await new Promise(c => sunucu?.close(c));
});

/** Odalar sayfasını açar. YouTube isteklerini keser: test ağa çıkmasın. */
async function odalar(ekran = MASAUSTU) {
  const sayfa = await tarayici.newPage({ viewport: ekran });
  await sayfa.route(/youtube(-nocookie)?\.com|ytimg\.com/, r => r.abort());
  await sayfa.addInitScript(() => {
    try {
      localStorage.setItem('focusaid_guest_mode', '1');
      localStorage.setItem('focusaid_sherlock_ayri_pencere', '0');
      localStorage.removeItem('focusaid_ozel_odalar');
    } catch (e) {}
  });
  await sayfa.goto(taban + '/index.html', { waitUntil: 'domcontentloaded' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function', null, { timeout: 20000 });
  await sayfa.evaluate(() => window.loadPage('study-rooms'));
  await sayfa.waitForTimeout(600);
  return sayfa;
}

test('odalar listeleniyor ve sidebar bağlantısı var', async () => {
  const sayfa = await odalar();
  const d = await sayfa.evaluate(() => ({
    kart: document.querySelectorAll('#oda-listesi [data-oda]').length,
    sidebar: !!document.getElementById('nav-study-rooms'),
    sahneGizli: document.getElementById('oda-sahne').classList.contains('hidden')
  }));
  assert.ok(d.kart >= 5, `oda kartı az: ${d.kart}`);
  assert.ok(d.sidebar, 'sidebar bağlantısı yok');
  assert.ok(d.sahneGizli, 'oda sahnesi baştan açık kalmış');
  await sayfa.close();
});

test('odaya girince oynatıcı doğru YouTube adresini alıyor', async () => {
  const sayfa = await odalar();
  await sayfa.click('[data-oda="lofi-kafe"]');
  await sayfa.waitForTimeout(500);

  const d = await sayfa.evaluate(() => ({
    src: document.getElementById('oda-oynatici').src,
    listeGizli: document.getElementById('oda-liste-bolum').classList.contains('hidden'),
    baslik: document.getElementById('oda-baslik').textContent,
    sayac: document.getElementById('oda-sayac').textContent
  }));
  // Gizlilik: izleme çerezi kullanıcı oynatmadan yazılmasın diye nocookie alanı.
  assert.match(d.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?/, `beklenmeyen src: ${d.src}`);
  assert.ok(d.listeGizli, 'oda açıldı ama liste hâlâ görünüyor');
  assert.match(d.baslik, /Lo-fi Kafe/);
  assert.equal(d.sayac, '50:00');
  await sayfa.close();
});

test('odadan çıkınca video susuyor (src boşalıyor)', async () => {
  const sayfa = await odalar();
  await sayfa.click('[data-oda="kutuphane"]');
  await sayfa.waitForTimeout(400);
  assert.ok(await sayfa.evaluate(() => !!document.getElementById('oda-oynatici').src));

  await sayfa.click('#oda-cik-btn');
  await sayfa.waitForTimeout(400);
  const d = await sayfa.evaluate(() => ({
    src: document.getElementById('oda-oynatici').src,
    listeGorunur: !document.getElementById('oda-liste-bolum').classList.contains('hidden')
  }));
  // ⚠️ Beklenen 'about:blank'. `src=''` göreli adres sayılıp uygulamanın
  // kendisini iframe'e yüklüyordu (iç içe FocusAid); bu test onu yakaladı.
  assert.equal(d.src, 'about:blank', `çıkışta video durmadı, src: ${d.src}`);
  assert.ok(d.listeGorunur, 'çıkışta liste geri gelmedi');
  await sayfa.close();
});

test('başka sayfaya geçince de video susuyor', async () => {
  // Kullanıcı odadan çıkmadan sidebar'dan başka sayfaya geçebilir.
  const sayfa = await odalar();
  await sayfa.click('[data-oda="lofi-kafe"]');
  await sayfa.waitForTimeout(400);

  await sayfa.evaluate(() => window.loadPage('today'));
  await sayfa.waitForTimeout(500);
  const d = await sayfa.evaluate(() => ({
    oynaticiVar: !!document.getElementById('oda-oynatici'),
    aktifOda: window.OdaState.aktifOda,
    sayacCalisiyor: window.OdaState.calisiyor
  }));
  assert.equal(d.oynaticiVar, false, 'sayfa değişti ama oynatıcı DOM\'da kaldı');
  assert.equal(d.aktifOda, null, 'oda durumu temizlenmedi');
  assert.equal(d.sayacCalisiyor, false, 'oda sayacı arka planda çalışmaya devam ediyor');
  await sayfa.close();
});

test('oda sayacı işliyor ve sıfırlanıyor', async () => {
  const sayfa = await odalar();
  await sayfa.click('[data-oda="sadece-sayac"]');
  await sayfa.waitForTimeout(300);
  await sayfa.click('#oda-sayac-btn');
  await sayfa.waitForTimeout(2200);
  const isleyen = await sayfa.evaluate(() => document.getElementById('oda-sayac').textContent);
  assert.notEqual(isleyen, '50:00', 'sayaç başlatıldı ama ilerlemedi');

  await sayfa.click('#oda-sayac-sifirla');
  await sayfa.waitForTimeout(300);
  const d = await sayfa.evaluate(() => ({
    metin: document.getElementById('oda-sayac').textContent,
    calisiyor: window.OdaState.calisiyor
  }));
  assert.equal(d.metin, '50:00');
  assert.equal(d.calisiyor, false, 'sıfırlama sayacı durdurmadı');
  await sayfa.close();
});

test('kötü niyetli bağlantı özel oda olarak EKLENMİYOR', async () => {
  // ⚠️ Bu değer doğrudan bir iframe adresine gidiyor.
  const sayfa = await odalar();
  const oncekiKart = await sayfa.evaluate(() => document.querySelectorAll('#oda-listesi [data-oda]').length);

  for (const kotu of [
    'javascript:alert(1)',
    'https://kotusite.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.kotu.example/watch?v=dQw4w9WgXcQ',
    'data:text/html,<script>alert(1)</script>'
  ]) {
    await sayfa.fill('#ozel-oda-url', kotu);
    await sayfa.click('#ozel-oda-ekle-btn');
    await sayfa.waitForTimeout(200);
  }

  const d = await sayfa.evaluate(() => ({
    kart: document.querySelectorAll('#oda-listesi [data-oda]').length,
    depo: localStorage.getItem('focusaid_ozel_odalar')
  }));
  assert.equal(d.kart, oncekiKart, 'kötü bağlantı oda olarak eklendi');
  assert.ok(!d.depo || d.depo === '[]', `depoya kötü kayıt yazıldı: ${d.depo}`);
  await sayfa.close();
});

test('geçerli YouTube bağlantısı özel oda olarak ekleniyor', async () => {
  const sayfa = await odalar();
  const once = await sayfa.evaluate(() => document.querySelectorAll('#oda-listesi [data-oda]').length);

  await sayfa.fill('#ozel-oda-ad', 'Benim odam');
  await sayfa.fill('#ozel-oda-url', 'https://youtu.be/dQw4w9WgXcQ');
  await sayfa.click('#ozel-oda-ekle-btn');
  await sayfa.waitForTimeout(400);

  const d = await sayfa.evaluate(() => ({
    kart: document.querySelectorAll('#oda-listesi [data-oda]').length,
    ozelVar: !!document.querySelector('[data-oda="ozel-dQw4w9WgXcQ"]')
  }));
  assert.equal(d.kart, once + 1, 'geçerli bağlantı eklenmedi');
  assert.ok(d.ozelVar, 'özel oda kartı çizilmedi');
  await sayfa.close();
});

test('mobilde odalar taşmıyor ve oynatıcı ekrana sığıyor', async () => {
  const sayfa = await odalar(MOBIL);
  let d = await sayfa.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  assert.ok(d.sw <= d.cw + 1, `oda listesi yatay taşıyor: ${d.sw} > ${d.cw}`);

  await sayfa.click('[data-oda="lofi-kafe"]');
  await sayfa.waitForTimeout(600);
  d = await sayfa.evaluate(() => {
    const f = document.getElementById('oda-oynatici').getBoundingClientRect();
    return {
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      oynaticiGenislik: Math.round(f.width),
      oynaticiYukseklik: Math.round(f.height)
    };
  });
  assert.ok(d.sw <= d.cw + 1, `oda sahnesi yatay taşıyor: ${d.sw} > ${d.cw}`);
  assert.ok(d.oynaticiGenislik > 200, `oynatıcı mobilde ezilmiş: ${d.oynaticiGenislik}px`);
  assert.ok(d.oynaticiYukseklik > 100, `oynatıcı yüksekliği çökmüş: ${d.oynaticiYukseklik}px`);
  await sayfa.close();
});

test('oynatıcı YouTube markasını gizlemeye çalışmıyor ve kaynağa atıf var', async () => {
  // ⚠️ Gömme izni oynatıcının OLDUĞU GİBİ gösterilmesine bağlı. `modestbranding`
  // YouTube tarafından 2023'te kaldırıldı (etkisiz) ve amacı markayı gizlemekti;
  // reklam engelleme / oynatıcıyı örtme de gömme hakkını düşürür.
  const sayfa = await odalar();
  await sayfa.click('[data-oda="lofi-kafe"]');
  await sayfa.waitForTimeout(500);

  const d = await sayfa.evaluate(() => {
    const f = document.getElementById('oda-oynatici');
    const a = document.getElementById('oda-kaynak');
    return { src: f.src, kaynakHref: a ? a.href : null, kaynakMetin: a ? a.textContent : null };
  });
  assert.ok(!/modestbranding/.test(d.src), `oynatıcıda modestbranding var: ${d.src}`);
  assert.ok(!/controls=0/.test(d.src), 'oynatıcı kontrolleri gizlenmiş');
  // Videoyu kaynağında açma yolu her zaman görünür olmalı (atıf).
  assert.match(d.kaynakHref, /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/,
    `kaynak bağlantısı yok ya da bozuk: ${d.kaynakHref}`);
  assert.match(d.kaynakMetin, /YouTube/);
  await sayfa.close();
});
