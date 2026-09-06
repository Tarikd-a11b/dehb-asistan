/**
 * FocusAid — 🕵️ Sherlock kullanıcıyla birlikte gelir mi?
 *
 *   node test-ui/sherlock-yanimda.mjs        veya     npm run test:ui
 *
 * NEDEN VAR: Body doubling'in bütün fikri "çalışırken yanında biri olsun".
 * İki senaryo var ve ikisi de sessizce kırılabilir:
 *
 *   1. Uygulama içi gezinme (Bugün → Takvim → Parçalayıcı…). Widget
 *      `document.body` seviyesinde durduğu için `loadPage` onu silmiyor —
 *      ama biri widget'ı bir şablonun içine taşırsa sessizce kaybolur.
 *   2. Kullanıcı İŞİ İÇİN başka bir sekmeye geçtiğinde. Bunun için widget
 *      Document Picture-in-Picture penceresine TAŞINIYOR.
 *
 * Taşıma üç şeyi kırıyordu, üçünün de nöbetçisi burada:
 *   - widget'ın ana belgede aranması → ikinci bir widget üretilirdi
 *   - `document.getElementById` ile iç öğe sorgulama → PiP'te bulunamaz
 *   - inline `onclick` → handler öğenin KENDİ belgesinin window'unda çözülür,
 *     PiP penceresinde o fonksiyonlar yok, butonlar sessizce ölür
 *
 * Bu dosya bozuk kodda kırmızıya döndüğü doğrulanarak yazıldı: 93d5dcf'teki
 * (inline onclick'li, PiP'siz) body-doubling.js yerine konup koşuldu —
 * 6 testin 5'i düştü. Geçen tek test uygulama içi gezinme; o davranış zaten
 * vardı, oradaki nöbetçi gelecekteki regresyon için.
 *
 * BAĞIMLILIK: playwright-core + sistemde kurulu Chrome. Document PiP Chrome
 * 116+ gerektiriyor; API yoksa PiP testleri atlanır (uygulama da butonu gizler).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

/** Uygulamayı misafir modunda açar ve Sherlock'u çalışma durumunda gösterir. */
async function sherlockli() {
  const sayfa = await tarayici.newPage({ viewport: MASAUSTU });
  await sayfa.addInitScript(() => {
    try { localStorage.setItem('focusaid_guest_mode', '1'); } catch (e) {}
  });
  await sayfa.goto(taban + '/index.html', { waitUntil: 'domcontentloaded' });
  await sayfa.waitForFunction(() => typeof window.showBodyDoubling === 'function', null, { timeout: 20000 });
  await sayfa.evaluate(() => window.loadPage('today'));
  await sayfa.waitForTimeout(400);
  await sayfa.evaluate(() => window.showBodyDoubling('working'));
  await sayfa.waitForTimeout(250);
  return sayfa;
}

const pipVar = (sayfa) => sayfa.evaluate(() => 'documentPictureInPicture' in window);

test('Sherlock uygulama içinde sayfa değişince kaybolmuyor', async () => {
  const sayfa = await sherlockli();
  const gorunur = () => sayfa.evaluate(() => {
    const w = document.getElementById('body-doubling-widget');
    return !!w && !w.classList.contains('hidden');
  });
  assert.ok(await gorunur(), 'başlangıçta görünmeliydi');

  for (const sekme of ['calendar', 'chatbot', 'projects', 'profile', 'dehb-info', 'today']) {
    await sayfa.evaluate(s => window.loadPage(s), sekme);
    await sayfa.waitForTimeout(200);
    assert.ok(await gorunur(), `${sekme} sayfasına geçince Sherlock kayboldu`);
  }
  // Gezinme boyunca tek bir Sherlock olmalı; ikinci bir widget üretilmemeli.
  assert.equal(
    await sayfa.evaluate(() => document.querySelectorAll('#body-doubling-widget').length), 1,
    'gezinme sırasında ikinci bir widget üretildi'
  );
  await sayfa.close();
});

test('Sherlock ayrı pencereye TAŞINIYOR (kopyalanmıyor)', async () => {
  const sayfa = await sherlockli();
  if (!await pipVar(sayfa)) { await sayfa.close(); return; }

  await sayfa.click('#bd-pip-btn');           // gerçek kullanıcı jesti şart
  await sayfa.waitForTimeout(1200);

  const d = await sayfa.evaluate(() => ({
    pipAcik: !!BodyDoublingState.pipPenceresi,
    anaBelgede: !!document.getElementById('body-doubling-widget'),
    kartPipte: !!BodyDoublingState.pipPenceresi?.document.querySelector('#bd-companion-card'),
    stilSayisi: BodyDoublingState.pipPenceresi?.document.querySelectorAll('link[rel=stylesheet],style').length ?? 0
  }));
  assert.ok(d.pipAcik, 'PiP penceresi açılmadı');
  assert.ok(d.kartPipte, 'kart PiP penceresine taşınmadı');
  assert.equal(d.anaBelgede, false, 'widget KOPYALANMIŞ: ana belgede de duruyor');
  // PiP belgesi stil miras almaz; aktarılmazsa Sherlock stilsiz görünür.
  assert.ok(d.stilSayisi >= 2, `PiP'e stil aktarılmamış (${d.stilSayisi} stylesheet)`);

  await sayfa.close();
});

test('ayrı pencereye taşındıktan sonra butonlar hâlâ çalışıyor', async () => {
  // Bu testin asıl hedefi: inline onclick'e geri dönülürse kırmızıya dönmek.
  // Inline handler öğenin kendi belgesinin window'unda çözülür ve PiP
  // penceresinde showBodyDoubling tanımlı değildir — buton sessizce ölür.
  const sayfa = await sherlockli();
  if (!await pipVar(sayfa)) { await sayfa.close(); return; }

  await sayfa.click('#bd-pip-btn');
  await sayfa.waitForTimeout(1200);

  const sonuc = await sayfa.evaluate(async () => {
    const pip = BodyDoublingState.pipPenceresi;
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    pip.document.querySelector('#bd-sahne-mola').click();
    await bekle(300);
    const molaDurumu = pip.document.querySelector('#sherlock-status-text').textContent;
    const voltaSahnesi = !!pip.document.querySelector('.cw-volta');
    pip.document.querySelector('#bd-sahne-calis').click();
    await bekle(300);
    return {
      molaDurumu, voltaSahnesi,
      calismaDurumu: pip.document.querySelector('#sherlock-status-text').textContent
    };
  });
  assert.match(sonuc.molaDurumu, /Mola/, 'PiP içinde mola butonu çalışmadı');
  assert.ok(sonuc.voltaSahnesi, 'mola sahnesi (volta) PiP içinde çizilmedi');
  assert.match(sonuc.calismaDurumu, /Masasında/, 'PiP içinde çalışma butonu çalışmadı');

  await sayfa.close();
});

test('ayrı pencerede kalan süre görünüyor ve ilerliyor', async () => {
  const sayfa = await sherlockli();
  if (!await pipVar(sayfa)) { await sayfa.close(); return; }

  await sayfa.evaluate(() => { TaskTimerState.taskId = 'deneme'; TaskTimerState.remainingSeconds = 1500; });
  await sayfa.click('#bd-pip-btn');
  await sayfa.waitForTimeout(1200);

  const ilk = await sayfa.evaluate(() => {
    const k = BodyDoublingState.pipPenceresi.document.querySelector('#bd-kalan');
    return { gizli: k.hidden, metin: k.textContent };
  });
  assert.equal(ilk.gizli, false, 'kalan süre ayrı pencerede gizli kaldı');
  assert.equal(ilk.metin, '25:00');

  await sayfa.evaluate(() => { TaskTimerState.remainingSeconds = 59; });
  await sayfa.waitForTimeout(1300);
  assert.equal(
    await sayfa.evaluate(() => BodyDoublingState.pipPenceresi.document.querySelector('#bd-kalan').textContent),
    '00:59', 'kalan süre sayacı takip etmiyor'
  );
  await sayfa.close();
});

test('geri alınca tek Sherlock kalıyor ve eski yerine oturuyor', async () => {
  const sayfa = await sherlockli();
  if (!await pipVar(sayfa)) { await sayfa.close(); return; }

  await sayfa.click('#bd-pip-btn');
  await sayfa.waitForTimeout(1200);
  await sayfa.evaluate(() => window.sherlockGeriDon());
  await sayfa.waitForTimeout(600);

  const d = await sayfa.evaluate(() => ({
    pipKapandi: !BodyDoublingState.pipPenceresi,
    adet: document.querySelectorAll('#body-doubling-widget').length,
    yerTutucuTemiz: !document.getElementById('bd-yer-tutucu'),
    // Sağ-alt köşeye sabitleme sınıfları PiP'te kaldırılıyor, geri gelmeli.
    fixed: BodyDoublingState.widget.classList.contains('fixed'),
    sagAlt: BodyDoublingState.widget.classList.contains('bottom-5')
      && BodyDoublingState.widget.classList.contains('right-5')
  }));
  assert.ok(d.pipKapandi, 'PiP penceresi kapanmadı');
  assert.equal(d.adet, 1, `geri alınca ${d.adet} widget kaldı`);
  assert.ok(d.yerTutucuTemiz, 'yer tutucu temizlenmedi');
  assert.ok(d.fixed && d.sagAlt, 'widget sağ-alt köşeye geri oturmadı');

  await sayfa.close();
});

test('odak sayacı durunca ayrı pencere de kapanıyor', async () => {
  // İçi boş bir Sherlock penceresinin ekranda asılı kalması rahatsız edici.
  const sayfa = await sherlockli();
  if (!await pipVar(sayfa)) { await sayfa.close(); return; }

  await sayfa.click('#bd-pip-btn');
  await sayfa.waitForTimeout(1200);
  await sayfa.evaluate(() => window.hideBodyDoubling());   // pauseTaskTimer bunu çağırıyor
  await sayfa.waitForTimeout(600);

  const d = await sayfa.evaluate(() => ({
    pipKapandi: !BodyDoublingState.pipPenceresi,
    gizli: document.getElementById('body-doubling-widget').classList.contains('hidden'),
    adet: document.querySelectorAll('#body-doubling-widget').length
  }));
  assert.ok(d.pipKapandi, 'sayaç durdu ama ayrı pencere açık kaldı');
  assert.ok(d.gizli, 'widget gizlenmedi');
  assert.equal(d.adet, 1);

  await sayfa.close();
});

test('ayrı pencere açılamazsa kullanıcı sebebini görüyor', async () => {
  // ⚠️ Sessiz başarısızlık nöbetçisi: canlıda butona basılıp hiçbir şey
  // olmadığında sebebin görünmediği fark edildi. En sık sebep
  // NotAllowedError (tarayıcı yalnızca gerçek tıklamada izin veriyor).
  const sayfa = await sherlockli();
  if (!await pipVar(sayfa)) { await sayfa.close(); return; }

  const mesaj = await sayfa.evaluate(async () => {
    // requestWindow'u reddedecek şekilde değiştir: kullanıcı jesti olmadan
    // çağrıldığında tarayıcının verdiği hatanın aynısı.
    const asil = documentPictureInPicture.requestWindow.bind(documentPictureInPicture);
    documentPictureInPicture.requestWindow = () => {
      const h = new Error('Document PiP requires user activation');
      h.name = 'NotAllowedError';
      return Promise.reject(h);
    };
    await window.sherlockYanimaGel();
    documentPictureInPicture.requestWindow = asil;
    const t = document.getElementById('focusaid-toast');
    return t ? t.textContent : null;
  });
  assert.ok(mesaj, 'pencere açılmadı ama kullanıcıya hiçbir şey söylenmedi');
  assert.match(mesaj, /tıklaman gerekiyor/, `beklenmeyen mesaj: ${mesaj}`);

  // Yarım kalmış durum bırakmamalı: widget ana belgede ve tek olmalı.
  const d = await sayfa.evaluate(() => ({
    adet: document.querySelectorAll('#body-doubling-widget').length,
    yerTutucu: !!document.getElementById('bd-yer-tutucu'),
    pip: !!BodyDoublingState.pipPenceresi
  }));
  assert.equal(d.adet, 1);
  assert.equal(d.yerTutucu, false, 'başarısız denemeden yer tutucu kaldı');
  assert.equal(d.pip, false);

  await sayfa.close();
});
