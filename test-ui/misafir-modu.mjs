/**
 * Misafir / demo modunda kullanıcıya HAM HATA gösterilmiyor.
 *
 *   node test-ui/misafir-modu.mjs        (npm run test:ui bunu da koşar)
 *
 * NEDEN: misafire `id: 'guest_user'` veriliyor, bu bir UUID değil. Postgres
 * `.eq('user_id', 'guest_user')` sorgusunu `invalid input syntax for type uuid`
 * ile reddediyordu ve bu ham mesaj ekrana basılıyordu — gün modalinde kırmızı
 * "❌ invalid input syntax for type uuid: guest_user" olarak. Parçalayıcı da
 * vekilden 401 alıp "n8n bağlantısı kurulamadı, n8n açık mı?" diyordu; kullanıcıyı
 * hiç ilgilendirmeyen, üstelik YANLIŞ bir teşhis.
 *
 * Misafir modu ürünü çalıştırmak için değil arayüzü göstermek için var
 * (kullanıcı kararı, 2026-09-05). Bu yüzden Supabase'e hiç çıkılmıyor; ekranlar
 * kendi tasarlanmış boş durumlarını gösteriyor, yazma yolları da açıkça
 * "demo modu" diyor. Bu test o sözü koruyor.
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

/** Kullanıcının ASLA görmemesi gereken izler. */
const HAM_IZLER = [
  /invalid input syntax/i, /guest_user/i, /PGRST/i, /\b22P02\b/i,
  /n8n ulaşılamadı/i, /n8n bağlantısı kurulamadı/i, /webhook açık mı/i, /analiz \d{3}/i
];

function ihlaller(metin) {
  return HAM_IZLER.filter(r => r.test(metin)).map(String);
}

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

async function misafirSayfasi() {
  const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
  sayfa.__sorgular = [];
  sayfa.on('request', r => {
    const u = r.url();
    // Kütüphanenin KENDİSİ (cdn.jsdelivr…/supabase-js) sorgu değil, onu ayıkla.
    if (/\.supabase\.co\//.test(u) || /\/api\/n8n\//.test(u)) sayfa.__sorgular.push(r.method() + ' ' + u);
  });
  await sayfa.addInitScript(() => { try { localStorage.setItem('focusaid_guest_mode', '1'); } catch (e) {} });
  await sayfa.goto(taban + '/index.html', { waitUntil: 'domcontentloaded' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function', null, { timeout: 25000 });
  return sayfa;
}

test('misafir modunda hiçbir sayfa ham hata göstermiyor', async () => {
  const sayfa = await misafirSayfasi();
  for (const sekme of ['today', 'calendar', 'chatbot', 'projects', 'profile', 'dehb-info']) {
    await sayfa.evaluate(s => window.loadPage(s), sekme);
    await sayfa.waitForTimeout(1300);
    const metin = await sayfa.evaluate(() => document.getElementById('main-content').innerText);
    assert.deepStrictEqual(ihlaller(metin), [],
      `${sekme} ekranında ham hata: ${metin.replace(/\s+/g, ' ').slice(0, 200)}`);
  }
  await sayfa.close();
});

test('gün modalı ham UUID hatası yerine boş durum gösteriyor', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('calendar'));
  await sayfa.waitForTimeout(1400);
  await sayfa.evaluate(() => window.openDayView(new Date().toISOString().slice(0, 10)));
  await sayfa.waitForTimeout(1100);
  const metin = await sayfa.evaluate(() => document.getElementById('day-tasks-list').innerText.trim());
  assert.deepStrictEqual(ihlaller(metin), [], `gün modalinde ham hata: ${metin}`);
  assert.match(metin, /görev yok/i, `beklenen boş durum yok, gelen: "${metin}"`);
  await sayfa.close();
});

test('Parçalayıcı demo modunu açıklıyor, n8n hatası basmıyor', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('chatbot'));
  await sayfa.waitForTimeout(1200);
  await sayfa.fill('#task-input', 'Bitirme projesi raporu');
  await sayfa.evaluate(() => { document.getElementById('task-deadline').value = '2026-10-01T17:00'; });
  await sayfa.click('#task-input ~ button');
  await sayfa.waitForTimeout(1400);
  const sohbet = await sayfa.evaluate(() => document.getElementById('chat-box').innerText);
  assert.deepStrictEqual(ihlaller(sohbet), [], `sohbette ham hata: ${sohbet.slice(-200)}`);
  assert.match(sohbet, /demo modundasın/i, 'demo açıklaması gösterilmedi');
  await sayfa.close();
});

test('misafir modunda Supabase ve n8n\'e hiç istek gitmiyor', async () => {
  const sayfa = await misafirSayfasi();
  for (const sekme of ['today', 'calendar', 'projects', 'profile']) {
    await sayfa.evaluate(s => window.loadPage(s), sekme);
    await sayfa.waitForTimeout(900);
  }
  assert.deepStrictEqual(sayfa.__sorgular, [],
    'demo modunda ağa çıkıldı — kukla istemci kurulmamış olabilir');
  await sayfa.close();
});
