const { test } = require('node:test');
const assert = require('node:assert');
const { projeIkonu, ikonMetniEslestir } = require('../projects-logic.js');

const logo = (r) => r && r.tur === 'logo' ? r.etiket : null;
const emoji = (r) => r && r.tur === 'emoji' ? r.simge : null;

test('SQL gecen proje SQL logosu alir (Turkce ekle de)', () => {
  assert.strictEqual(logo(projeIkonu('SQL Ödevi')), 'SQL');
  assert.strictEqual(logo(projeIkonu("Olist verisini SQL'de sorgula")), 'SQL');
  assert.strictEqual(logo(projeIkonu('Veritabanı tasarımı')), 'SQL');
});

test('ozel olan genelden once: mysql > sql, javascript > java', () => {
  assert.strictEqual(logo(projeIkonu('MySQL kurulumu')), 'MySQL');
  assert.strictEqual(logo(projeIkonu('PostgreSQL migration')), 'PostgreSQL');
  assert.strictEqual(logo(projeIkonu('JavaScript öğren')), 'JavaScript');
  assert.strictEqual(logo(projeIkonu('Java OOP ödevi')), 'Java');
});

test('logo adresi surum sabitli devicon', () => {
  assert.match(projeIkonu("Python'la veri temizleme").src,
    /^https:\/\/cdn\.jsdelivr\.net\/gh\/devicons\/devicon@v[\d.]+\/icons\/python\/python-original\.svg$/);
});

test('Turkce kelimeler yanlis logo almaz (git → gitmek, canva → canvas)', () => {
  assert.notStrictEqual(logo(projeIkonu('Markete gitmek')), 'Git');
  assert.notStrictEqual(logo(projeIkonu('Canvas çizimi')), 'Canva');
  assert.strictEqual(logo(projeIkonu('Git branch temizliği')), 'Git');
});

test('is turune gore emoji', () => {
  assert.strictEqual(emoji(projeIkonu('Bitirme sunumu')), '🎤');
  assert.strictEqual(emoji(projeIkonu('Vize haftası')), '📚');
  assert.strictEqual(emoji(projeIkonu('CV güncelle')), '💼');
  assert.strictEqual(emoji(projeIkonu('Çatı güneş paneli fizibilite')), '☀️');
  assert.strictEqual(emoji(projeIkonu('Excel raporu')), '📗');
});

test('yanlis pozitif kalmasin: yazilim ≠ yazi, kosul ≠ kosu, marketing ≠ market', () => {
  assert.notStrictEqual(emoji(projeIkonu('Yazılım mimarisi')), '✍️');
  assert.notStrictEqual(emoji(projeIkonu('Koşullu ifadeler')), '🏋️');
  assert.notStrictEqual(emoji(projeIkonu('Marketing planı')), '🛒');
});

test('baslikta yoksa gorevlerde en cok gecen kazanir', () => {
  const r = projeIkonu('Bootcamp haftası 3', [
    'SQL ile müşteri tablosunu sorgula', 'SQL JOIN pratiği', 'Python notebook aç'
  ]);
  assert.strictEqual(logo(r), 'SQL');
});

test('baslik gorevlerden once gelir', () => {
  assert.strictEqual(emoji(projeIkonu('Sunum hazırla', ['Python grafiği çiz'])), '🎤');
});

test('hicbir eslesme yoksa null (arayuz eski temaya duser)', () => {
  assert.strictEqual(projeIkonu('Proje X', ['adım 1', 'adım 2']), null);
  assert.strictEqual(projeIkonu('', undefined), null);
  assert.strictEqual(ikonMetniEslestir(null), null);
});
