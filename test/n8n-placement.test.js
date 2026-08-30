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
  const kes = (s) => (s.match(/function dailyCaps\([\s\S]*?\n\}\n/) || [''])[0];
  const repo = kes(fs.readFileSync(path.join(__dirname, '..', 'scheduling-logic.js'), 'utf8'));
  const node = kes(nodeCode('Code in JavaScript'));
  assert.ok(repo.length > 0 && node.length > 0, 'dailyCaps iki yerde de bulunmali');
  assert.strictEqual(node, repo, 'node kopyasi repodan ayrismis');
});
