/**
 * `tailwind.css` kaynaklarla güncel mi?
 *
 *   node test-ui/tailwind-guncel.mjs     (npm run test:ui bunu da koşar)
 *
 * NEDEN: Tailwind artık CDN'den gelmiyor, `tailwind.css` olarak bir kez
 * üretiliyor. Bunun bedeli şu: yeni bir Tailwind sınıfı yazıp CSS'i yeniden
 * üretmezsen o sınıf dosyada olmaz ve öğe **sessizce stilsiz** kalır — ne
 * konsolda hata çıkar ne de sayfa patlar. Build adımının klasik tuzağı.
 *
 * Bu test tuzağı kapatıyor: CSS'i geçici bir dosyaya yeniden üretip
 * depodakiyle bayt bayt karşılaştırıyor. Fark varsa `npm run build:css`
 * unutulmuş demektir.
 *
 * `test/` altında DEĞİL: tailwindcss bir devDependency, oysa `node --test`
 * bilerek node_modules'süz çalışabiliyor (bkz. CLAUDE.md — uygulamanın kendisi
 * build adımsız statik dosyalar).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('tailwind.css kaynaklarla güncel (npm run build:css unutulmamış)', () => {
  const mevcut = fs.readFileSync(path.join(KOK, 'tailwind.css'), 'utf8');
  const gecici = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tw-')), 'tailwind.css');

  execFileSync(process.execPath, [
    path.join(KOK, 'node_modules', 'tailwindcss', 'lib', 'cli.js'),
    '-c', path.join(KOK, 'tailwind.config.js'),
    '-i', path.join(KOK, 'tailwind-giris.css'),
    '-o', gecici, '--minify'
  ], { cwd: KOK, stdio: 'pipe' });

  const taze = fs.readFileSync(gecici, 'utf8');
  fs.rmSync(path.dirname(gecici), { recursive: true, force: true });

  if (mevcut !== taze) {
    // Farkın ne olduğunu söyle: hangi seçiciler eklenmiş/eksilmiş?
    const seciciler = css => new Set(css.match(/(?:^|})([^{}]+)\{/g)?.map(x => x.replace(/[}{]/g, '').trim()) || []);
    const a = seciciler(mevcut), t = seciciler(taze);
    const eksik = [...t].filter(x => !a.has(x)).slice(0, 12);
    const fazla = [...a].filter(x => !t.has(x)).slice(0, 12);
    assert.fail(
      'tailwind.css güncel değil — `npm run build:css` çalıştır.\n' +
      `  boyut: depoda ${mevcut.length} bayt, taze ${taze.length} bayt\n` +
      (eksik.length ? `  dosyada OLMAYAN (stilsiz kalır): ${eksik.join(' ')}\n` : '') +
      (fazla.length ? `  artık kullanılmayan: ${fazla.join(' ')}\n` : ''));
  }
});

test('hiçbir sayfa Tailwind play CDN\'ini yüklemiyor', () => {
  for (const dosya of ['index.html', 'auth.html', 'index_2.html']) {
    const yol = path.join(KOK, dosya);
    if (!fs.existsSync(yol)) continue;
    const s = fs.readFileSync(yol, 'utf8');
    assert.ok(!/<script[^>]+cdn\.tailwindcss\.com/.test(s),
      `${dosya} hâlâ Tailwind play CDN'ini yüklüyor — 407 KB JS + tarayıcıda derleme demek`);
  }
});
