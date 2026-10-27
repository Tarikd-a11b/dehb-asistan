/**
 * serve.py'nin Content-Security-Policy'si sayfaları kırmıyor.
 *
 *   node test-ui/csp.mjs        (npm run test:ui bunu da koşar)
 *
 * NEDEN: diğer arayüz testleri kendi Node sunucularını kullanıyor, yani CSP
 * başlığını HİÇ görmüyorlar. CSP bir beyaz liste: listede olmayan bir CDN ya da
 * servis eklendiğinde kaynak SESSİZCE engellenir — sayfa açılır, özellik çalışmaz,
 * konsolda tek satır "Refused to load". Bu test gerçek serve.py'yi açıp landing,
 * giriş ve misafir modundaki her ekranı (+ bir YouTube odası) gezer ve tek bir
 * `securitypolicyviolation` olayı bile çıkarsa düşer.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3000 + Math.floor(Math.random() * 2000) + 1000;
const taban = `http://localhost:${PORT}`;
let sunucu, tarayici;

before(async () => {
  const env = { ...process.env, PORT: String(PORT) };
  delete env.SUPABASE_URL;      // diskteki config.js sunulsun (CI'da config.example.js kopyası)
  sunucu = spawn(process.platform === 'win32' ? 'python' : 'python3', ['serve.py'],
    { cwd: KOK, env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(taban + '/manifest.json')).ok) break; } catch (e) {}
    await new Promise(c => setTimeout(c, 200));
  }
  tarayici = await chromium.launch({ channel: 'chrome', headless: true });
});

after(async () => {
  await tarayici?.close();
  sunucu?.kill();
});

async function izliSayfa(misafir) {
  const sayfa = await tarayici.newPage({ viewport: { width: 1280, height: 800 } });
  sayfa.__ihlaller = [];
  await sayfa.exposeFunction('__cspIhlal', s => sayfa.__ihlaller.push(s));
  await sayfa.addInitScript(m => {
    document.addEventListener('securitypolicyviolation', e =>
      window.__cspIhlal(`${e.violatedDirective} ← ${e.blockedURI} (${e.sourceFile || ''}:${e.lineNumber || ''})`));
    if (m) { try { localStorage.setItem('focusaid_guest_mode', '1'); } catch (e) {} }
  }, misafir);
  return sayfa;
}

test('CSP başlığı gerçekten gönderiliyor ve script-src unsafe-inline içermiyor', async () => {
  for (const s of ['/index.html', '/auth.html', '/landing.html', '/']) {
    const csp = (await fetch(taban + s)).headers.get('content-security-policy') || '';
    assert.match(csp, /object-src 'none'/, s);
    const scriptSrc = csp.split(';').find(d => d.trim().startsWith('script-src')) || '';
    assert.doesNotMatch(scriptSrc, /unsafe-inline|unsafe-eval/, `${s}: ${scriptSrc}`);
    assert.match(scriptSrc, /'sha256-/, `${s}: inline script özeti yok`);
  }
});

test('enjekte edilen <img onerror> CSP tarafından durduruluyor', async () => {
  const sayfa = await izliSayfa(true);
  await sayfa.goto(taban + '/index.html', { waitUntil: 'networkidle' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function', null, { timeout: 25000 });
  // Kaçışın atlandığı varsayımsal bir hata: yük DOM'a ham girerse ne olur?
  await sayfa.evaluate(() => {
    window.__xss = 0;
    document.body.insertAdjacentHTML('beforeend', '<img src="/yok.png" onerror="window.__xss=1">');
  });
  await sayfa.waitForTimeout(1200);
  assert.strictEqual(await sayfa.evaluate(() => window.__xss), 0, 'inline handler ÇALIŞTI');
  assert.ok(sayfa.__ihlaller.some(i => i.startsWith('script-src')), `ihlal bekleniyordu: ${sayfa.__ihlaller}`);
  await sayfa.close();
});

test('data-* handler\'lar gerçek tıklama ve tuşla çalışıyor', async () => {
  const sayfa = await izliSayfa(true);
  await sayfa.goto(taban + '/index.html', { waitUntil: 'networkidle' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function', null, { timeout: 25000 });
  await sayfa.waitForTimeout(1000);
  // Menü: data-tikla="loadPage" data-args='["study-rooms"]'
  await sayfa.click('[data-tikla="loadPage"][data-args=\'["study-rooms"]\']');
  await sayfa.waitForTimeout(1200);
  assert.ok(await sayfa.evaluate(() => !!document.getElementById('oda-liste-bolum')), 'menü tıklaması sayfayı açmadı');
  // Tema: data-tikla="toggleTheme"
  const once = await sayfa.evaluate(() => document.documentElement.classList.contains('dark'));
  await sayfa.click('#theme-toggle-btn');
  assert.notStrictEqual(await sayfa.evaluate(() => document.documentElement.classList.contains('dark')), once, 'tema değişmedi');
  // Düşünce Parkı: data-tikla="openBrainDump" + data-enter="submitBrainDumpInput"
  await sayfa.click('#nav-brain-dump');
  await sayfa.waitForTimeout(500);
  await sayfa.fill('#bd-input', 'CSP denemesi');
  await sayfa.press('#bd-input', 'Enter');
  await sayfa.waitForTimeout(400);
  assert.match(await sayfa.evaluate(() => document.getElementById('bd-list').innerText), /CSP denemesi/);
  // Google script'leri data-yuklenince ile başlatıldı mı (CSP gapi/GIS'i kırmadı mı)
  await sayfa.waitForFunction(() => AppState.gisReady === true && !!(window.gapi && gapi.client), null, { timeout: 15000 });
  assert.deepStrictEqual(sayfa.__ihlaller, [], 'CSP ihlali');
  await sayfa.close();
});

test('landing ve giriş sayfalarında CSP ihlali yok', async () => {
  for (const s of ['/landing.html', '/auth.html']) {
    const sayfa = await izliSayfa(false);
    await sayfa.goto(taban + s, { waitUntil: 'networkidle' });
    await sayfa.waitForTimeout(1500);
    assert.deepStrictEqual(sayfa.__ihlaller, [], `${s} CSP ihlali`);
    await sayfa.close();
  }
});

test('misafir modunda her ekran + YouTube odası CSP ihlali vermiyor', async () => {
  const sayfa = await izliSayfa(true);
  await sayfa.goto(taban + '/index.html', { waitUntil: 'networkidle' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function', null, { timeout: 25000 });
  for (const sekme of ['today', 'calendar', 'chatbot', 'projects', 'profile', 'dehb-info', 'study-rooms']) {
    await sayfa.evaluate(s => window.loadPage(s), sekme);
    await sayfa.waitForTimeout(1500);
  }
  await sayfa.evaluate(() => window.odayaGir('kutuphane'));
  await sayfa.waitForTimeout(4000);
  const iframe = await sayfa.evaluate(() => [...document.querySelectorAll('iframe')].map(f => f.src).join(' '));
  assert.match(iframe, /youtube-nocookie\.com\/embed\//, 'oda oynatıcısı açılmadı');
  assert.deepStrictEqual(sayfa.__ihlaller, [], 'uygulamada CSP ihlali');
  await sayfa.close();
});
