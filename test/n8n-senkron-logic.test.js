const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { izlenenDegerler, karsilastir, yamala, putGovdesi } = require('../scripts/n8n-senkron-logic.js');

const repo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'n8n-workflow-focusaid.json'), 'utf8'));

// Canlının taklidi: repodan farkı, yer tutucunun yerinde gerçek bir sır olması ve canlıya özgü alanlar.
function canliKopya() {
  const c = JSON.parse(JSON.stringify(repo));
  c.id = 'canli123';
  c.settings = { ...c.settings, binaryMode: 'separate', timezone: 'Europe/Istanbul' };
  const kaydet = c.nodes.find(n => n.name === 'Save task to Supabase');
  kaydet.parameters.__gercekSir = 'eyJ-GERCEK-SERVICE-ROLE';
  return c;
}

test('izlenen alanlar: kod, prompt ve yanıt gövdesi; httpRequest ve not yok', () => {
  const adlar = izlenenDegerler(repo).map(x => `${x.node}.${x.alan}`);
  assert.ok(adlar.includes('Code in JavaScript.jsCode'));
  assert.ok(adlar.includes('AI Agent.text'));
  assert.ok(adlar.includes('Respond to Webhook.responseBody'));
  assert.ok(!adlar.some(a => a.startsWith('Save task to Supabase')));
  assert.ok(!adlar.some(a => a.startsWith('Kurulum Notu')));
});

test('aynı içerik → hepsi ayni', () => {
  assert.ok(karsilastir(repo, canliKopya()).every(f => f.durum === 'ayni'));
});

test('canlıda değişen kod farkli olarak raporlanır', () => {
  const c = canliKopya();
  c.nodes.find(n => n.name === 'Code in JavaScript').parameters.jsCode += '\n// elle';
  const farkli = karsilastir(repo, c).filter(f => f.durum === 'farkli');
  assert.deepStrictEqual(farkli.map(f => f.node), ['Code in JavaScript']);
});

test('yamala yalnız izlenen alanı yazar, canlıdaki sırrı ve ayarları korur', () => {
  const c = canliKopya();
  c.nodes.find(n => n.name === 'Code in JavaScript').parameters.jsCode = 'eski';
  const { workflow, degisen } = yamala(c, repo);
  assert.deepStrictEqual(degisen, ['Code in JavaScript.jsCode']);
  const kod = repo.nodes.find(n => n.name === 'Code in JavaScript').parameters.jsCode;
  assert.strictEqual(workflow.nodes.find(n => n.name === 'Code in JavaScript').parameters.jsCode, kod);
  assert.strictEqual(workflow.nodes.find(n => n.name === 'Save task to Supabase').parameters.__gercekSir, 'eyJ-GERCEK-SERVICE-ROLE');
  assert.strictEqual(c.nodes.find(n => n.name === 'Code in JavaScript').parameters.jsCode, 'eski', 'girdi değişmemeli');
});

test('canlıda olmayan node yapısal farktır: yamala fırlatır', () => {
  const c = canliKopya();
  c.nodes = c.nodes.filter(n => n.name !== 'Prepare Supabase Payload');
  assert.strictEqual(karsilastir(repo, c).find(f => f.node === 'Prepare Supabase Payload').durum, 'canlida-yok');
  assert.throws(() => yamala(c, repo), /Prepare Supabase Payload\.jsCode/);
});

test('putGovdesi API dışı alanları ve bilinmeyen settings anahtarlarını atar', () => {
  const g = putGovdesi(canliKopya());
  assert.deepStrictEqual(Object.keys(g).sort(), ['connections', 'name', 'nodes', 'settings']);
  assert.deepStrictEqual(g.settings, { executionOrder: 'v1', timezone: 'Europe/Istanbul' });
});
