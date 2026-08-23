/* ══════════════════════════════════════════════════════════════
   FocusAid — Takvim saf mantık katmanı
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   Testler: node --test   (kök dizinden, ARGÜMANSIZ)
   ══════════════════════════════════════════════════════════════ */

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                   'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/**
 * Date → 'YYYY-MM-DD' (yerel saat).
 * tasks-logic.js'teki localDayISO ile aynı işi yapar; bu modülün tek başına
 * require edilebilmesi için burada tekrar tanımlı. Dört satırlık kopya,
 * dosyalar arası global bağımlılıktan iyi.
 * toISOString() KULLANILMAZ: UTC verir, UTC+3'te günü bir geri kaydırır.
 */
function _iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Bir ayın 6x7'lik takvim ızgarası. Hafta PAZAR başlar (büyük takvim
 * locale:'tr' ile Pazar-başlangıçlı render ediliyor, hizalı olmalı).
 * Baştaki ve sondaki taşma günleri inMonth:false ile işaretlenir.
 * Ay uzunluğu ve artık yıl Date yapıcısının kendi taşma davranışına bırakılmış.
 */
function buildMonthGrid(year, month) {
  const kayma = new Date(year, month, 1).getDay();   // 0 = Pazar
  const hucreler = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - kayma + i);
    hucreler.push({ iso: _iso(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return hucreler;
}

function monthLabel(year, month) {
  return `${AY_ADLARI[month]} ${year}`;
}

function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** dateISO'yu içeren haftanın (Pazar–Cumartesi) sınırları. */
function weekRangeISO(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const gun = new Date(y, m - 1, d);
  const bas = new Date(y, m - 1, d - gun.getDay());
  const son = new Date(bas.getFullYear(), bas.getMonth(), bas.getDate() + 6);
  return { start: _iso(bas), end: _iso(son) };
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AY_ADLARI, buildMonthGrid, monthLabel, shiftMonth, weekRangeISO };
}
