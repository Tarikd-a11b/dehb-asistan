/* ══════════════════════════════════════════════════════════════
   FocusAid — Görev sıralama saf mantık katmanı
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   Testler: node --test   (kök dizinden, ARGÜMANSIZ)

   ⚠️ Bu dosyadaki fonksiyonların gövdesi n8n'deki `FocusAid Weekly
   Processor` → `Code in JavaScript` node'una BİREBİR kopyalanır. n8n Code
   node'u yerel dosya `require` edemez. Burayı değiştirirsen node'u da
   güncelle, yoksa repo ile canlı ayrışır.
   ══════════════════════════════════════════════════════════════ */

/**
 * Görev indeksini hedef güne çevirir: görevler mevcut günlere orantılı
 * dağıtılır (ilk görev ilk güne, son görev son güne).
 * ⚠️ `taskCount === 1` iken eski satır `0/0 = NaN` üretiyordu ve
 * `sessions[NaN]` çökmeye yol açıyordu; tek görev her zaman ilk güne gider.
 */
function targetDayIndex(i, taskCount, dayCount) {
  if (dayCount <= 1 || taskCount <= 1) return 0;
  return Math.round(i * (dayCount - 1) / (taskCount - 1));
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { targetDayIndex };
}
