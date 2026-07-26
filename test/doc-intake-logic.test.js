const { test } = require('node:test');
const assert = require('node:assert');
const L = require('../doc-intake-logic.js');

// ── fileKind ──
test('fileKind uzantidan turu bulur', () => {
  assert.strictEqual(L.fileKind('yonerge.pdf', ''), 'pdf');
  assert.strictEqual(L.fileKind('YONERGE.PDF', ''), 'pdf');
  assert.strictEqual(L.fileKind('odev.docx', ''), 'docx');
  assert.strictEqual(L.fileKind('resim.png', 'image/png'), null);
  assert.strictEqual(L.fileKind('eski.doc', ''), null);   // eski .doc formati desteklenmiyor
});

test('fileKind uzanti yoksa MIME turune bakar', () => {
  assert.strictEqual(L.fileKind('dosya', 'application/pdf'), 'pdf');
  assert.strictEqual(L.fileKind('dosya', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx');
});

// ── clampText ──
test('clampText sinir altinda dokunmaz', () => {
  const r = L.clampText('kisa metin');
  assert.strictEqual(r.text, 'kisa metin');
  assert.strictEqual(r.truncated, false);
});

test('clampText sinir ustunde kirpar ve bayrak koyar', () => {
  const r = L.clampText('a'.repeat(L.MAX_TEXT_CHARS + 500));
  assert.strictEqual(r.text.length, L.MAX_TEXT_CHARS);
  assert.strictEqual(r.truncated, true);
});

// ── parseRequirements ──
test('parseRequirements satirlara boler, bosluklari kirpar, bos satiri atar', () => {
  const girdi = '  4 asamali cizim  \n\nkatman kurallari\n   \nPDF ciktisi\n';
  assert.deepStrictEqual(L.parseRequirements(girdi), ['4 asamali cizim', 'katman kurallari', 'PDF ciktisi']);
});

test('parseRequirements bos girdide bos dizi doner', () => {
  assert.deepStrictEqual(L.parseRequirements(''), []);
  assert.deepStrictEqual(L.parseRequirements('   \n  \n'), []);
});

// ── validateAnalysis ──
const gecerli = {
  title: 'AutoCAD Portfolyo Odevi',
  deadline: '2026-08-15T23:59:00+03:00',
  deadlineQuote: 'Projeler 15 Agustos 2026 tarihine kadar teslim edilecektir.',
  requirements: ['4 asamali cizim', 'katman kurallari']
};

test('validateAnalysis gecerli yaniti kabul eder', () => {
  const r = L.validateAnalysis(gecerli);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.title, 'AutoCAD Portfolyo Odevi');
  assert.deepStrictEqual(r.data.requirements, ['4 asamali cizim', 'katman kurallari']);
});

test('validateAnalysis deadline null olmasina izin verir', () => {
  const r = L.validateAnalysis({ ...gecerli, deadline: null, deadlineQuote: null });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.deadline, null);
});

test('validateAnalysis ayristirilamayan tarihi reddeder', () => {
  const r = L.validateAnalysis({ ...gecerli, deadline: 'onumuzdeki hafta' });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /tarih/i);
});

test('validateAnalysis basliksiz yaniti reddeder', () => {
  assert.strictEqual(L.validateAnalysis({ ...gecerli, title: '' }).ok, false);
  assert.strictEqual(L.validateAnalysis({ ...gecerli, title: undefined }).ok, false);
});

test('validateAnalysis requirements dizi degilse reddeder', () => {
  const r = L.validateAnalysis({ ...gecerli, requirements: 'tek metin' });
  assert.strictEqual(r.ok, false);
});

test('validateAnalysis requirements eksikse bos dizi kabul eder', () => {
  const { requirements, ...eksik } = gecerli;
  const r = L.validateAnalysis(eksik);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.data.requirements, []);
});

test('validateAnalysis nesne olmayani reddeder', () => {
  assert.strictEqual(L.validateAnalysis(null).ok, false);
  assert.strictEqual(L.validateAnalysis('metin').ok, false);
});

test('validateAnalysis requirements icindeki bos maddeleri atar', () => {
  const r = L.validateAnalysis({ ...gecerli, requirements: ['  madde  ', '', '   ', 'ikinci'] });
  assert.deepStrictEqual(r.data.requirements, ['madde', 'ikinci']);
});

// ── toLocalDatetimeInput ──
test('toLocalDatetimeInput datetime-local formatina cevirir', () => {
  // 2026-08-15T23:59:00+03:00 -> yerel saat (Istanbul) 23:59
  assert.strictEqual(L.toLocalDatetimeInput('2026-08-15T23:59:00+03:00'), '2026-08-15T23:59');
});

test('toLocalDatetimeInput gecersiz girdide bos string doner', () => {
  assert.strictEqual(L.toLocalDatetimeInput('gecersiz'), '');
  assert.strictEqual(L.toLocalDatetimeInput(null), '');
});
