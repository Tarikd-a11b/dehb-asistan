/* Inline handler (onclick="...") kalmadı ve her data-tikla adı gerçekten
   çağrılabilir bir global fonksiyon.

   NEDEN: CSP script-src'te artık 'unsafe-inline' yok (bkz. serve.py CSP). Kaynağa
   yeni bir onclick="..." yazılırsa tarayıcı onu SESSİZCE engeller: düğme ölür,
   konsolda tek satır. Handler'lar olay.js üzerinden data-* ile bağlanıyor; olay.js
   adı window'da arıyor, bu yüzden ad `const`/`let` ya da IIFE içinde tanımlıysa
   da ölür. Bu dosya ikisini de metin olarak yakalıyor (tarayıcısız, hızlı). */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const KOK = path.join(__dirname, '..');
const KAYNAKLAR = fs.readdirSync(KOK)
  .filter(f => /\.(html|js)$/.test(f))
  .filter(f => !/^(config(\.example)?\.js|tailwind\.config\.js|olay\.js)$/.test(f) && !f.includes('.yedek'));
const metin = Object.fromEntries(KAYNAKLAR.map(f => [f, fs.readFileSync(path.join(KOK, f), 'utf8')]));
const hepsi = Object.values(metin).join('\n');

test('kaynakta inline on*="..." handler yok', () => {
  const bulunan = [];
  for (const [f, s] of Object.entries(metin)) {
    s.split('\n').forEach((satir, i) => {
      if (/\son[a-z]+\s*=\s*["'`]/i.test(satir) || /setAttribute\(\s*['"]on[a-z]+/i.test(satir)) bulunan.push(`${f}:${i + 1}  ${satir.trim().slice(0, 100)}`);
    });
  }
  assert.deepStrictEqual(bulunan, [], 'olay.js ile data-tikla/data-degis/... kullan');
});

test('href="javascript:..." yok', () => {
  assert.doesNotMatch(hepsi, /href\s*=\s*["']\s*javascript:/i);
});

test('her data-tikla/degis/girdi/enter/yuklenince adı global bir fonksiyon', () => {
  const adlar = new Set();
  for (const m of hepsi.matchAll(/data-(?:tikla|degis|girdi|enter|yuklenince)="([^"$]+)"/g)) adlar.add(m[1]);
  assert.ok(adlar.size > 50, `beklenenden az ad bulundu (${adlar.size}) — desen bozulmuş olabilir`);
  const eksik = [...adlar].filter(ad => {
    const kok = ad.split('.')[0];
    const tanim = new RegExp(`^(async )?function ${kok}\\(|window\\.${kok} *=`, 'm');
    return !tanim.test(hepsi);
  });
  assert.deepStrictEqual(eksik, [], 'üst düzey `function ad(` ya da `window.ad =` olmalı');
});

test('data-args geçerli JSON (şablon ifadeleri hariç)', () => {
  const bozuk = [];
  for (const m of hepsi.matchAll(/data-args='([^']*)'/g)) {
    const ham = m[1].replace(/\$\{[^}]*\}/g, 'x');
    try { if (!Array.isArray(JSON.parse(ham))) bozuk.push(m[1]); } catch (e) { bozuk.push(m[1]); }
  }
  assert.deepStrictEqual(bozuk, []);
});

test('handler kullanan her sayfa olay.js yüklüyor', () => {
  for (const f of KAYNAKLAR.filter(f => f.endsWith('.html'))) {
    if (/data-(tikla|degis|girdi|enter|yuklenince)=/.test(metin[f])) {
      assert.match(metin[f], /<script src="olay\.js"><\/script>/, `${f} olay.js yüklemiyor`);
    }
  }
});
