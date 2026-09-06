const test = require('node:test');
const assert = require('node:assert/strict');

// Sahte DOM. `dataset` ve `querySelector` sart: getCompanionWidget widget'i
// bir kez baglamak icin dataset bayragi kullaniyor ve ic ogeleri artik
// document uzerinden degil WIDGET uzerinden ariyor (PiP'e tasinabilsin diye).
function sahteOge() {
  return {
    id: '', className: '', innerHTML: '', hidden: false, textContent: '',
    dataset: {}, style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    querySelector() { return null; },
    addEventListener() {},
    appendChild() {}
  };
}
global.document = {
  getElementById() { return null; },
  createElement() { return sahteOge(); },
  body: { appendChild() {} }
};

const { BodyDoublingState, SHERLOCK_WORKING_QUOTES, toggleBodyDoublingVisibility } = require('../body-doubling.js');

test('SHERLOCK_WORKING_QUOTES contains supportive detective case quotes', () => {
  assert.ok(SHERLOCK_WORKING_QUOTES.length >= 3);
  for (const q of SHERLOCK_WORKING_QUOTES) {
    assert.ok(typeof q === 'string' && q.length > 5);
  }
});

test('toggleBodyDoublingVisibility toggles enabled state', () => {
  toggleBodyDoublingVisibility(false);
  assert.equal(BodyDoublingState.isEnabled, false);
  toggleBodyDoublingVisibility(true);
  assert.equal(BodyDoublingState.isEnabled, true);
});

/* ── Sherlock'un ayrı pencerede yanına gelmesi (Document PiP) ───────── */

const { sherlockAyriPencereDestekli, bdSureMetni } = require('../body-doubling.js');

test('bdSureMetni saniyeyi MM:SS olarak yazar', () => {
  assert.equal(bdSureMetni(0), '00:00');
  assert.equal(bdSureMetni(59), '00:59');
  assert.equal(bdSureMetni(60), '01:00');
  assert.equal(bdSureMetni(1500), '25:00');
  assert.equal(bdSureMetni(1263), '21:03');
});

test('bdSureMetni negatif ve tanimsiz degeri 00:00a cekiyor', () => {
  // Sayac bittiginde remainingSeconds bir tik eksiye dusebiliyor; kullaniciya
  // "-1:59" gostermek yerine sifirda durmali.
  assert.equal(bdSureMetni(-5), '00:00');
  assert.equal(bdSureMetni(undefined), '00:00');
  assert.equal(bdSureMetni(null), '00:00');
});

test('ayri pencere destegi window olmayan ortamda false', () => {
  // Node'da window yok: ozellik algilamasi patlamadan false donmeli, cunku
  // ayni dosya hem tarayicida hem test kosucusunda yukleniyor.
  assert.equal(sherlockAyriPencereDestekli(), false);
});

test('BodyDoublingState ayri pencere alanlarini tasiyor', () => {
  // widget referansi sart: PiP belgesine tasinan widget'i document.getElementById
  // ile bulmak mumkun degil, bulunamayinca IKINCI bir widget uretilirdi.
  assert.ok('widget' in BodyDoublingState);
  assert.ok('pipPenceresi' in BodyDoublingState);
  assert.ok('sureTimer' in BodyDoublingState);
});

test('otomatik ayri pencere tercihi varsayilan olarak KAPALI', () => {
  // Davetsiz pencere acmak saldirgan; kullanici ⧉ ile bir kez actiginda tercih
  // aciliyor. localStorage'a erisilemeyen ortamda da patlamamali.
  const { sherlockOtomatikPipAcikMi } = require('../body-doubling.js');
  assert.equal(sherlockOtomatikPipAcikMi(), false);
});
