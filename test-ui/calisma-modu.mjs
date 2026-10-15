/**
 * Çalışma Modu önerisi — görev sayacında Başlat'a basılınca çıkan kart.
 *
 * Profildeki "Çalışma Modu" (solo / body-doubling / cafe) eskiden yalnız n8n'e
 * gidiyordu, hiçbir etkisi yoktu. Artık Başlat'ta moda göre öneri çıkıyor;
 * karar profile-logic.js'te (birim testli), bu dosya düğmelerin GERÇEKTEN
 * doğru yere götürdüğünü doğruluyor.
 *
 * Misafir modunda Başlat DB'ye yazamadığı için (sahte katman boş dizi döner,
 * "başka sekme başlattı" sayılır) kart doğrudan çağrılıyor; Başlat'a bağlı
 * olduğunu ayrı bir kaynak denetimi bekliyor.
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

async function sayfaAc(social, focusTrigger = 'silence') {
  const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
  await sayfa.addInitScript(() => { try { localStorage.setItem('focusaid_guest_mode', '1'); } catch (e) {} });
  await sayfa.goto(taban + '/index.html', { waitUntil: 'domcontentloaded' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function'
    && typeof window.calismaModuOnerisiGoster === 'function', null, { timeout: 25000 });
  await sayfa.evaluate(([s, f]) => {
    userProfile.social = s; userProfile.focusTrigger = f;
    window.FocusAudio.stop(); window.FocusAudio.setMode('silence');
    loadPage('today');
  }, [social, focusTrigger]);
  return sayfa;
}

const goster = (sayfa, id = 'g1') => sayfa.evaluate(i => window.calismaModuOnerisiGoster({ id: i }), id);
const kartVar = sayfa => sayfa.evaluate(() => !!document.getElementById('mod-onerisi'));
const tikla = (sayfa, metin) => sayfa.click(`#mod-onerisi button:has-text("${metin}")`);

test('Başlat görev sayacında öneriyi çağırıyor (kaynak denetimi)', () => {
  const kaynak = fs.readFileSync(path.join(KOK, 'tasks-view.js'), 'utf8');
  const govde = kaynak.slice(kaynak.indexOf('async function startTaskTimer'), kaynak.indexOf('async function pauseTaskTimer'));
  assert.match(govde, /calismaModuOnerisiGoster\(task\)/);
});

test('body-doubling: kart çıkıyor, düğme çalışma odalarına götürüyor, ekrana sığıyor', async () => {
  const sayfa = await sayfaAc('body-doubling');
  await goster(sayfa);
  const kutu = await sayfa.locator('#mod-onerisi').boundingBox();
  assert.ok(kutu.x >= 0 && kutu.x + kutu.width <= 390, `kart taşıyor: ${JSON.stringify(kutu)}`);
  await tikla(sayfa, 'Çalışma odalarına git');
  assert.ok(await sayfa.evaluate(() => !!document.getElementById('oda-liste-bolum')), 'odalar sayfası açılmadı');
  assert.strictEqual(await kartVar(sayfa), false);
  await sayfa.close();
});

test('cafe + sessizlik: lo-fi açılır, Kafe odası açılır, Sesi kapat eski moda döner', async () => {
  const sayfa = await sayfaAc('cafe', 'silence');
  await goster(sayfa);
  assert.deepStrictEqual(await sayfa.evaluate(() => [FocusAudio.isPlaying, FocusAudio.currentMode]), [true, 'lofi']);
  await tikla(sayfa, 'Sesi kapat');
  assert.deepStrictEqual(await sayfa.evaluate(() => [FocusAudio.isPlaying, FocusAudio.currentMode]), [false, 'silence']);

  await goster(sayfa, 'g2');
  await tikla(sayfa, 'Lo-fi Kafe odası');
  const src = await sayfa.evaluate(() => document.getElementById('oda-oynatici')?.src || '');
  assert.match(src, /EXn8_dJ6msE/, `Kafe videosu açılmadı: ${src}`);
  await sayfa.evaluate(() => FocusAudio.stop());
  await sayfa.close();
});

test('cafe + işitsel destek seçili: lo-fi kendiliğinden açılmaz', async () => {
  const sayfa = await sayfaAc('cafe', 'brown-noise');
  await goster(sayfa);
  assert.strictEqual(await sayfa.evaluate(() => FocusAudio.isPlaying), false);
  assert.strictEqual(await sayfa.locator('#mod-onerisi button:has-text("Sesi kapat")').count(), 0);
  await sayfa.close();
});

test('solo: Düşünce Parkı açılıyor', async () => {
  const sayfa = await sayfaAc('solo');
  await goster(sayfa);
  await tikla(sayfa, 'Düşünce Parkı');
  await sayfa.waitForTimeout(300);
  assert.strictEqual(await sayfa.evaluate(() => BrainDumpState.isOpen), true);
  await sayfa.close();
});

test('aynı görevde ikinci kez çıkmaz; "Bugün gösterme" günü susturur', async () => {
  const sayfa = await sayfaAc('solo');
  await goster(sayfa, 'a');
  await tikla(sayfa, 'Kapat');
  await goster(sayfa, 'a');
  assert.strictEqual(await kartVar(sayfa), false, 'aynı görevde tekrar çıktı');
  await goster(sayfa, 'b');
  await sayfa.click('#mod-onerisi button:has-text("Bugün gösterme")');
  await goster(sayfa, 'c');
  assert.strictEqual(await kartVar(sayfa), false, 'susturulmuşken çıktı');
  await sayfa.close();
});
