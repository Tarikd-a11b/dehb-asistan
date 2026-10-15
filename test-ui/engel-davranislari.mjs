/**
 * "Seni en çok ne durdurur?" cevabının arayüzdeki karşılıkları (Başlama Felci
 * → İnat Modu, bitirme-stratejisi.mjs'te). Karar profile-logic.js'teki
 * engelAyarlari'nda (birim testli); burada ekranda gerçekten olduğu doğrulanıyor.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPLER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

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

async function sayfaAc(engel, social = 'solo') {
  const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
  await sayfa.addInitScript(() => { try { localStorage.setItem('focusaid_guest_mode', '1'); } catch (e) {} });
  await sayfa.goto(taban + '/index.html', { waitUntil: 'domcontentloaded' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function'
    && typeof window.engelAyarlari === 'function', null, { timeout: 25000 });
  await sayfa.evaluate(([e, s]) => { userProfile.mainObstacle = e; userProfile.social = s; loadPage('today'); }, [engel, social]);
  return sayfa;
}

/** Sahte görevlerle Bugün'ü çizer: bugün 3 görev + dünden 1 devreden. */
const ciz = sayfa => sayfa.evaluate(() => {
  const gun = localDayISO(), dun = addDaysISO(gun, -1);
  const g = (id, day) => ({ id, name: 'Görev ' + id, day, completed: false,
    start_time: day + 'T10:00:00', end_time: day + 'T10:25:00' });
  TodayState.today = [g('a', gun), g('b', gun), g('c', gun)];
  TodayState.carried = [g('d', dun)];
  TodayState.rows = [...TodayState.today, ...TodayState.carried];
  renderToday();
  return document.getElementById('today-list').innerText;
});

test('Bunalma: liste düğmenin arkasında, düğmeyle açılıyor', async () => {
  const sayfa = await sayfaAc('overwhelm');
  const metin = await ciz(sayfa);
  assert.match(metin, /Tüm listeyi göster \(4 görev kaldı\)/);
  assert.doesNotMatch(metin, /Görev b/);
  await sayfa.click('#tum-liste-btn');
  assert.match(await sayfa.evaluate(() => document.getElementById('today-list').innerText), /Görev b/);
  await sayfa.close();
});

test('Bunalma dışında liste her zamanki gibi açık', async () => {
  const sayfa = await sayfaAc('paralysis');
  assert.match(await ciz(sayfa), /Görev b/);
  await sayfa.close();
});

test('Eleştiri korkusu: devreden görevde tarih yerine "devam ediyor"', async () => {
  const sayfa = await sayfaAc('rejection');
  const metin = await ciz(sayfa);
  assert.match(metin, /devam ediyor/);
  assert.doesNotMatch(metin, /dün/);
  await sayfa.evaluate(() => { userProfile.mainObstacle = 'paralysis'; });
  assert.match(await ciz(sayfa), /dün/);
  await sayfa.close();
});

test('Mükemmeliyetçilik: süre dolunca "yeterince iyi" kartı, Bitir görevi işaretliyor', async () => {
  const kaynak = fs.readFileSync(path.join(KOK, 'tasks-view.js'), 'utf8');
  const govde = kaynak.slice(kaynak.indexOf('function runCountdown'), kaynak.indexOf('async function startTaskTimer'));
  assert.match(govde, /yeterinceIyiKartiGoster\(timerTask\(\)\)/, 'geri sayım sonu kartı çağırmıyor');

  const sayfa = await sayfaAc('perfectionism');
  await ciz(sayfa);
  await sayfa.evaluate(() => yeterinceIyiKartiGoster(findTask('a')));
  await sayfa.click('#yeterince-iyi button:has-text("Bitir")');
  await sayfa.waitForTimeout(300);
  assert.strictEqual(await sayfa.evaluate(() => findTask('a').completed), true);

  await sayfa.evaluate(() => { userProfile.mainObstacle = 'overwhelm'; yeterinceIyiKartiGoster(findTask('b')); });
  assert.strictEqual(await sayfa.evaluate(() => !!document.getElementById('yeterince-iyi')), false);
  await sayfa.close();
});

test('Zaman körlüğü: alarm seçilmemişse hiperfokus 90 dk', async () => {
  const sayfa = await sayfaAc('time-blindness');
  assert.strictEqual(await sayfa.evaluate(() => {
    userProfile.hyperfocusLimit = 'none';
    return etkinHiperfokusLimiti(hyperfocusLimitiOku(), hyperfocusEngelVarsayilani());
  }), 90);
  assert.strictEqual(await sayfa.evaluate(() => { userProfile.mainObstacle = 'overwhelm';
    return etkinHiperfokusLimiti(hyperfocusLimitiOku(), hyperfocusEngelVarsayilani()); }), 0);
  await sayfa.close();
});

test('Dikkat dağınıklığı: body-doubling önerisinde de Düşünce Parkı var ve açıyor', async () => {
  const sayfa = await sayfaAc('distraction', 'body-doubling');
  await sayfa.evaluate(() => calismaModuOnerisiGoster({ id: 'x' }));
  await sayfa.click('#mod-onerisi button:has-text("Düşünce Parkı")');
  await sayfa.waitForTimeout(300);
  assert.strictEqual(await sayfa.evaluate(() => BrainDumpState.isOpen), true);
  await sayfa.close();
});

test('Profilde engel seçimi arayüzdeki karşılığını açıklıyor', async () => {
  const sayfa = await sayfaAc('paralysis');
  await sayfa.evaluate(() => loadPage('profile'));
  await sayfa.selectOption('#main-obstacle', 'overwhelm');
  assert.match(await sayfa.locator('#engel-aciklama').innerText(), /yalnız sıradaki görev/);
  await sayfa.close();
});
