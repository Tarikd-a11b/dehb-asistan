/**
 * Profil "Çalışma Analizim" kartı: sakin (animasyonsuz) satır içi SVG.
 *
 *   node test-ui/calisma-analizi.mjs        (npm run test:ui bunu da koşar)
 *
 * Çizim ağsız (renderAnalysisCard) olduğundan veri doğrudan verilir.
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

const DOLU = {
  calibration: {
    computedAt: '2026-10-12T07:00:00Z',
    factors: { low: 1.05, medium: 1.2, high: 1.6 },
    samples: { low: 6, medium: 9, high: 5 },
    focusSuggestion: 35, timedSessions: 11
  },
  daily: Array.from({ length: 14 }, (_, i) => ({ day: new Date(Date.UTC(2026, 8, 29 + i)).toISOString().slice(0, 10), minutes: i % 3 ? 30 + i : 0 })),
  focusPeriod: 25, guest: false
};

test('misafirde kart "Giriş yapınca açılır" der', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('profile'));
  await sayfa.waitForTimeout(1300);
  const metin = await sayfa.evaluate(() => document.getElementById('analysis-card')?.innerText || 'YOK');
  assert.match(metin, /Giriş yapınca açılır/);
  await sayfa.close();
});

test('az veride grafik yok, sayaç ilerlemesi yazıyor', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('profile'));
  await sayfa.waitForTimeout(1000);
  const r = await sayfa.evaluate(() => {
    const el = document.getElementById('analysis-card');
    window.renderAnalysisCard(el, { calibration: null, daily: [], focusPeriod: 25, guest: false });
    return { metin: el.innerText, svg: el.querySelectorAll('svg').length };
  });
  assert.match(r.metin, /0\/8 oturum/);
  assert.strictEqual(r.svg, 0);
  await sayfa.close();
});

test('dolu veride 3 çubuk, 14 sütun ve öneri kutusu', async () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const sayfa = await misafirSayfasi();
    await sayfa.setViewportSize(vp);
    await sayfa.evaluate(() => window.loadPage('profile'));
    await sayfa.waitForTimeout(1000);
    const r = await sayfa.evaluate((veri) => {
      const el = document.getElementById('analysis-card');
      window.renderAnalysisCard(el, veri);
      const kart = el.getBoundingClientRect();
      return {
        metin: el.innerText,
        cubuk: el.querySelectorAll('[data-analysis-bar]').length,
        sutun: el.querySelectorAll('[data-analysis-col]').length,
        uygula: !!el.querySelector('[data-analysis-apply]'),
        animasyon: [...el.querySelectorAll('*')].some(n => getComputedStyle(n).animationName !== 'none'),
        tasma: kart.right > window.innerWidth + 1 || document.documentElement.scrollWidth > window.innerWidth
      };
    }, DOLU);
    assert.strictEqual(r.cubuk, 3, `${vp.width}: çubuk`);
    assert.strictEqual(r.sutun, 14, `${vp.width}: sütun`);
    assert.strictEqual(r.uygula, true, `${vp.width}: öneri`);
    assert.match(r.metin, /25 → 35 dk/);
    assert.match(r.metin, /×1,6/);
    assert.strictEqual(r.animasyon, false, `${vp.width}: kartta animasyon var`);
    assert.strictEqual(r.tasma, false, `${vp.width}: yatay taşma`);
    await sayfa.close();
  }
});

test('öneri yoksa öneri kutusu çizilmez', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('profile'));
  await sayfa.waitForTimeout(1000);
  const var_ = await sayfa.evaluate((veri) => {
    const el = document.getElementById('analysis-card');
    window.renderAnalysisCard(el, { ...veri, calibration: { ...veri.calibration, focusSuggestion: null } });
    return !!el.querySelector('[data-analysis-apply]');
  }, DOLU);
  assert.strictEqual(var_, false);
  await sayfa.close();
});

// ══ Sayaç / ölçüm akışı (spec §8; final review I5, C1, I4, I6) ══
// Misafir modunda DB'ye yazılmaz (persistTimerPatch erken döner); satırlar
// TodayState'e doğrudan enjekte edilir. Ağ yolunu görmek gereken testlerde
// isGuestMode kapatılıp supabaseClient.from kayıt tutan bir kuklayla değiştirilir.
async function bugunSayfasi() {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('today'));
  await sayfa.waitForFunction(() => document.getElementById('today-current'), null, { timeout: 10000 });
  await sayfa.waitForTimeout(500);
  return sayfa;
}

/** Sayfada: verilen satırları Bugün'e koyar ve çizer. Dakika ofsetleri şimdiye göre. */
function gorevleriKoy(sayfa, satirlar) {
  return sayfa.evaluate((satirlar) => {
    const now = Date.now();
    const dk = (m) => new Date(now + m * 60000).toISOString();
    resetTaskTimer();
    TodayState.rows = satirlar.map(s => ({
      completed: false, cognitive_load: 'medium', day: localDayISO(),
      ...s,
      start_time: dk(s.bas), end_time: dk(s.bit),
      running_since: s.calisiyor != null ? dk(s.calisiyor) : null
    }));
    refreshBuckets(localDayISO());
    renderToday();
  }, satirlar);
}

/** isGuestMode'u kapatır; supabaseClient.from her çağrıyı window.__db'ye yazar. */
function dbKuklasi(sayfa, cevap = {}) {
  return sayfa.evaluate((cevap) => {
    isGuestMode = false;
    window.__db = [];
    window.supabaseClient.from = (tablo) => {
      const kayit = { tablo, adimlar: [] };
      window.__db.push(kayit);
      let tekil = false;
      const sonuc = () => {
        const isim = kayit.adimlar.map(a => a[0]).join('.');
        if (cevap[isim] !== undefined) return { data: cevap[isim], error: null };
        return { data: tekil ? null : [], error: null };
      };
      const z = new Proxy(function () {}, { get(_h, ad) {
        if (ad === 'then') return (c, r) => Promise.resolve(sonuc()).then(c, r);
        return (...a) => { kayit.adimlar.push([ad, a]); if (ad === 'single') tekil = true; return z; };
      } });
      return z;
    };
  }, cevap);
}

test('sayaç: Başlat → Duraklat → yeniden açılışta kalan süre geri gelir', async () => {
  const sayfa = await bugunSayfasi();
  await gorevleriKoy(sayfa, [{ id: 'g1', name: 'Olcum', bas: -1, bit: 24 }]);
  await sayfa.click('#timer-play-btn');
  await sayfa.waitForFunction(() => findTask('g1').running_since, null, { timeout: 5000 });
  assert.match(await sayfa.textContent('#timer-play-btn'), /Duraklat/);
  await sayfa.waitForTimeout(1300);
  await sayfa.click('#timer-play-btn');
  await sayfa.waitForFunction(() => !findTask('g1').running_since, null, { timeout: 5000 });
  const r = await sayfa.evaluate(() => ({ t: findTask('g1'), btn: document.getElementById('timer-play-btn').textContent }));
  assert.ok(r.t.active_seconds > 0, 'active_seconds: ' + r.t.active_seconds);
  assert.ok(r.t.started_at, 'started_at');
  assert.match(r.btn, /Başlat/);

  // Yeniden açılış: satır DB'den running_since dolu ve geçmiş bir zamanla gelir.
  const yeniden = await sayfa.evaluate(() => {
    resetTaskTimer();
    const t = findTask('g1');
    t.active_seconds = 60;
    t.running_since = new Date(Date.now() - 5 * 60000).toISOString();
    initTaskTimerForTask(t);
    updateTimerUI();
    return { kalan: TaskTimerState.remainingSeconds, toplam: TaskTimerState.totalSeconds,
             calisiyor: TaskTimerState.isRunning, btn: document.getElementById('timer-play-btn').textContent };
  });
  assert.strictEqual(yeniden.toplam, 25 * 60);
  assert.ok(Math.abs(yeniden.kalan - (25 * 60 - 360)) <= 2, 'kalan: ' + yeniden.kalan);
  assert.strictEqual(yeniden.calisiyor, true);
  assert.match(yeniden.btn, /Duraklat/);
  await sayfa.close();
});

test('C1: süresi geçmiş ölçülen görev kartta kalır, "süre doldu" satırı görünür', async () => {
  const sayfa = await bugunSayfasi();
  await gorevleriKoy(sayfa, [
    { id: 'olcen', name: 'Olculen gorev', bas: -40, bit: -15, calisiyor: -40, started_at: new Date().toISOString() },
    { id: 'aktif', name: 'Simdiki plan', bas: -10, bit: 15 },
    { id: 'sonra', name: 'Sonraki plan', bas: 20, bit: 45 }
  ]);
  const r = await sayfa.evaluate(() => ({
    kart: document.querySelector('#today-current h3')?.textContent,
    sayac: TaskTimerState.taskId,
    fazla: document.getElementById('timer-overtime')?.textContent || '',
    gizli: document.getElementById('timer-overtime')?.classList.contains('hidden')
  }));
  assert.strictEqual(r.kart, 'Olculen gorev');
  assert.strictEqual(r.sayac, 'olcen');
  assert.strictEqual(r.gizli, false);
  assert.match(r.fazla, /süre doldu · \+15 dk/);
  await sayfa.close();
});

test('sayaçsız tamamlama: süre sorusu çıkar, cevap duration_feedback yazar', async () => {
  const sayfa = await bugunSayfasi();
  await gorevleriKoy(sayfa, [
    { id: 's1', name: 'Sayacsiz', bas: -20, bit: 5 },
    { id: 's2', name: 'Diger', bas: 10, bit: 35 }
  ]);
  await dbKuklasi(sayfa);
  await sayfa.evaluate(() => toggleTask('s1'));
  await sayfa.waitForSelector('#duration-feedback', { timeout: 5000 });
  const tamam = await sayfa.evaluate(() => window.__db.map(k => k.adimlar.find(a => a[0] === 'update')?.[1][0])
    .find(p => p && p.completed === true));
  assert.ok(tamam, 'tamamlama yazilmadi');
  assert.ok(tamam.completed_at, 'completed_at');
  assert.strictEqual(tamam.actual_minutes, undefined, 'sayacsiz tamamlamada actual_minutes yazilmaz');
  await sayfa.click('#duration-feedback button:has-text("aynı")');
  await sayfa.waitForFunction(() => window.__db.some(k => k.adimlar.some(a => a[0] === 'update' && a[1][0].duration_feedback)), null, { timeout: 5000 });
  const r = await sayfa.evaluate(() => ({
    yama: window.__db.map(k => k.adimlar.find(a => a[0] === 'update')?.[1][0]).find(p => p && p.duration_feedback),
    serit: !!document.getElementById('duration-feedback'),
    gorev: findTask('s1').duration_feedback
  }));
  assert.deepStrictEqual(r.yama, { duration_feedback: 'same' });
  assert.strictEqual(r.serit, false);
  assert.strictEqual(r.gorev, 'same');
  await sayfa.close();
});

test('I4: başka sekme başlatmışsa Başlat running_since değerini ezmez, satır DB den tazelenir', async () => {
  const sayfa = await bugunSayfasi();
  await gorevleriKoy(sayfa, [{ id: 'k1', name: 'Iki sekme', bas: -1, bit: 24 }]);
  const dbdeki = await sayfa.evaluate(() => new Date(Date.now() - 4 * 60000).toISOString());
  // Koşullu güncelleme 0 satır döner; tazeleme okuması başka sekmenin satırını getirir.
  await dbKuklasi(sayfa, {
    'update.eq.is.select': [],
    'select.eq.single': { id: 'k1', running_since: dbdeki, started_at: dbdeki, active_seconds: 0 }
  });
  await sayfa.click('#timer-play-btn');
  await sayfa.waitForFunction(() => window.__db.some(k => k.adimlar.some(a => a[0] === 'single')), null, { timeout: 5000 });
  await sayfa.waitForTimeout(300);
  const r = await sayfa.evaluate(() => ({
    kosul: window.__db[0].adimlar.find(a => a[0] === 'is')?.[1],
    t: findTask('k1'), kalan: TaskTimerState.remainingSeconds, calisiyor: TaskTimerState.isRunning,
    btn: document.getElementById('timer-play-btn').textContent
  }));
  assert.deepStrictEqual(r.kosul, ['running_since', null]);
  assert.strictEqual(r.t.running_since, dbdeki, 'yerel yama geri alinip DB degeri alinmali');
  assert.ok(Math.abs(r.kalan - (25 * 60 - 240)) <= 2, 'kalan: ' + r.kalan);
  assert.strictEqual(r.calisiyor, true);
  assert.match(r.btn, /Duraklat/);
  await sayfa.close();
});

test('I6: Uygula kaydedilmemiş profil düzenlemelerini silmez', async () => {
  const sayfa = await misafirSayfasi();
  await sayfa.evaluate(() => window.loadPage('profile'));
  await sayfa.waitForTimeout(1000);
  await sayfa.fill('#work-start', '07:30');
  await sayfa.dispatchEvent('#work-start', 'change');
  await dbKuklasi(sayfa);
  await sayfa.evaluate((veri) => {
    userProfile.calibration = null;   // kart gördüğünü uygulamalı, profildekini değil
    window.renderAnalysisCard(document.getElementById('analysis-card'), veri);
  }, DOLU);
  await sayfa.click('[data-analysis-apply]');
  await sayfa.waitForFunction(() => document.getElementById('focus-period').value === '35', null, { timeout: 5000 });
  const r = await sayfa.evaluate(() => ({
    bas: document.getElementById('work-start').value,
    gosterge: document.getElementById('focus-display').textContent,
    kirli: document.getElementById('profile-dirty-bar').classList.contains('gorunur'),
    yama: window.__db.map(k => k.adimlar.find(a => a[0] === 'update')?.[1][0]).find(p => p && p.focus_period)
  }));
  assert.strictEqual(r.bas, '07:30');
  assert.strictEqual(r.gosterge, '35 dk');
  assert.strictEqual(r.kirli, true);
  assert.deepStrictEqual(r.yama, { focus_period: 35 });
  await sayfa.close();
});
