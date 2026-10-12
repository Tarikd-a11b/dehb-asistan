/* n8n `Build Per-User Reports` node'unu DOGRUDAN kosturur; `sureNotu` kopyasinin
   analysis-logic.js'teki analysisMailLine ile ayni ciktiyi verdigini kilitler. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../analysis-logic.js');

const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'n8n-workflow-report.json'), 'utf8'));
const node = (ad) => wf.nodes.find(n => n.name === ad);
const kos = (profiles, tasks) => new Function('$', node('Build Per-User Reports').parameters.jsCode)(
  (ad) => ({ all: () => (ad === 'Get all profiles' ? profiles : tasks).map(json => ({ json })) })
);

const CALS = [
  null,
  { factors: { low: 1.05, medium: 1.3, high: 1.6 }, samples: { low: 9, medium: 6, high: 5 } },
  { factors: { low: 1, medium: 1.3, high: 1.9 }, samples: { low: 0, medium: 6, high: 4 } },
  { factors: { low: 1.1, medium: 1.1, high: 1.15 }, samples: { low: 9, medium: 9, high: 9 } },
  JSON.stringify({ factors: { high: 2.2 }, samples: { high: 7 } }),
  'bozuk{',
  // yarim-deger (.x5) yuvarlama sinirlari
  { factors: { low: 1, medium: 1, high: 1.25 }, samples: { low: 0, medium: 0, high: 6 } },
  { factors: { low: 1, medium: 1.35, high: 1 }, samples: { low: 0, medium: 6, high: 0 } },
  { factors: { low: 1.95, medium: 1, high: 1 }, samples: { low: 6, medium: 0, high: 0 } },
];

test('sure_notu analysisMailLine ile birebir ayni', () => {
  for (const cal of CALS) {
    const out = kos([{ id: 'u', email: 'a@b.c', calibration: cal }],
                    [{ user_id: 'u', name: 'G', start_time: '2026-10-12T07:00:00Z' }]);
    assert.strictEqual(out[0].json.sure_notu, A.analysisMailLine(cal), JSON.stringify(cal));
  }
});
test('bos haftada mail yok kurali korunuyor', () => {
  assert.strictEqual(kos([{ id: 'u', email: 'a@b.c' }], []).length, 0);
});
test('profiles sorgusu calibration i seciyor', () => {
  const q = JSON.stringify(node('Get all profiles').parameters);
  assert.match(q, /calibration/);
});
test('AI prompt sure_notu yu kullaniyor', () => {
  assert.match(node('AI Agent').parameters.text, /\{\{ \$json\.sure_notu \}\}/);
});
