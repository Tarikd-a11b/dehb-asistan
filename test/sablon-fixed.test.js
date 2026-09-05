/**
 * Şablonların İÇİNDE `position: fixed` öğe bulunmamalı.
 *
 * NEDEN: `index.html`deki her sayfa şablonunun kökü `animate-slide-in` taşıyor
 * ve `reveal` kareleri 16px'lik bir TRANSFORM uyguluyor. CSS'te transformlu bir
 * öğe, içindeki `position:fixed` çocuklar için yeni bir kapsayıcı blok yaratır:
 * o çocuk artık viewport'a değil transformlu ataya göre konumlanır. Yani şablon
 * içine konan tam ekran bir katman (modal, perde, toast) animasyon sürdüğü
 * ~0.6 sn boyunca kayar ve yanlış yerde belirir.
 *
 * Bu yüzden #confirm-modal ve #day-modal body seviyesinde duruyor. Kural
 * yorumla korunuyordu; yorum okunmayabilir, bu test okunmak zorunda değil.
 *
 * Tarayıcı gerektirmiyor: kural metinsel, ölçüm değil. `test-ui/` altındaki
 * yerleşim testlerinden farkı bu — burası `node --test` ile milisaniyede koşar.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/** index.html'deki tüm <template> gövdelerini (id'siyle birlikte) döndürür. */
function sablonlar() {
  const bulunan = [];
  const kalip = /<template id="([\w-]+)"[^>]*>([\s\S]*?)<\/template>/g;
  let e;
  while ((e = kalip.exec(HTML)) !== null) bulunan.push({ id: e[1], govde: e[2] });
  return bulunan;
}

/** Bir class değeri Tailwind'in `fixed` yardımcısını (veya `md:fixed` gibi bir
 *  varyantını) içeriyor mu? "fixed" kelimesinin başka bir sözcüğün parçası
 *  olduğu durumları (örn. "prefixed") eleyebilmek için token bazlı bakıyoruz. */
function fixedIceriyorMu(sinifDegeri) {
  return sinifDegeri.split(/\s+/).some(t => t === 'fixed' || /(^|:)fixed$/.test(t));
}

test('şablonların içinde Tailwind `fixed` sınıfı taşıyan öğe yok', () => {
  const suclular = [];
  for (const { id, govde } of sablonlar()) {
    const kalip = /class="([^"]*)"/g;
    let e;
    while ((e = kalip.exec(govde)) !== null) {
      if (fixedIceriyorMu(e[1])) {
        // Öğeyi tanıyabilmek için class'ın geçtiği yerin biraz öncesini al.
        const bas = Math.max(0, e.index - 60);
        suclular.push(`${id}: …${govde.slice(bas, e.index + 40).replace(/\s+/g, ' ')}`);
      }
    }
  }
  assert.deepStrictEqual(suclular, [],
    'Şablon içinde fixed öğe var — animate-slide-in transformu onu kaydırır. ' +
    'Body seviyesine taşı (#confirm-modal / #day-modal gibi):\n  ' + suclular.join('\n  '));
});

test('şablonların içinde inline `position:fixed` yok', () => {
  const suclular = [];
  for (const { id, govde } of sablonlar()) {
    const kalip = /style="([^"]*)"/g;
    let e;
    while ((e = kalip.exec(govde)) !== null) {
      if (/position\s*:\s*fixed/i.test(e[1])) suclular.push(`${id}: ${e[1].slice(0, 80)}`);
    }
  }
  assert.deepStrictEqual(suclular, [], 'Şablon içinde inline position:fixed var:\n  ' + suclular.join('\n  '));
});

test('body seviyesindeki modaller şablonların dışında duruyor', () => {
  // Regresyon nöbetçisi: biri #day-modal'ı yanlışlıkla tpl-calendar'ın içine
  // geri taşırsa bu düşer. Şablon gövdelerinin toplamında aranıyor.
  const govdeler = sablonlar().map(s => s.govde).join('\n');
  for (const kimlik of ['day-modal', 'confirm-modal']) {
    assert.ok(!govdeler.includes(`id="${kimlik}"`),
      `#${kimlik} bir şablonun içine taşınmış; body seviyesinde kalmalı`);
    assert.ok(HTML.includes(`id="${kimlik}"`), `#${kimlik} index.html'de bulunamadı`);
  }
});
