/**
 * Bitirme Stratejin kartı — ödül notunun gerçekten bir yere gittiği.
 *
 * Ödül notu eskiden yalnız çarkta tek dilimdi ve çark onu `window.userProfile`
 * üzerinden okuduğu için (userProfile `let`, window'a bağlanmaz) HİÇ
 * göstermiyordu. Artık Bugün'de "Ödülüne N görev kaldı" satırı ve çarkta iki
 * dilim var; kart başlığı da olmayan bir n8n hatırlatıcısını vaat etmiyor.
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

async function sayfaAc(odulNotu) {
  const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
  await sayfa.addInitScript(() => {
    try { localStorage.setItem('focusaid_guest_mode', '1'); } catch (e) {}
    // Çark kanvasa çiziyor: dilim metinlerini fillText'ten yakala.
    window.__cizilen = [];
    const asil = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__cizilen.push(String(t)); return asil.call(this, t, ...r); };
  });
  await sayfa.goto(taban + '/index.html', { waitUntil: 'domcontentloaded' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function'
    && typeof window.openDopaminCarki === 'function', null, { timeout: 25000 });
  await sayfa.evaluate(n => { userProfile.motivationNote = n; loadPage('today'); }, odulNotu);
  return sayfa;
}

/** Bugün'e sahte görevler koyup yeniden çizer (misafir modunda DB boş). */
const gorevlerleCiz = (sayfa, tamam) => sayfa.evaluate(t => {
  const gun = localDayISO();
  TodayState.today = t.map((c, i) => ({ id: 'g' + i, name: 'Görev ' + i, day: gun, completed: c,
    start_time: gun + 'T10:00:00', end_time: gun + 'T10:25:00' }));
  TodayState.carried = [];
  renderToday();
  const el = document.getElementById('today-odul');
  return el && !el.classList.contains('hidden') ? el.textContent : null;
}, tamam);

test('Bugün ekranı ödüle kalan görev sayısını gösteriyor', async () => {
  const sayfa = await sayfaAc('1 saat oyun');
  assert.strictEqual(await gorevlerleCiz(sayfa, [true, false, false]), '🎁 Ödülüne 2 görev kaldı: 1 saat oyun');
  assert.strictEqual(await gorevlerleCiz(sayfa, [true, true]), null, 'hepsi bitince satır gizlenmeli');
  await sayfa.close();
});

test('ödül notu boşsa satır görünmüyor', async () => {
  const sayfa = await sayfaAc('');
  assert.strictEqual(await gorevlerleCiz(sayfa, [false, false]), null);
  await sayfa.close();
});

test('çark profildeki ödülü iki dilimde çiziyor', async () => {
  const sayfa = await sayfaAc('Sinema');
  await sayfa.evaluate(() => { window.__cizilen = []; openDopaminCarki(); });
  await sayfa.waitForTimeout(400);
  const cizilen = await sayfa.evaluate(() => window.__cizilen);
  assert.strictEqual(cizilen.filter(t => t === '🎁 Sinema').length, 2, `çizilen: ${cizilen.join(' | ')}`);
  await sayfa.close();
});

test('Bitirme Stratejin kartı olmayan hatırlatıcıyı vaat etmiyor', async () => {
  const sayfa = await sayfaAc('');
  await sayfa.evaluate(() => loadPage('profile'));
  const metin = await sayfa.evaluate(() => document.getElementById('main-content').innerText);
  assert.doesNotMatch(metin, /hatırlatıcı olarak gönderir/);
  assert.match(metin, /Bugün ekranında/);
  await sayfa.close();
});

test('İnat Modu yalnız Başlama Felci seçenlerde yanıp sönüyor', async () => {
  const sayfa = await sayfaAc('');
  const durum = async engel => {
    await sayfa.evaluate(e => { userProfile.mainObstacle = e; }, engel);
    await gorevlerleCiz(sayfa, [false]);
    return sayfa.evaluate(() => {
      const b = [...document.querySelectorAll('#today-current button')].find(x => x.textContent.includes('İnat Modu'));
      return b ? b.classList.contains('animate-pulse') : 'yok';
    });
  };
  assert.strictEqual(await durum('paralysis'), true);
  assert.strictEqual(await durum('distraction'), false);
  await sayfa.close();
});
