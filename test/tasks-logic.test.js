const { test } = require('node:test');
const assert = require('node:assert');
const L = require('../tasks-logic.js');

// ── localDayISO: UTC tuzağı ──
test('localDayISO yerel gunu verir, UTC kaymasi yapmaz', () => {
  // 26 Temmuz 01:30 yerel (UTC+3) → UTC'de 25 Temmuz 22:30.
  // toISOString() kullanilsaydi '2026-07-25' donerdi; dogrusu '2026-07-26'.
  const geceYarisiSonrasi = new Date(2026, 6, 26, 1, 30, 0);
  assert.strictEqual(L.localDayISO(geceYarisiSonrasi), '2026-07-26');
});

test('addDaysISO ay sinirini asar', () => {
  assert.strictEqual(L.addDaysISO('2026-07-01', -3), '2026-06-28');
  assert.strictEqual(L.addDaysISO('2026-07-26', 1), '2026-07-27');
});

// ── splitTasks ──
const rows = [
  { id: 1, day: '2026-07-24', completed: false, start_time: '2026-07-24T09:00:00+03:00', end_time: '2026-07-24T09:25:00+03:00' },
  { id: 2, day: '2026-07-24', completed: true,  start_time: '2026-07-24T10:00:00+03:00', end_time: '2026-07-24T10:25:00+03:00' },
  { id: 3, day: '2026-07-26', completed: false, start_time: '2026-07-26T09:00:00+03:00', end_time: '2026-07-26T09:25:00+03:00' },
  { id: 4, day: '2026-07-26', completed: true,  start_time: '2026-07-26T11:00:00+03:00', end_time: '2026-07-26T11:25:00+03:00' }
];

test('splitTasks bugunu ve devredenleri ayirir', () => {
  const { today, carried } = L.splitTasks(rows, '2026-07-26');
  assert.deepStrictEqual(today.map(t => t.id), [3, 4]);
  // gecmis gunun TAMAMLANMAMISI devreder; tamamlanmisi (id 2) gorunmez
  assert.deepStrictEqual(carried.map(t => t.id), [1]);
});

test('splitTasks oturumda tamamlanan devredeni listede tutar', () => {
  // Normalde tamamlanan devreden gorev (id 2) listeden duser.
  assert.deepStrictEqual(L.splitTasks(rows, '2026-07-26').carried.map(t => t.id), [1]);
  // keepIds ile bu oturumda tamamlananlar korunur (odul hissi kaybolmasin).
  const keep = new Set(['2']);
  assert.deepStrictEqual(L.splitTasks(rows, '2026-07-26', keep).carried.map(t => t.id), [1, 2]);
});

// ── pickCurrentTask ──
test('pickCurrentTask su an aktif olani secer', () => {
  const now = new Date('2026-07-26T09:10:00+03:00');
  const t = L.pickCurrentTask(L.splitTasks(rows, '2026-07-26').today, now);
  assert.strictEqual(t.id, 3);
});

test('pickCurrentTask aktif yoksa gelecekteki ilkini secer', () => {
  const now = new Date('2026-07-26T08:00:00+03:00');
  const t = L.pickCurrentTask(L.splitTasks(rows, '2026-07-26').today, now);
  assert.strictEqual(t.id, 3);
});

test('pickCurrentTask hepsi gecmisse en erken gecikmisi secer', () => {
  const now = new Date('2026-07-26T23:00:00+03:00');
  const gecikmis = [
    { id: 7, completed: false, start_time: '2026-07-26T15:00:00+03:00', end_time: '2026-07-26T15:25:00+03:00' },
    { id: 6, completed: false, start_time: '2026-07-26T09:00:00+03:00', end_time: '2026-07-26T09:25:00+03:00' }
  ];
  assert.strictEqual(L.pickCurrentTask(gecikmis, now).id, 6);
});

test('pickCurrentTask hepsi tamamlanmissa null doner', () => {
  const now = new Date('2026-07-26T12:00:00+03:00');
  const hepsiBitti = [{ id: 9, completed: true, start_time: '2026-07-26T09:00:00+03:00', end_time: '2026-07-26T09:25:00+03:00' }];
  assert.strictEqual(L.pickCurrentTask(hepsiBitti, now), null);
});

// ── computeProgress ──
test('computeProgress paydaya devredenleri de katar', () => {
  const { today, carried } = L.splitTasks(rows, '2026-07-26');
  assert.deepStrictEqual(L.computeProgress(today, carried), { done: 1, total: 3 });
});

// ── dayLabel ──
test('dayLabel notr gun etiketi verir', () => {
  assert.strictEqual(L.dayLabel('2026-07-25', '2026-07-26'), 'dün');
  assert.strictEqual(L.dayLabel('2026-07-23', '2026-07-26'), '3 gün önce');
});

// ── computeSnooze ──
const profil = { focusPeriod: 40, breakStyle: 'long-break', workHours: { start: '09:00', end: '18:00' } };

test('computeSnooze odak + mola kadar erteler, sureyi korur', () => {
  const task = { day: '2026-07-26', start_time: '2026-07-26T10:00:00+03:00', end_time: '2026-07-26T10:40:00+03:00' };
  const r = L.computeSnooze(task, profil);   // 40 + 15 = 55 dk
  assert.strictEqual(new Date(r.start_time).getHours(), 10);
  assert.strictEqual(new Date(r.start_time).getMinutes(), 55);
  // sure korunur: 40 dk
  assert.strictEqual((new Date(r.end_time) - new Date(r.start_time)) / 60000, 40);
  assert.strictEqual(r.day, '2026-07-26');
});

test('computeSnooze mesai sonunu asarsa yarinin mesai basina tasir', () => {
  const task = { day: '2026-07-26', start_time: '2026-07-26T17:30:00+03:00', end_time: '2026-07-26T18:10:00+03:00' };
  const r = L.computeSnooze(task, profil);   // 17:30 + 55 = 18:25 > 18:00
  const s = new Date(r.start_time);
  assert.strictEqual(r.day, '2026-07-27');
  assert.strictEqual(s.getHours(), 9);
  assert.strictEqual(s.getMinutes(), 0);
  assert.strictEqual((new Date(r.end_time) - s) / 60000, 40);
});

test('computeSnooze bos profilde 25+15=40 dk varsayilanini kullanir', () => {
  const task = { day: '2026-07-26', start_time: '2026-07-26T10:00:00+03:00', end_time: '2026-07-26T10:25:00+03:00' };
  const r = L.computeSnooze(task, {});
  assert.strictEqual(new Date(r.start_time).getHours(), 10);
  assert.strictEqual(new Date(r.start_time).getMinutes(), 40);
});

test('computeSnooze free mola stilinde sadece odak suresi kadar erteler', () => {
  const task = { day: '2026-07-26', start_time: '2026-07-26T10:00:00+03:00', end_time: '2026-07-26T10:30:00+03:00' };
  const r = L.computeSnooze(task, { focusPeriod: 30, breakStyle: 'free', workHours: { start: '09:00', end: '18:00' } });
  assert.strictEqual(new Date(r.start_time).getMinutes(), 30);  // 10:00 + 30 dk
});
