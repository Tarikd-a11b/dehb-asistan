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

/** Bilişsel yük sırası: küçük sayı = önce yapılsın. */
const LOAD_RANK = { high: 0, medium: 1, low: 2 };

/**
 * Görevin yük sırasını verir. Alan eksikse veya tanınmayan bir değerse
 * `medium` sayılır — yerleştiricinin varsayılanıyla aynı.
 */
function loadRank(task) {
  const raw = task && (task.cognitiveLoad || task.cognitive_load);
  const r = LOAD_RANK[raw];
  return r === undefined ? LOAD_RANK.medium : r;
}

/**
 * Görevleri, gün içinde bilişsel yüke göre sıralanmış İŞLENME SIRASINA
 * çevirir. Yerleştirici "önce işlenen, o günün en erken boş saatini alır"
 * mantığıyla çalıştığı için bu, zor görevi günün ilk seansına oturtur.
 *
 * Günler arası sıra KORUNUR: bir görev asla başka bir güne taşınmaz, yalnızca
 * kendi günündeki arkadaşlarıyla yer değiştirir. Eşit yükte orijinal indeks
 * sırası korunur (`a - b` eşitlik bozucusu), böylece aynı zorluktaki işler
 * yapay zekânın verdiği bağımlılık sırasını kaybetmez.
 */
function orderTasksByLoad(tasks, dayCount) {
  const list = Array.isArray(tasks) ? tasks : [];
  const T = list.length;

  const groups = new Map();
  for (let i = 0; i < T; i++) {
    const targetIdx = targetDayIndex(i, T, dayCount);
    if (!groups.has(targetIdx)) groups.set(targetIdx, []);
    groups.get(targetIdx).push(i);
  }

  const out = [];
  for (const targetIdx of [...groups.keys()].sort((a, b) => a - b)) {
    const idxs = groups.get(targetIdx);
    idxs.sort((a, b) => {
      const d = loadRank(list[a]) - loadRank(list[b]);
      return d !== 0 ? d : a - b;
    });
    for (const index of idxs) out.push({ index, targetIdx });
  }
  return out;
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LOAD_RANK, targetDayIndex, loadRank, orderTasksByLoad };
}
