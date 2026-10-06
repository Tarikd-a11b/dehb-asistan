/**
 * n8n repo <-> canlı senkronu — saf mantık (ağsız, DOM'suz). Komut satırı: n8n-senkron.mjs
 *
 * YALNIZCA aşağıdaki alanlar izlenir ve yazılır. Bilinçli dar tutuldu:
 *  - httpRequest node'ları canlıda gerçek sırlar taşıyor (Save task to Supabase → service_role).
 *    Repodaki karşılıkları yer tutucu ("SERVICE_ROLE_KEY_BURAYA"); workflow'u toptan
 *    basmak canlıdaki anahtarı yer tutucuyla ezer ve akışı kırar.
 *  - credential bağlantıları canlıya özgü kimlikler.
 *  - stickyNote yalnız belge.
 * Yapısal değişiklik (node ekleme/silme, bağlantı) bu araçla taşınmaz: elle yapılır.
 */
'use strict';

const IZLENEN_ALANLAR = {
  'n8n-nodes-base.code': ['jsCode'],
  '@n8n/n8n-nodes-langchain.agent': ['text'],
  'n8n-nodes-base.respondToWebhook': ['responseBody'],
};

// Public API'nin PUT /workflows/{id} gövdesinde kabul ettiği settings alanları.
// Fazlası "settings must NOT have additional properties" ile reddediliyor.
const PUT_SETTINGS = [
  'saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
  'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone',
  'executionOrder', 'callerPolicy', 'callerIds',
];

/** workflow → [{ node, alan, deger }] (yalnız izlenen alanlar, değer string). */
function izlenenDegerler(wf) {
  const sonuc = [];
  for (const n of wf.nodes || []) {
    for (const alan of IZLENEN_ALANLAR[n.type] || []) {
      const deger = n.parameters && n.parameters[alan];
      if (typeof deger === 'string') sonuc.push({ node: n.name, alan, deger });
    }
  }
  return sonuc;
}

/**
 * Repo ile canlıyı izlenen alanlarda karşılaştırır.
 * durum: 'ayni' | 'farkli' | 'canlida-yok' (node ya da alan canlıda bulunamadı → yapısal fark)
 */
function karsilastir(repoWf, canliWf) {
  const canli = new Map(izlenenDegerler(canliWf).map(x => [x.node + '\u0000' + x.alan, x.deger]));
  return izlenenDegerler(repoWf).map(({ node, alan, deger }) => {
    const anahtar = node + '\u0000' + alan;
    if (!canli.has(anahtar)) return { node, alan, durum: 'canlida-yok' };
    return { node, alan, durum: canli.get(anahtar) === deger ? 'ayni' : 'farkli', repo: deger, canli: canli.get(anahtar) };
  });
}

/**
 * Canlı workflow'un kopyasına repodaki izlenen alanları yazar; başka HİÇBİR şeye dokunmaz.
 * Yapısal fark varsa fırlatır — yarım yama canlıyı tutarsız bırakır.
 */
function yamala(canliWf, repoWf) {
  const farklar = karsilastir(repoWf, canliWf);
  const eksik = farklar.filter(f => f.durum === 'canlida-yok');
  if (eksik.length) {
    throw new Error('Yapısal fark, elle taşınmalı: ' + eksik.map(f => `${f.node}.${f.alan}`).join(', '));
  }
  const yeni = JSON.parse(JSON.stringify(canliWf));
  const degisen = farklar.filter(f => f.durum === 'farkli');
  for (const f of degisen) {
    yeni.nodes.find(n => n.name === f.node).parameters[f.alan] = f.repo;
  }
  return { workflow: yeni, degisen: degisen.map(f => `${f.node}.${f.alan}`) };
}

/** PUT /api/v1/workflows/{id} gövdesi: yalnız API'nin kabul ettiği alanlar. */
function putGovdesi(wf) {
  const settings = {};
  for (const k of PUT_SETTINGS) if (wf.settings && k in wf.settings) settings[k] = wf.settings[k];
  return { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
}

module.exports = { IZLENEN_ALANLAR, izlenenDegerler, karsilastir, yamala, putGovdesi };
