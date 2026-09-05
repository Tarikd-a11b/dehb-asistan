/**
 * FocusAid — ARAYÜZ (yerleşim) regresyon testleri.
 *
 *   node test-ui/layout-check.mjs        veya     npm run test:ui
 *
 * NEDEN AYRI BİR KOMUT: `test/` altındaki 177 test saf mantık modüllerini
 * (calendar-logic, tasks-logic, profile-logic…) doğruluyor ve saniyeler
 * sürüyor. Buradakiler gerçek bir tarayıcı açıyor. `node --test` argümansız
 * çalıştırıldığında bu dosyayı BULMAMASI için dizin `test/` değil `test-ui/`,
 * dosya adı da `*.test.js` kalıbına uymuyor — hızlı birim testi akışı bozulmasın.
 *
 * NEDEN VAR: 2026-09-05'te mobilde üç ayrı yerleşim hatası bulundu (Parçala
 * butonu input yazısının üstüne biniyordu, takvim görevleri 4-6px'lik çizgilere
 * dönüşüyordu, gün modalı ekran dışına taşıyordu). Üçü de DOM'da yaşıyordu;
 * 177 birim testin hiçbiri bunları göremezdi çünkü hiçbiri `index.html`e
 * dokunmuyor. Aşağıdaki iddialar tam o üç hatayı hedefliyor.
 *
 * BAĞIMLILIK: `playwright-core` + sistemde kurulu Chrome (`channel: 'chrome'`).
 * Tarayıcı indirmesi YOK. Sayfa Tailwind/Supabase/FullCalendar'ı CDN'den
 * çektiği için testler internet ister.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBIL = { width: 390, height: 844 };      // iPhone 14 / yaygın Android
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
    // Dizin dışına çıkma girişimlerini reddet.
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

/**
 * Sayfayı açar. `index.html` kimlik doğrulaması olmadan landing'e yönlendiriyor;
 * misafir bayrağı SAYFA KODUNDAN ÖNCE yazılmalı, o yüzden addInitScript.
 */
async function ac(yol, ekran) {
  const sayfa = await tarayici.newPage({ viewport: ekran });
  await sayfa.addInitScript(() => {
    try { localStorage.setItem('focusaid_guest_mode', '1'); } catch (e) {}
  });
  await sayfa.goto(taban + yol, { waitUntil: 'domcontentloaded' });
  return sayfa;
}

/** Uygulamayı açıp istenen sekmeye geçer ve yerleşimin oturmasını bekler. */
async function uygulama(sekme, ekran) {
  const sayfa = await ac('/index.html', ekran);
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function', null, { timeout: 20000 });
  await sayfa.evaluate(s => window.loadPage(s), sekme);
  await sayfa.waitForTimeout(900);
  return sayfa;
}

/** İki dikdörtgen kesişiyor mu? Kenar teması çakışma sayılmaz. */
function cakisiyor(a, b) {
  return !(b.x + b.width <= a.x || b.x >= a.x + a.width ||
           b.y + b.height <= a.y || b.y >= a.y + a.height);
}

const SEKMELER = ['today', 'calendar', 'chatbot', 'projects', 'profile', 'dehb-info'];

test('mobilde her sayfa ekranı kullanıyor ve yatay kaydırma üretmiyor', async () => {
  const sayfa = await ac('/index.html', MOBIL);
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function', null, { timeout: 20000 });
  for (const sekme of SEKMELER) {
    await sayfa.evaluate(s => window.loadPage(s), sekme);
    await sayfa.waitForTimeout(700);
    const { sw, cw, ana } = await sayfa.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      ana: document.getElementById('main-content').getBoundingClientRect().width
    }));
    assert.ok(sw <= cw + 1, `${sekme}: yatay taşma ${sw} > ${cw}`);
    // ⚠️ Tek başına "yatay taşma yok" YETMİYOR: 2026-09-05'ten önceki sürüm bu
    // iddiayı GEÇİYORDU. 256px'lik sabit sidebar ana içeriği 125px'e eziyor,
    // içerik taşmak yerine tek kelimelik sütuna sarıyordu — sayfa kaydırmıyor
    // ama okunmuyordu da. Asıl ölçüt ana sütunun ekranı kullanması.
    assert.ok(ana >= cw * 0.85,
      `${sekme}: ana içerik eziliyor — ${Math.round(ana)}px / ${cw}px ekran`);
  }
  await sayfa.close();
});

test('Parçalayıcı: mobilde "Parçala" butonu input yazısının üstüne binmiyor', async () => {
  const sayfa = await uygulama('chatbot', MOBIL);
  const input = await sayfa.locator('#task-input').boundingBox();
  const buton = await sayfa.locator('#task-input ~ button').first().boundingBox();
  assert.ok(input && buton, 'input veya buton bulunamadı');
  assert.ok(!cakisiyor(input, buton),
    `buton input'un üstünde: input=${JSON.stringify(input)} buton=${JSON.stringify(buton)}`);
  assert.ok(input.width > 200, `input ezilmiş: ${input.width}px`);
  await sayfa.close();
});

test('Parçalayıcı: masaüstünde buton yine input İÇİNDE (mobil düzeltme sızmamış)', async () => {
  const sayfa = await uygulama('chatbot', MASAUSTU);
  const { konum, icinde } = await sayfa.evaluate(() => {
    const i = document.getElementById('task-input');
    const b = i.parentElement.querySelector('button');
    const ri = i.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return {
      konum: getComputedStyle(b).position,
      icinde: rb.right <= ri.right + 1 && rb.top >= ri.top - 1 && rb.bottom <= ri.bottom + 1
    };
  });
  assert.strictEqual(konum, 'absolute');
  assert.ok(icinde, 'masaüstünde buton input kutusunun dışına çıkmış');
  await sayfa.close();
});

/**
 * Aktif görünümü DOM'dan okur. `AppState` bir `const` — betik kapsamında
 * yaşıyor, `window` üzerinde YOK; testin iç duruma uzanması hem çalışmıyor
 * hem de gereksiz. FullCalendar görünüm kabına `fc-<gorunum>-view` sınıfını
 * basıyor, kullanıcının gördüğü şey de bu.
 */
const gorunum = sayfa => sayfa.evaluate(() =>
  [...(document.querySelector('.fc-view')?.classList || [])]
    .find(c => c.startsWith('fc-') && c.endsWith('-view')) || null);

test('Takvim: mobilde liste görünümüyle açılıyor, masaüstünde ay görünümüyle', async () => {
  const m = await uygulama('calendar', MOBIL);
  assert.strictEqual(await gorunum(m), 'fc-listWeek-view');
  await m.close();

  const d = await uygulama('calendar', MASAUSTU);
  assert.strictEqual(await gorunum(d), 'fc-dayGridMonth-view');
  await d.close();
});

test('Takvim: mobilde ay ızgarası Pazar sütununu kırpmıyor', async () => {
  const sayfa = await uygulama('calendar', MOBIL);
  // Kullanıcının yolu: üst şeritteki "Ay" butonuna basmak.
  await sayfa.click('.fc-dayGridMonth-button');
  await sayfa.waitForTimeout(700);
  assert.strictEqual(await gorunum(sayfa), 'fc-dayGridMonth-view');
  const tasma = await sayfa.evaluate(() =>
    [...document.querySelectorAll('.fc-scroller')].map(s => s.scrollWidth - s.clientWidth));
  assert.ok(tasma.every(t => t <= 1), `ızgara kutusundan taşıyor: ${JSON.stringify(tasma)}`);
  await sayfa.close();
});

test('Gün modalı mobilde tamamen ekranın içinde açılıyor', async () => {
  const sayfa = await uygulama('calendar', MOBIL);
  await sayfa.evaluate(() => window.openDayView(
    new Date().toISOString().slice(0, 10)));
  await sayfa.waitForTimeout(900);
  const olcum = await sayfa.evaluate(() => {
    const perde = document.getElementById('day-modal');
    const kutu = perde.querySelector(':scope > div');
    const rk = kutu.getBoundingClientRect();
    return { gizli: perde.classList.contains('hidden'), ust: rk.top, alt: rk.bottom, vh: innerHeight,
             ata: perde.parentElement.tagName };
  });
  assert.ok(!olcum.gizli, 'modal açılmadı');
  // Şablonun içinde kalırsa `animate-slide-in`in bıraktığı transform yüzünden
  // modal viewport yerine o kutuya oturuyor ve alt kenarı ekranın dışına düşüyor.
  assert.strictEqual(olcum.ata, 'BODY', 'modal body seviyesinden çıkmış');
  assert.ok(olcum.ust >= -1 && olcum.alt <= olcum.vh + 1,
    `modal ekran dışında: ${olcum.ust}–${olcum.alt} (ekran ${olcum.vh})`);
  await sayfa.close();
});

test('Mobil çekmece: hamburger açıyor, sayfa değişince kapanıyor', async () => {
  const sayfa = await uygulama('today', MOBIL);
  const kapali = () => sayfa.evaluate(() =>
    document.getElementById('app-sidebar').classList.contains('-translate-x-full'));

  assert.ok(await kapali(), 'çekmece açılışta kapalı olmalı');
  await sayfa.click('#mobile-menu-btn');
  await sayfa.waitForTimeout(450);
  assert.ok(!(await kapali()), 'hamburger çekmeceyi açmadı');

  await sayfa.click('#nav-calendar');
  await sayfa.waitForTimeout(700);
  assert.ok(await kapali(), 'sayfa değişince çekmece kapanmadı');
  assert.strictEqual(await sayfa.evaluate(() => document.body.style.overflow), '',
    'çekmece kapanınca sayfa kaydırması açılmadı');
  await sayfa.close();
});

test('Masaüstünde mobil kabuk devrede değil', async () => {
  const sayfa = await uygulama('today', MASAUSTU);
  const durum = await sayfa.evaluate(() => ({
    topbar: getComputedStyle(document.getElementById('mobile-topbar')).display,
    sidebar: getComputedStyle(document.getElementById('app-sidebar')).position,
    kaydirilmis: getComputedStyle(document.getElementById('app-sidebar')).transform
  }));
  assert.strictEqual(durum.topbar, 'none', 'masaüstünde mobil üst çubuk görünüyor');
  assert.strictEqual(durum.sidebar, 'sticky');
  assert.ok(durum.kaydirilmis === 'none' || durum.kaydirilmis === 'matrix(1, 0, 0, 1, 0, 0)',
    `sidebar masaüstünde kaydırılmış: ${durum.kaydirilmis}`);
  await sayfa.close();
});

test('Landing: mobilde hero metni maketle çakışmıyor ve üst bar taşmıyor', async () => {
  const sayfa = await ac('/landing.html', MOBIL);
  await sayfa.waitForTimeout(2200);
  const olcum = await sayfa.evaluate(() => {
    const R = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const gorsel = document.querySelector('.gorsel');
    return {
      metin: R(document.querySelector('.anlatim')),
      maket: getComputedStyle(gorsel).display === 'none' ? null : R(gorsel),
      navSag: document.querySelector('.top nav').getBoundingClientRect().right,
      metinUst: document.querySelector('.anlatim').getBoundingClientRect().top,
      navAlt: document.querySelector('.top').getBoundingClientRect().bottom,
      cw: document.documentElement.clientWidth,
      sw: document.documentElement.scrollWidth
    };
  });
  assert.ok(olcum.sw <= olcum.cw + 1, `landing yatay taşma: ${olcum.sw} > ${olcum.cw}`);
  assert.ok(olcum.navSag <= olcum.cw - 4, `üst bardaki butonlar taşıyor: ${olcum.navSag} > ${olcum.cw}`);
  assert.ok(olcum.metinUst >= olcum.navAlt - 1,
    `hero başlığı sabit navın altında kalıyor: metin ${olcum.metinUst}, nav ${olcum.navAlt}`);
  if (olcum.maket) {
    assert.ok(!cakisiyor(olcum.metin, olcum.maket),
      `hero metni maketle çakışıyor: ${JSON.stringify(olcum)}`);
  }
  await sayfa.close();
});
