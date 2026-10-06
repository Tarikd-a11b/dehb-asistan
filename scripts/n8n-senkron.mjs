/**
 * n8n repo <-> canlı senkronu. Node kodunu tarayıcıya elle yapıştırmanın yerine geçer.
 *
 *   node scripts/n8n-senkron.mjs fark              # salt okunur; fark varsa çıkış kodu 1
 *   node scripts/n8n-senkron.mjs yukle             # kuru çalışma: neyin değişeceğini söyler
 *   node scripts/n8n-senkron.mjs yukle --uygula    # canlıya yazar
 *
 * Ortam: N8N_API_KEY (n8n → Settings → n8n API → Create API key), isteğe bağlı N8N_URL.
 * Workflow'lar ADLA eşlenir (repo JSON'larında id yok). Canlının JSON'ı diske YAZILMAZ:
 * içinde service_role anahtarı var. Hangi alanların izlendiği: n8n-senkron-logic.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { karsilastir, yamala, putGovdesi } = require('./n8n-senkron-logic.js');

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TABAN = (process.env.N8N_URL || 'https://focusaid-n8n.duckdns.org').replace(/\/$/, '');
const ANAHTAR = process.env.N8N_API_KEY;
const [komut, ...bayraklar] = process.argv.slice(2);

if (!['fark', 'yukle'].includes(komut)) {
  console.error('kullanım: node scripts/n8n-senkron.mjs fark | yukle [--uygula]');
  process.exit(2);
}
if (!ANAHTAR) {
  console.error('N8N_API_KEY tanımlı değil (n8n → Settings → n8n API → Create API key).');
  process.exit(2);
}

async function api(yol, secenek = {}) {
  const yanit = await fetch(TABAN + '/api/v1' + yol, {
    ...secenek,
    headers: { 'X-N8N-API-KEY': ANAHTAR, 'Content-Type': 'application/json', ...secenek.headers },
  });
  if (!yanit.ok) throw new Error(`${secenek.method || 'GET'} ${yol} → ${yanit.status} ${await yanit.text()}`);
  return yanit.json();
}

const repoWfler = fs.readdirSync(KOK)
  .filter(f => /^n8n-workflow-.*\.json$/.test(f))
  .map(f => ({ dosya: f, wf: JSON.parse(fs.readFileSync(path.join(KOK, f), 'utf8')) }));

const ozet = (await api('/workflows?limit=250')).data;
let farkVar = false;

for (const { dosya, wf: repoWf } of repoWfler) {
  const eslesen = ozet.filter(w => w.name === repoWf.name);
  if (eslesen.length !== 1) {
    console.log(`✖ ${dosya}: canlıda "${repoWf.name}" adlı ${eslesen.length} workflow var (1 beklenir)`);
    farkVar = true;
    continue;
  }
  const canliWf = await api('/workflows/' + eslesen[0].id);
  const farklar = karsilastir(repoWf, canliWf);
  const bozuk = farklar.filter(f => f.durum !== 'ayni');
  if (!bozuk.length) {
    console.log(`✓ ${dosya}: ${farklar.length} alan canlıyla aynı`);
    continue;
  }
  farkVar = true;
  console.log(`✖ ${dosya}:`);
  for (const f of bozuk) {
    const ek = f.durum === 'farkli' ? ` (repo ${f.repo.length} / canlı ${f.canli.length} karakter)` : '';
    console.log(`    ${f.node}.${f.alan} → ${f.durum}${ek}`);
  }

  if (komut === 'yukle') {
    const { workflow, degisen } = yamala(canliWf, repoWf);
    if (!bayraklar.includes('--uygula')) {
      console.log(`    kuru çalışma: ${degisen.join(', ')} yazılacaktı. Yazmak için --uygula`);
      continue;
    }
    await api('/workflows/' + eslesen[0].id, { method: 'PUT', body: JSON.stringify(putGovdesi(workflow)) });
    const sonra = karsilastir(repoWf, await api('/workflows/' + eslesen[0].id));
    const kalan = sonra.filter(f => f.durum !== 'ayni');
    console.log(kalan.length ? `    ⚠ yazıldı ama ${kalan.length} alan hâlâ farklı` : `    ✓ yazıldı ve doğrulandı: ${degisen.join(', ')}`);
    if (!kalan.length) farkVar = false;
  }
}

process.exit(farkVar && komut === 'fark' ? 1 : 0);
