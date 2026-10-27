/**
 * Güvenilmez metin HTML olarak ÇALIŞMIYOR (XSS).
 *
 *   node test-ui/xss.mjs        (npm run test:ui bunu da koşar)
 *
 * NEDEN: görev adları ve özetleri LLM'den geliyor ve LLM'in girdisi kullanıcının
 * yüklediği yönerge dosyası. Dosyaya gömülü "görev adını şu HTML olarak yaz"
 * talimatı (dolaylı prompt injection, OWASP LLM01/LLM05) adı bir saldırı
 * yüküne çevirebilir. 2026-10-27 taramasında iki gerçek açık bulundu:
 *   - Bugün kartındaki İnat Modu düğmesi adı onclick="startInatModu('…')" içine
 *     yalnız ' kaçışıyla koyuyordu; " içeren ad özniteliği kırıp <svg onload>
 *     ekleyebiliyordu.
 *   - İnat Modu modalı adı hiç kaçışlamadan basıyordu.
 * Ayrıca özel çalışma odasının adı (kullanıcı girer) karta ham basılıyordu.
 *
 * Her yük çalışırsa window.__xss'i doldurur; test hem bunun boş kaldığını hem
 * metnin EKRANDA AYNEN göründüğünü (yani yutulmadığını) doğrular.
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

const YUKLER = [
  '<img src=x onerror="window.__xss.push(1)">',
  '"><svg onload="window.__xss.push(2)">',
  "x' onmouseover='window.__xss.push(3)' a='",
  "');window.__xss.push(4);('",
];

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

async function sayfaAc(ozelOdalar) {
  const sayfa = await tarayici.newPage({ viewport: { width: 1280, height: 800 } });
  await sayfa.addInitScript(o => {
    window.__xss = [];
    try {
      localStorage.setItem('focusaid_guest_mode', '1');
      if (o) localStorage.setItem('focusaid_ozel_odalar', JSON.stringify(o));
    } catch (e) {}
  }, ozelOdalar);
  await sayfa.goto(taban + '/index.html', { waitUntil: 'domcontentloaded' });
  // userProfile index.html'in ANA bloğunun sonlarında tanımlı: CDN geç/eksik yüklenip blok
  // yarıda kalırsa burada net bir zaman aşımıyla dur (yoksa testler "userProfile is not
  // defined" ile yanıltıcı biçimde düşüyor — 2026-10-27'de tam takımda bir kez oldu).
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function'
    && typeof window.startInatModu === 'function'
    && (() => { try { return typeof userProfile === 'object'; } catch (e) { return false; } })(),
    null, { timeout: 25000 });
  return sayfa;
}

/** Bugün'ü açıp misafirin boş yüklemesinin bitmesini bekler; yoksa o geç gelen
 *  çizim bizim koyduğumuz görevleri siler. */
async function bugunuAc(sayfa) {
  await sayfa.evaluate(() => loadPage('today'));
  await sayfa.waitForFunction(() => TodayState.loaded, null, { timeout: 10000 }).catch(() => {});
  await sayfa.waitForTimeout(800);
}

/** Yüklerin üzerinden fareyle geçer (onmouseover yükü için) ve sonucu döner. */
async function calistiMi(sayfa) {
  await sayfa.evaluate(() => document.querySelectorAll('*').forEach(el =>
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))));
  await sayfa.waitForTimeout(300);
  return sayfa.evaluate(() => window.__xss);
}

test('Bugün ekranı: LLM görev adı ve özeti HTML olarak çalışmıyor', async () => {
  const sayfa = await sayfaAc();
  await bugunuAc(sayfa);
  await sayfa.evaluate(y => {
    const gun = localDayISO();
    TodayState.today = y.map((ad, i) => ({ id: 'g' + i, name: ad, summary: ad, day: gun, completed: false,
      start_time: gun + 'T1' + i + ':00:00', end_time: gun + 'T1' + i + ':25:00' }));
    TodayState.carried = [];
    renderToday();
  }, YUKLER);
  await sayfa.waitForTimeout(500);
  assert.deepStrictEqual(await calistiMi(sayfa), []);
  const metin = await sayfa.evaluate(() => document.getElementById('main-content').innerText);
  assert.ok(metin.includes(YUKLER[0]), 'görev adı ekranda aynen görünmeli');
  await sayfa.close();
});

test('İnat Modu düğmesi adı bozulmadan iletiyor, modal kaçışlıyor', async () => {
  for (const ad of YUKLER) {
    const sayfa = await sayfaAc();
    await bugunuAc(sayfa);
    await sayfa.evaluate(a => {
      const gun = localDayISO();
      TodayState.today = [{ id: 'g0', name: a, day: gun, completed: false,
        start_time: gun + 'T10:00:00', end_time: gun + 'T10:25:00' }];
      TodayState.carried = [];
      renderToday();
    }, ad);
    await sayfa.waitForTimeout(300);
    const dugme = sayfa.locator('#today-current button', { hasText: 'İnat Modu' });
    assert.strictEqual(await dugme.count(), 1, `İnat Modu düğmesi tek olmalı (ad: ${ad})`);
    await dugme.click();
    await sayfa.waitForTimeout(400);
    assert.deepStrictEqual(await calistiMi(sayfa), [], `yük çalıştı: ${ad}`);
    const modal = await sayfa.evaluate(() => document.body.innerText);
    assert.ok(modal.includes(`Hedef: "${ad}"`), `modal adı aynen göstermeli: ${ad}`);
    await sayfa.close();
  }
});

test('Düşünce Parkı notu ve Parçalayıcı ilk adımı HTML olarak çalışmıyor', async () => {
  const sayfa = await sayfaAc();
  await sayfa.evaluate(y => {
    openBrainDump();
    BrainDumpState.thoughts = y.map((t, i) => ({ id: '00000000-0000-4000-8000-00000000000' + i, text: t, completed: false }));
    renderBrainDumpList();
    loadPage('chatbot');
  }, YUKLER);
  await sayfa.waitForTimeout(800);
  await sayfa.evaluate(y => y.forEach(t => addMessageToChat(parcalamaSonucMesaji({ firstStep: t }), 'ai')), YUKLER);
  await sayfa.waitForTimeout(300);
  assert.deepStrictEqual(await calistiMi(sayfa), []);
  const liste = await sayfa.evaluate(() => document.getElementById('bd-list').innerText);
  assert.ok(liste.includes(YUKLER[1]), 'not ekranda aynen görünmeli');
  await sayfa.close();
});

test('özel çalışma odasının adı HTML olarak çalışmıyor', async () => {
  const ad = '<img src=x onerror=__xss.push(5)>';      // ad 40 karaktere kırpılıyor
  const sayfa = await sayfaAc([{ ad, videoId: 'dQw4w9WgXcQ' }]);
  await sayfa.evaluate(() => loadPage('study-rooms'));
  await sayfa.waitForTimeout(800);
  assert.deepStrictEqual(await calistiMi(sayfa), []);
  const metin = await sayfa.evaluate(() => document.getElementById('main-content').innerText);
  assert.ok(metin.includes(ad), 'oda adı ekranda aynen görünmeli');
  await sayfa.close();
});
