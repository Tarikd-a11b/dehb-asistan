/**
 * FocusAid — 🟢 Canlı Çalışma Odaları (tarayıcı testleri)
 *
 *   node test-ui/canli-odalar.mjs        veya     npm run test:ui
 *
 * Daily'ye ve Supabase'e ÇIKILMAZ: `window.Daily` sahte bir call object,
 * `/api/rooms/*` Playwright route ile cevaplanıyor, `supabaseClient.from`
 * kayıt tutan bir kuklayla değiştiriliyor. Zaman `page.clock` ile ilerletiliyor.
 *
 * Kilitlenen kullanıcı kararları (spec 2026-10-13):
 *   - Süre bitince ATILMAZ: soru çıkar, cevap yoksa serbest modda devam.
 *   - Sayfa değişince bağlantı KOPMAZ: katman mini görünüme iner.
 *   - Boşta kalma: 90 dk etkileşimsizlik → soru, 5 dk cevapsız → çıkış + dönüş kartı.
 *   - Başkasının hedef metni HTML olarak işlenmez.
 *   - Misafir: canlı odalar kapalı, /api/rooms'a istek yok.
 *   - Jitsi (varsayılan sağlayıcı): sekme tıklamada açılır, doluluk/token isteği yok,
 *     boşta kontrolü kapalı (kullanıcı Jitsi sekmesinde).
 *
 * Daily testleri window.FOCUSAID_CANLI_SAGLAYICI = 'daily' ile koşar.
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

/** Sahte Daily + kayıt tutan Supabase kuklası. Tarayıcıda çalışır. */
function sahteOrtam() {
  window.__daily = { katildi: 0, ayrildi: 0, userData: null, kamera: null };
  const dinleyiciler = {};
  const uzak = {
    session_id: 'uzak-1', user_name: 'Zeynep', user_id: '22222222-2222-2222-2222-222222222222', local: false,
    userData: { hedef: '<img src=x onerror="window.__xss=1">Tez', durum: 'mola', kotu: 'alan' },
    tracks: { video: { state: 'off' }, audio: { state: 'off' } }
  };
  window.Daily = {
    createCallObject() {
      const call = {
        on(ev, f) { (dinleyiciler[ev] ||= []).push(f); return call; },
        async join(o) { window.__daily.katildi++; window.__daily.joinOpts = o; },
        async leave() { window.__daily.ayrildi++; },
        destroy() {},
        participants() {
          return {
            local: { session_id: 'ben', user_name: 'Ayşe', local: true, userData: window.__daily.userData, tracks: { video: { state: 'off' } } },
            'uzak-1': uzak
          };
        },
        setUserData(d) { window.__daily.userData = d; },
        setLocalVideo(v) { window.__daily.kamera = v; },
        setLocalAudio() {},
        async updateSendSettings() {}
      };
      window.__daily.yay = (ev, veri) => (dinleyiciler[ev] || []).forEach(f => f(veri));
      return call;
    }
  };
}

function sahteSupabase() {
  window.__sb = [];
  const kayit = (tablo, islem, veri) => window.__sb.push({ tablo, islem, veri });
  const sorgu = (tablo) => {
    const q = {
      _islem: 'select', _veri: null,
      select() { return q; }, eq() { return q; }, gte() { return q; }, limit() { return q; }, order() { return q; },
      insert(v) { q._islem = 'insert'; q._veri = v; return q; },
      update(v) { q._islem = 'update'; q._veri = v; return q; },
      single() { return q; },
      then(coz, red) {
        kayit(tablo, q._islem, q._veri);
        let data = [];
        if (tablo === 'profiles' && q._islem === 'select') data = { room_consent_at: window.__onay || null };
        if (tablo === 'room_sessions' && q._islem === 'insert') data = { id: 'seans-1' };
        if (tablo === 'tasks' && q._islem === 'select') data = [{ id: 't1', name: 'Rapor yaz' }];
        return Promise.resolve({ data, error: null }).then(coz, red);
      }
    };
    return q;
  };
  window.supabaseClient.from = sorgu;
  window.supabaseClient.auth.getSession = async () => ({ data: { session: { access_token: 'tok' } } });
}

/** Girişli kullanıcı gibi odalar sayfasını açar. */
async function odalar({ ekran = MASAUSTU, misafirKal = false, onay = false, saglayici = 'daily' } = {}) {
  const sayfa = await tarayici.newPage({ viewport: ekran });
  const istekler = [];
  await sayfa.clock.install();
  await sayfa.route(/youtube(-nocookie)?\.com|ytimg\.com|unpkg\.com\/@daily-co/, r => r.abort());
  await sayfa.route('**/api/rooms/presence', r => { istekler.push('presence'); r.fulfill({ json: { rooms: { 'canli-gece': 2, 'canli-sabah': 0, 'canli-kutuphane': 0 } } }); });
  await sayfa.route('**/api/rooms/jitsi', r => {
    istekler.push('jitsi:' + (r.request().headers().authorization || ''));
    r.fulfill({ json: { rooms: { 'canli-gece': 'FocusAid-GeceKuslari-0123456789abcdef', 'canli-sabah': 'FocusAid-SabahKulubu-0123456789abcdef', 'canli-kutuphane': 'FocusAid-SessizKutuphane-0123456789abcdef' } } });
  });
  await sayfa.route('**/api/rooms/token', r => {
    istekler.push('token:' + JSON.parse(r.request().postData()).room);
    r.fulfill({ json: { url: 'https://ornek.daily.co/canli-gece', token: 'daily-tok', kalanDk: 200 } });
  });
  await sayfa.addInitScript(sahteOrtam);
  await sayfa.addInitScript(s => {
    window.FOCUSAID_CANLI_SAGLAYICI = s;
    window.__acilan = [];
    window.open = (url, hedef, ozellik) => { window.__acilan.push({ url, hedef, ozellik }); return null; };
  }, saglayici);
  await sayfa.addInitScript(() => {
    try { localStorage.setItem('focusaid_guest_mode', '1'); localStorage.removeItem('focusaid_son_canli_oda'); } catch (e) {}
  });
  await sayfa.goto(taban + '/index.html', { waitUntil: 'domcontentloaded' });
  await sayfa.waitForFunction(() => typeof window.loadPage === 'function' && typeof window.initCanliOdalar === 'function', null, { timeout: 20000 });
  if (!misafirKal) {
    await sayfa.evaluate(sahteSupabase);
    await sayfa.evaluate(o => { window.__onay = o ? '2026-10-13T00:00:00Z' : null; }, onay);
    // index.html'deki üst düzey let'ler: global kodla atanır.
    await sayfa.evaluate("isGuestMode = false; currentUser = { id: '11111111-1111-1111-1111-111111111111', email: 'gizli@ornek.com', user_metadata: { full_name: 'Ayşe Nur' } }; 1");
  }
  await sayfa.evaluate(() => window.loadPage('study-rooms'));
  await sayfa.clock.runFor(500);
  return { sayfa, istekler };
}

async function odayaGir(sayfa, { onayIste = true } = {}) {
  await sayfa.click('[data-canli-oda="canli-gece"]');
  await sayfa.waitForSelector('#canli-giris');
  if (onayIste) {
    assert.ok(await sayfa.isDisabled('#canli-gir-btn'), 'KVKK onayı olmadan giriş düğmesi kapalı olmalı');
    await sayfa.check('#canli-onay');
  }
  await sayfa.click('[data-canli-sure="25"]');
  await sayfa.click('#canli-gir-btn');
  await sayfa.waitForSelector('#canli-oda-katman');
  await sayfa.clock.runFor(1000);
}

test('misafir: canlı odalar kapalı, /api/rooms isteği yok', async () => {
  const { sayfa, istekler } = await odalar({ misafirKal: true });
  const not = await sayfa.textContent('#canli-oda-not');
  assert.match(not, /giriş/);
  const kapali = await sayfa.$$eval('[data-canli-oda]', b => b.map(x => x.disabled));
  assert.deepStrictEqual(kapali, [true, true, true]);
  assert.deepStrictEqual(istekler, []);
  await sayfa.close();
});

test('lobi: dolu oda başta, KVKK onayı şart, girişte token + oturum kaydı', async () => {
  const { sayfa, istekler } = await odalar();
  const sira = await sayfa.$$eval('#canli-oda-listesi [data-canli-oda]', b => b.map(x => x.dataset.canliOda));
  assert.strictEqual(sira[0], 'canli-gece');
  assert.match(await sayfa.textContent('[data-canli-oda="canli-gece"]'), /2 kişi/);
  await odayaGir(sayfa);
  assert.ok(istekler.includes('token:canli-gece'));
  const d = await sayfa.evaluate(() => ({ ...window.__daily, sb: window.__sb }));
  assert.strictEqual(d.katildi, 1);
  assert.strictEqual(d.joinOpts.startAudioOff, true, 'mikrofon kapalı başlamalı');
  assert.strictEqual(d.userData.durum, 'odak');
  assert.ok(d.sb.some(k => k.tablo === 'profiles' && k.islem === 'update' && k.veri.room_consent_at), 'onay yazılmalı');
  const ins = d.sb.find(k => k.tablo === 'room_sessions' && k.islem === 'insert');
  assert.strictEqual(ins.veri.room, 'canli-gece');
  assert.strictEqual(ins.veri.planned_minutes, 25);
  await sayfa.close();
});

test('başkasının hedefi metin olarak basılır, kamerasız kart + mola rozeti', async () => {
  const { sayfa } = await odalar({ onay: true });
  await odayaGir(sayfa, { onayIste: false });
  const kutu = '[data-kisi="uzak-1"]';
  assert.strictEqual(await sayfa.$$eval(`${kutu} img`, x => x.length), 0, 'HTML işlenmemeli');
  assert.strictEqual(await sayfa.evaluate(() => window.__xss), undefined);
  assert.match(await sayfa.textContent(`${kutu} .co-hedef-k`), /<img/);
  assert.strictEqual(await sayfa.textContent(`${kutu} .co-harf`), 'Z');
  assert.match(await sayfa.textContent(`${kutu} .co-rozet`), /molada/);
  await sayfa.close();
});

test('süre bitince ATILMAZ: soru → cevapsız kalınca serbest mod', async () => {
  const { sayfa } = await odalar({ onay: true });
  await odayaGir(sayfa, { onayIste: false });
  // Etkileşim sayılsın diye ara ara fare hareketi (boşta kontrolüne takılmasın).
  await sayfa.clock.runFor(25 * 60 * 1000);
  assert.strictEqual(await sayfa.textContent('[data-co="etiket"]'), 'SÜRE DOLDU');
  assert.ok(await sayfa.$('[data-canli-cevap="devam"]'));
  await sayfa.clock.runFor(3 * 60 * 1000);
  assert.strictEqual(await sayfa.textContent('[data-co="etiket"]'), 'ODAK · SERBEST');
  assert.ok(await sayfa.$('#canli-oda-katman'), 'odadan atılmamalı');
  assert.strictEqual(await sayfa.evaluate(() => window.__daily.ayrildi), 0);
  await sayfa.close();
});

test('mola: kamera kapanır, mola bitince geri açılır', async () => {
  const { sayfa } = await odalar({ onay: true });
  await odayaGir(sayfa, { onayIste: false });
  await sayfa.click('[data-canli-cevap="mola"]');
  assert.strictEqual(await sayfa.evaluate(() => window.__daily.kamera), false);
  assert.strictEqual(await sayfa.evaluate(() => window.__daily.userData.durum), 'mola');
  await sayfa.click('[data-canli-cevap="molayiBitir"]');
  assert.strictEqual(await sayfa.evaluate(() => window.__daily.kamera), true);
  await sayfa.close();
});

test('sayfa değişince bağlantı kopmaz, katman mini olur; çıkışta hedef sorusu', async () => {
  const { sayfa } = await odalar({ onay: true });
  await odayaGir(sayfa, { onayIste: false });
  await sayfa.evaluate(() => window.loadPage('today'));
  assert.strictEqual(await sayfa.getAttribute('#canli-oda-katman', 'data-gorunum'), 'mini');
  assert.strictEqual(await sayfa.evaluate(() => window.__daily.ayrildi), 0);
  await sayfa.click('[data-co="buyut"]');
  assert.strictEqual(await sayfa.getAttribute('#canli-oda-katman', 'data-gorunum'), 'tam');
  await sayfa.click('[data-co="cik"]');
  await sayfa.waitForSelector('#canli-hedef-sorusu');
  assert.strictEqual(await sayfa.evaluate(() => window.__daily.ayrildi), 1);
  await sayfa.click('[data-canli-hedef="yes"]');
  await sayfa.clock.runFor(100);
  const g = await sayfa.evaluate(() => window.__sb.filter(k => k.tablo === 'room_sessions' && k.islem === 'update').map(k => k.veri));
  assert.ok(g.some(v => v.left_at), 'çıkış zamanı yazılmalı');
  assert.ok(g.some(v => v.goal_met === 'yes'));
  await sayfa.close();
});

test('boşta: 90 dk etkileşimsizlik soru, 5 dk cevapsız çıkış + dönüş kartı', async () => {
  const { sayfa } = await odalar({ onay: true });
  await odayaGir(sayfa, { onayIste: false });
  await sayfa.clock.runFor(90 * 60 * 1000 + 2000);
  assert.ok(await sayfa.$('.co-bosta'), '"Hâlâ burada mısın?" görünmeli');
  await sayfa.clock.runFor(5 * 60 * 1000 + 2000);
  assert.strictEqual(await sayfa.$('#canli-oda-katman'), null);
  assert.ok(await sayfa.$('#canli-donus'), 'tek tıkla dönüş kartı');
  assert.strictEqual(await sayfa.$('#canli-hedef-sorusu'), null, 'boşta çıkışta soru sorulmaz');
  await sayfa.close();
});

test('boşta sorusu "Buradayım" ile kapanır, odada kalınır', async () => {
  const { sayfa } = await odalar({ onay: true });
  await odayaGir(sayfa, { onayIste: false });
  await sayfa.clock.runFor(90 * 60 * 1000 + 2000);
  // Düğme (fare hareketi olmadan: Playwright'ın click'i önce fareyi oynatır, o da soruyu kapatırdı)
  await sayfa.$eval('[data-canli-burada]', b => b.click());
  await sayfa.clock.runFor(6 * 60 * 1000);
  assert.strictEqual(await sayfa.$('.co-bosta'), null);
  assert.ok(await sayfa.$('#canli-oda-katman'));
  // Herhangi bir etkileşim (fare hareketi) de soruyu kapatır (son etkileşimden 6 dk geçti → 84 dk daha)
  await sayfa.clock.runFor(84 * 60 * 1000 + 2000);
  assert.ok(await sayfa.$('.co-bosta'));
  await sayfa.mouse.move(200, 200);
  await sayfa.mouse.move(260, 240);
  await sayfa.clock.runFor(6 * 60 * 1000);
  assert.strictEqual(await sayfa.$('.co-bosta'), null);
  assert.ok(await sayfa.$('#canli-oda-katman'), 'etkileşim varken odadan çıkarılmamalı');
  await sayfa.close();
});

test('mobil: oda katmanı yatay taşmıyor', async () => {
  const { sayfa } = await odalar({ ekran: MOBIL, onay: true });
  await odayaGir(sayfa, { onayIste: false });
  const tasma = await sayfa.evaluate(() => {
    const k = document.getElementById('canli-oda-katman');
    return { kw: k.scrollWidth, cw: k.clientWidth, doc: document.documentElement.scrollWidth, vw: window.innerWidth };
  });
  assert.ok(tasma.kw <= tasma.cw + 1, `katman taşıyor: ${tasma.kw} > ${tasma.cw}`);
  assert.ok(tasma.doc <= tasma.vw + 1, `sayfa taşıyor: ${tasma.doc} > ${tasma.vw}`);
  await sayfa.close();
});

test('günlük sınır: Daily atınca (ejected) dönüş kartı değil bilgi verilir, soru sorulmaz', async () => {
  const { sayfa } = await odalar({ onay: true });
  await odayaGir(sayfa, { onayIste: false });
  await sayfa.evaluate(() => window.__daily.yay('ejected', {}));
  await sayfa.clock.runFor(200);
  assert.strictEqual(await sayfa.$('#canli-oda-katman'), null);
  assert.strictEqual(await sayfa.$('#canli-hedef-sorusu'), null);
  assert.strictEqual(await sayfa.$('#canli-donus'), null);
  const sb = await sayfa.evaluate(() => window.__sb.filter(k => k.tablo === 'room_sessions' && k.islem === 'update').map(k => k.veri));
  assert.ok(sb.some(v => v.left_at), 'çıkış yine kaydedilmeli');
  await sayfa.close();
});

test('jitsi: kartlar Jitsi der, doluluk/token isteği yok; giriş sekmeyi açar ve oturumu kaydeder', async () => {
  const { sayfa, istekler } = await odalar({ saglayici: 'jitsi' });
  assert.match(await sayfa.textContent('[data-canli-oda="canli-gece"]'), /Jitsi/);
  await odayaGir(sayfa);
  const acilan = await sayfa.evaluate(() => window.__acilan);
  assert.strictEqual(acilan.length, 1, 'tek sekme açılmalı');
  assert.match(acilan[0].url, /^https:\/\/meet\.jit\.si\/FocusAid-GeceKuslari-0123456789abcdef#/, 'ad sunucudan');
  assert.match(acilan[0].url, /startWithAudioMuted=true/);
  assert.match(acilan[0].url, /displayName=%22Ay%C5%9Fe%22/, 'yalnız ilk ad');
  assert.ok(!acilan[0].url.includes('gizli'), "e-posta Jitsi'ye gitmez");
  assert.strictEqual(acilan[0].ozellik, 'noopener');
  assert.deepStrictEqual([...new Set(istekler)], ['jitsi:Bearer tok'], "Jitsi'de yalnız kimlikli oda adı isteği");
  assert.strictEqual(await sayfa.getAttribute('[data-co="jitsi-ac"]', 'href'), acilan[0].url);
  assert.strictEqual(await sayfa.isVisible('[data-co="kamera"]'), false);
  const sb = await sayfa.evaluate(() => window.__sb);
  assert.ok(sb.some(k => k.tablo === 'room_sessions' && k.islem === 'insert' && k.veri.room === 'canli-gece'));
  assert.ok(sb.some(k => k.tablo === 'profiles' && k.islem === 'update' && k.veri.room_consent_at), 'onay yazılmalı');
  await sayfa.close();
});

test('jitsi: oda adı alınamazsa sekme açılmaz, oturum kaydı yok', async () => {
  const { sayfa } = await odalar({ saglayici: 'jitsi', onay: true });
  await sayfa.route('**/api/rooms/jitsi', r => r.fulfill({ status: 500, json: { error: 'x' } }));
  await sayfa.evaluate("CanliState.jitsiAdlari = null; 1");
  await sayfa.click('[data-canli-oda="canli-gece"]');
  await sayfa.waitForSelector('#canli-giris');
  await sayfa.click('#canli-gir-btn');
  await sayfa.clock.runFor(500);
  assert.deepStrictEqual(await sayfa.evaluate(() => window.__acilan), []);
  assert.strictEqual(await sayfa.$('#canli-oda-katman'), null);
  assert.ok(await sayfa.$('#canli-giris'), 'panel açık kalır, tekrar denenebilir');
  const sb = await sayfa.evaluate(() => window.__sb);
  assert.ok(!sb.some(k => k.tablo === 'room_sessions' && k.islem === 'insert'));
  await sayfa.close();
});

test('jitsi: sayaç işler, boşta kontrolü yok; çıkışta hedef sorusu', async () => {
  const { sayfa } = await odalar({ saglayici: 'jitsi', onay: true });
  await odayaGir(sayfa, { onayIste: false });
  await sayfa.clock.runFor(25 * 60 * 1000);
  assert.strictEqual(await sayfa.textContent('[data-co="etiket"]'), 'SÜRE DOLDU');
  await sayfa.clock.runFor(100 * 60 * 1000);
  assert.strictEqual(await sayfa.$('.co-bosta'), null, 'Jitsi sekmesindeki kullanıcı boşta sayılmamalı');
  assert.ok(await sayfa.$('#canli-oda-katman'));
  await sayfa.evaluate(() => window.loadPage('today'));
  assert.strictEqual(await sayfa.getAttribute('#canli-oda-katman', 'data-gorunum'), 'mini');
  await sayfa.click('[data-co="cik"]');
  await sayfa.waitForSelector('#canli-hedef-sorusu');
  const g = await sayfa.evaluate(() => window.__sb.filter(k => k.tablo === 'room_sessions' && k.islem === 'update').map(k => k.veri));
  assert.ok(g.some(v => v.left_at && v.focus_seconds >= 25 * 60), 'odak süresi yazılmalı');
  await sayfa.close();
});

test('jitsi mobil: katman taşmıyor', async () => {
  const { sayfa } = await odalar({ saglayici: 'jitsi', ekran: MOBIL, onay: true });
  await odayaGir(sayfa, { onayIste: false });
  const t = await sayfa.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth,
    kw: document.getElementById('canli-oda-katman').scrollWidth, cw: document.getElementById('canli-oda-katman').clientWidth }));
  assert.ok(t.kw <= t.cw + 1 && t.doc <= t.vw + 1, JSON.stringify(t));
  await sayfa.close();
});
