/* n8n `FocusAid Weekly Processor` node kodunu DOGRUDAN kosturur.
   Bu kod repoda bir JSON alaninda duruyor ve elle canliya kopyalaniyor; boyle
   olunca hicbir sey onu test etmiyordu. Yerlestiricinin degismezleri (cakisma
   yok, gorev kaybi yok) burada kilitleniyor. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WF = path.join(__dirname, '..', 'n8n-workflow-focusaid.json');
const wf = JSON.parse(fs.readFileSync(WF, 'utf8'));
const nodeCode = (ad) => wf.nodes.find(n => n.name === ad).parameters.jsCode;

/** n8n `Code` node'unu yerelde kosar: $input / $ / $json sahteleri verilir. */
const normalize = (body) =>
  new Function('$input', nodeCode('Normalize & Calculate'))({ first: () => ({ json: { body } }) })[0].json;

const place = (merged, tasks) =>
  new Function('$', '$json', nodeCode('Code in JavaScript'))(
    () => ({ first: () => ({ json: merged }) }),
    { output: JSON.stringify({ tasks }) }
  );

const gorevler = (n) => Array.from({ length: n }, (_, i) => ({
  title: 'Gorev ' + i, summary: '', cognitiveLoad: ['high', 'medium', 'low'][i % 3]
}));

function plan(gunSonra, gorevSayisi, secenek = {}) {
  const merged = normalize({
    taskTitle: 'Deneme', userId: 'u',
    deadline: new Date(Date.now() + gunSonra * 86400000).toISOString(),
    userProfile: {
      focusPeriod: 25, breakStyle: secenek.mola || 'pomodoro',
      workHours: secenek.pencere || { start: '09:00', end: '18:00' },
      todayMood: secenek.mod || '', hyperfocusLimit: 'none'
    }
  });
  merged.existingEvents = secenek.etkinlikler || [];
  return place(merged, gorevler(gorevSayisi));
}

const araliklar = (out) => out
  .map(r => [new Date(r.json.start).getTime(), new Date(r.json.end).getTime()])
  .sort((a, b) => a[0] - b[0]);

function ortusmeVar(out) {
  const a = araliklar(out);
  for (let i = 1; i < a.length; i++) if (a[i][0] < a[i - 1][1]) return true;
  return false;
}

// ── degismezler ──
test('hicbir senaryoda gorev ust uste binmez (tasma regresyonu)', () => {
  // Eskiden tasma dali `startAbs = session.start` ile doluluga BAKMADAN
  // zorluyordu; asiri dolu planlarda ayni saate birden cok etkinlik dusuyordu.
  for (const [gun, T] of [[1, 20], [1, 9], [2, 14], [3, 20], [1, 40], [7, 40], [5, 3]]) {
    const out = plan(gun, T);
    assert.strictEqual(ortusmeVar(out), false, `${gun} gun / ${T} gorev -> ortusme`);
  }
});

test('gorev sayisi korunur, hicbiri dusurulmez', () => {
  for (const [gun, T] of [[1, 20], [3, 9], [7, 14], [1, 1]]) {
    assert.strictEqual(plan(gun, T).length, T, `${gun} gun / ${T} gorev`);
  }
});

test('mevcut takvim etkinliklerinin ustune yazilmaz', () => {
  const g = new Date(Date.now() + 86400000);
  const saat = (h) => new Date(Date.UTC(g.getFullYear(), g.getMonth(), g.getDate(), h - 3, 0)).toISOString();
  const etkinlikler = [{ start: { dateTime: saat(9) }, end: { dateTime: saat(13) } }];
  const out = plan(3, 9, { etkinlikler });
  for (const [s, e] of araliklar(out)) {
    const es = new Date(saat(9)).getTime(), ee = new Date(saat(13)).getTime();
    assert.ok(!(s < ee && e > es), 'mevcut etkinlikle cakisti: ' + new Date(s).toISOString());
  }
});

test('gece yarisini asan calisma penceresinde de cakisma olmaz', () => {
  const out = plan(3, 14, { pencere: { start: '20:00', end: '06:00' } });
  assert.strictEqual(ortusmeVar(out), false);
  assert.strictEqual(out.length, 14);
});

// ── tasma gorunur olmali ──
test('sigan planda deadlineAsiyor bayragi hic true olmaz', () => {
  const out = plan(7, 5);
  assert.ok(out.every(r => r.json.deadlineAsiyor === false), 'rahat planda tasma isaretlenmemeli');
});

test('sigmayan planda tasan gorevler isaretlenir (kullaniciya soylenebilsin)', () => {
  const out = plan(1, 40);   // 1 gune 40 gorev: imkansiz
  assert.ok(out.some(r => r.json.deadlineAsiyor === true), 'tasma isaretlenmeli');
  assert.strictEqual(out.length, 40, 'tasan gorevler yine de silinmemeli');
});

// ── mod ──
test('zor mod bugunku gorev sayisini artirmaz, genelde azaltir', () => {
  const bugunkuSayi = (out) => {
    const ilkGun = araliklar(out)[0];
    const gun = out.find(r => new Date(r.json.start).getTime() === ilkGun[0]).json.day;
    return out.filter(r => r.json.day === gun).length;
  };
  const notr = plan(4, 9);
  const kaygili = plan(4, 9, { mod: 'anxious' });
  assert.ok(bugunkuSayi(kaygili) <= bugunkuSayi(notr), 'kaygili gun daha agir olmamali');
});

// ── repo <-> node kopya esitligi (CLAUDE.md kurali) ──
test('dailyCaps govdesi scheduling-logic.js ile birebir ayni', () => {
  // ⚠️ Satir sonlari NORMALIZE ediliyor: repo dosyasi Windows'ta CRLF ile
  // checkout ediliyor (git autocrlf), node'un jsCode alani ise JSON icinde
  // her zaman LF. Karsilastirma CR'lere takilirsa test taze bir clone'da
  // yanlislikla duser — bir kez dustu.
  const norm = (s) => s.replace(/\r\n/g, '\n');
  const kes = (s) => (norm(s).match(/function dailyCaps\([\s\S]*?\n\}\n/) || [''])[0];
  const repo = kes(fs.readFileSync(path.join(__dirname, '..', 'scheduling-logic.js'), 'utf8'));
  const node = kes(nodeCode('Code in JavaScript'));
  assert.ok(repo.length > 0 && node.length > 0, 'dailyCaps iki yerde de bulunmali');
  assert.strictEqual(node, repo, 'node kopyasi repodan ayrismis');
});

// ── sure carpani (calisma analizi, 2026-10-12) ──
function planCarpanli(carpanlar, gorevSayisi = 6, gunSonra = 3) {
  const merged = normalize({
    taskTitle: 'Deneme', userId: 'u',
    deadline: new Date(Date.now() + gunSonra * 86400000).toISOString(),
    userProfile: {
      focusPeriod: 25, breakStyle: 'pomodoro',
      workHours: { start: '09:00', end: '18:00' }, todayMood: '', hyperfocusLimit: 'none',
      durationFactors: carpanlar
    }
  });
  merged.existingEvents = [];
  return place(merged, gorevler(gorevSayisi));
}
const sureDk = (r) => (new Date(r.json.end) - new Date(r.json.start)) / 60000;

test('Normalize durationFactors i gecirir, yoksa hepsi 1', () => {
  const dl = new Date(Date.now() + 2 * 86400000).toISOString();
  const m = normalize({ taskTitle: 'x', userId: 'u', deadline: dl, userProfile: { focusPeriod: 25 } });
  assert.deepStrictEqual(m.profile.durationFactors, { low: 1, medium: 1, high: 1 });
  const m2 = normalize({ taskTitle: 'x', userId: 'u', deadline: dl,
    userProfile: { focusPeriod: 25, durationFactors: { low: 1, medium: 1.2, high: 1.6 } } });
  assert.deepStrictEqual(m2.profile.durationFactors, { low: 1, medium: 1.2, high: 1.6 });
});
test('carpan 1 iken blok = focusPeriod (eski davranis aynen)', () => {
  for (const r of planCarpanli({ low: 1, medium: 1, high: 1 })) assert.strictEqual(sureDk(r), 25);
});
test('carpan bloklari uzatir: high 1.6 -> 40 dk, medium 1.2 -> 30 dk', () => {
  const out = planCarpanli({ low: 1, medium: 1.2, high: 1.6 });
  for (const r of out) {
    const beklenen = { high: 40, medium: 30, low: 25 }[r.json.cognitiveLoad];
    assert.strictEqual(sureDk(r), beklenen, r.json.cognitiveLoad);
  }
});
test('carpanli planda da ust uste binme ve gorev kaybi yok', () => {
  for (const [gun, T] of [[1, 20], [2, 14], [3, 20], [7, 40]]) {
    const out = planCarpanli({ low: 0.6, medium: 1.5, high: 2.5 }, T, gun);
    assert.strictEqual(out.length, T, `${gun} gun / ${T} gorev -> kayip`);
    assert.strictEqual(ortusmeVar(out), false, `${gun} gun / ${T} gorev -> ortusme`);
  }
});
test('kucuk carpan bloku 10 dk altina indirmez', () => {
  const merged = normalize({ taskTitle: 'x', userId: 'u',
    deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
    userProfile: { focusPeriod: 15, breakStyle: 'pomodoro', workHours: { start: '09:00', end: '18:00' },
                   durationFactors: { low: 0.6, medium: 0.6, high: 0.6 } } });
  merged.existingEvents = [];
  for (const r of place(merged, gorevler(3))) assert.strictEqual(sureDk(r), 10);
});

// ── uygulanan carpan (planned_factor) ve mola (final review C2 / I1) ──
const pf = (r) => r.json.plannedFactor;
test('plannedFactor: carpan 1 / yok iken 1', () => {
  for (const r of planCarpanli({ low: 1, medium: 1, high: 1 })) assert.strictEqual(pf(r), 1);
  for (const r of plan(3, 6)) assert.strictEqual(pf(r), 1);
});
test('plannedFactor blogu uzatan carpana esit (high 1.6, medium 1.2)', () => {
  for (const r of planCarpanli({ low: 1, medium: 1.2, high: 1.6 })) {
    assert.strictEqual(pf(r), { high: 1.6, medium: 1.2, low: 1 }[r.json.cognitiveLoad], r.json.cognitiveLoad);
  }
});
test('plannedFactor 10 dk tabaninda blogun gercek orani (10/15)', () => {
  const merged = normalize({ taskTitle: 'x', userId: 'u',
    deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
    userProfile: { focusPeriod: 15, breakStyle: 'pomodoro', workHours: { start: '09:00', end: '18:00' },
                   durationFactors: { low: 0.6, medium: 0.6, high: 0.6 } } });
  merged.existingEvents = [];
  for (const r of place(merged, gorevler(3))) {
    assert.strictEqual(sureDk(r), 10);
    assert.strictEqual(pf(r), 0.667);
  }
});
test('uzatilmis bloklar arasinda mola korunur (gap >= breakMinutes)', () => {
  // pomodoro 25+5: medium 1.2 -> 30 dk = adim. Eskiden ikinci blok ilkinin bittigi
  // dakikada basliyordu (mola 0).
  for (const carpan of [{ low: 1, medium: 1.2, high: 1.6 }, { low: 1.2, medium: 1.2, high: 1.2 }, { low: 0.6, medium: 1.5, high: 2.5 }]) {
    const out = planCarpanli(carpan, 12, 2);
    const gunler = new Map();
    for (const r of out) { if (!gunler.has(r.json.day)) gunler.set(r.json.day, []); gunler.get(r.json.day).push(r); }
    for (const [gun, liste] of gunler) {
      const a = araliklar(liste);
      for (let i = 1; i < a.length; i++) {
        const mola = (a[i][0] - a[i - 1][1]) / 60000;
        assert.ok(mola >= 5, `${JSON.stringify(carpan)} ${gun}: mola ${mola} dk`);
      }
    }
    assert.strictEqual(out.length, 12);
    assert.strictEqual(ortusmeVar(out), false);
  }
});

// ── Prepare Supabase Payload: planned_factor satira yazilir, indeks eslesmesi korunur ──
const prepare = (events, tasks) =>
  new Function('$input', '$', nodeCode('Prepare Supabase Payload'))(
    { all: () => events.map(json => ({ json })) },
    () => ({ all: () => tasks })
  );
test('Prepare Supabase Payload planned_factor yazar, sira korunur', () => {
  const tasks = planCarpanli({ low: 1, medium: 1.2, high: 1.6 }, 6);
  const events = tasks.map((_, i) => ({ id: 'ev' + i }));
  const rows = prepare(events, tasks).map(r => r.json);
  assert.strictEqual(rows.length, tasks.length);
  rows.forEach((row, i) => {
    assert.strictEqual(row.calendar_event_id, 'ev' + i);
    assert.strictEqual(row.name, tasks[i].json.title);
    assert.strictEqual(row.start_time, tasks[i].json.start);
    assert.strictEqual(row.planned_factor, tasks[i].json.plannedFactor);
  });
  // Eski bir cikti (plannedFactor yok) -> null (analizde 1 sayilir)
  const eski = [{ json: { ...tasks[0].json, plannedFactor: undefined } }];
  assert.strictEqual(prepare([{ id: 'x' }], eski)[0].json.planned_factor, null);
});
test('Save task to Supabase govdesi planned_factor alanini gonderir', () => {
  const body = wf.nodes.find(n => n.name === 'Save task to Supabase').parameters.jsonBody;
  assert.match(body, /planned_factor: \$json\.planned_factor/);
});

// ── Bozuk / kotu niyetli LLM ciktisi (OWASP LLM01 + LLM05) ──
// Yonerge dosyasina gomulu bir talimat modelin ciktisini yonlendirebilir. Tarih ve
// sure zaten modelden ALINMIYOR (yerlestirici hesapliyor); burada kalan yuzey
// sayi, tur ve uzunluk.
const hamPlan = (output) => {
  const merged = normalize({
    taskTitle: 'Deneme', userId: 'u', deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    userProfile: { focusPeriod: 25, breakStyle: 'pomodoro', workHours: { start: '09:00', end: '18:00' } }
  });
  merged.existingEvents = [];
  return new Function('$', '$json', nodeCode('Code in JavaScript'))(
    () => ({ first: () => ({ json: merged }) }), { output });
};
test('LLM 500 gorev uretse de takvime en fazla 40 gorev gider', () => {
  const out = hamPlan(JSON.stringify({ tasks: gorevler(500) }));
  assert.strictEqual(out.length, 40);
  assert.strictEqual(ortusmeVar(out), false);
});
test('LLM tarih/sure alanlari yok sayilir: 1970 ya da 99 saat yerlesimi bozmaz', () => {
  const out = hamPlan(JSON.stringify({ tasks: [
    { title: 'a', start: '1970-01-01T00:00:00Z', durationMinutes: 99 * 60, day: '1970-01-01' }] }));
  const sure = (new Date(out[0].json.end) - new Date(out[0].json.start)) / 60000;
  assert.strictEqual(sure, 25);
  assert.ok(new Date(out[0].json.start) > new Date(Date.now() - 60000), 'gecmise yerlesmemeli');
});
test('LLM alan turleri temizlenir: nesne baslik, dev metin, uydurma yuk, bos oge', () => {
  const out = hamPlan(JSON.stringify({ tasks: [
    { title: { html: '<b>x</b>' }, summary: 'y'.repeat(50000), cognitiveLoad: 'extreme' },
    null, 'duz metin', [1, 2],
    { name: 'Satir\nkiran\u0000ad', cognitive_load: 'high' }] }));
  assert.strictEqual(out.length, 2, 'yalniz nesne ogeler gorev olur');
  const [a, b] = out.map(r => r.json).sort((x, y) => x.title.localeCompare(y.title));
  assert.strictEqual(typeof a.title, 'string');
  assert.ok(b.title === 'Satir kiran ad' || a.title === 'Satir kiran ad', 'kontrol karakterleri bosluga');
  for (const g of [a, b]) {
    assert.ok(g.summary.length <= 1000);
    assert.ok(['high', 'medium', 'low'].includes(g.cognitiveLoad));
  }
});
test('LLM ciktisi null ya da gorevsiz: anlasilir hata', () => {
  assert.throws(() => hamPlan('null'), /hic gorev uretmedi/);
  assert.throws(() => hamPlan(JSON.stringify({ tasks: [null, 3] })), /hic gorev uretmedi/);
});
