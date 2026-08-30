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

/**
 * Gün başına görev tavanları.
 *
 * Eski davranış tek bir sayıydı: `maxPerDay = ceil(T / A)`. Mod (`todayMood`)
 * buraya HİÇ ulaşmıyordu; yalnızca AI'ya verilen `maxTasks` aralığını
 * oynatıyordu, AI de aralığı umursamadığı için mod pratikte görev sayısına
 * etki etmiyordu (ölçüm: 2026-08-29, anxious ve hyper aynı 9 görevi üretti).
 *
 * İki bilinçli karar:
 *
 * 1. **Mod görev SİLMEZ.** Tavanı sertleştirip fazlasını atmak projeyi yarım
 *    planlar; teslim tarihi sessizce kaçar. Taşan görev sonraki günlere yayılır,
 *    toplam görev sayısı korunur (`kapasite >= T` testle garanti).
 * 2. **Mod yalnızca BUGÜNÜ değiştirir.** `todayMood` günlük bir alan
 *    (`today_mood_date` bayatlarsa düşüyor); bugünkü kaygıyı 5. günün
 *    kapasitesine uygulamak alanın anlamına aykırı.
 *
 * Yayacak gün yoksa (`A < 2`) veya bugüne ait seans yoksa (akşam geç saatte
 * parçalanan proje) mod uygulanmaz — yayılacak yer olmadan tek seçenek görev
 * düşürmek olurdu, o da (1)'e aykırı.
 *
 * @param {number} taskCount  toplam görev
 * @param {number} dayCount   kullanılabilir seans günü
 * @param {number} moodDelta  -1 (foggy/crash/anxious), 0, +1 (hyper/focused)
 * @param {boolean} hasToday  sessions[0] bugüne mi ait
 */
function dailyCaps(taskCount, dayCount, moodDelta, hasToday) {
  const T = Math.max(0, Math.trunc(taskCount) || 0);
  const A = Math.max(1, Math.trunc(dayCount) || 1);
  const base = Math.max(1, Math.ceil(T / A));               // eski maxPerDay
  const bugunVar = hasToday === undefined ? true : !!hasToday;
  if (!moodDelta || A < 2 || !bugunVar) return { todayCap: base, restCap: base };

  // ⚠️ Tavan `base`'e (= ceil(T/A)) göre kaydırılmaz: `base` bir TAVAN, günün
  // gerçekte aldığı sayı değil. 9 görev / 4 gün planında bugüne doğal olarak 2
  // görev düşerken tavan 3'tür; 3-1=2 hiçbir şeyi değiştirmez. Ölçüldü: ilk
  // denemede `anxious` ile mod-yok planı BİREBİR aynı çıktı.
  let naturalToday = 0;
  for (let i = 0; i < T; i++) if (targetDayIndex(i, T, A) === 0) naturalToday++;

  // ⚠️ ASİMETRİ, BİLİNÇLİ: `moodDelta > 0` bugüne görev EKLEMEZ, yalnızca tavanı
  // yükseltir. Yerleştirme orantılı olduğu için tavanı büyütmek görev ÇEKMEZ;
  // çekmesi `targetDayIndex`'i oynatmayı gerektirirdi (2026-08-28 spec'inde gün
  // dağıtımı bilerek dondurulmuş). Ayrıca istenir bir şey de değil: iyi bir güne
  // fazladan iş yığmak, aynı uygulamanın hiperfokus alarmıyla korumaya çalıştığı
  // çöküşün ta kendisi. İyi modun etkisi AI prompt'unda kalır (daha iddialı,
  // daha derin görevler) — orası işin BÜYÜKLÜĞÜNÜ değiştirir, günün sayısını değil.
  const todayCap = Math.max(1, naturalToday + moodDelta);
  // ⚠️ `base` tabanı şart: bugün kapasitesini kullanmayabilir (yerleştirme
  // orantılı, açgözlü değil) ve kalan günleri eskisinden dar bırakırsak görevler
  // taşma dalına düşüp `session.start`'a ZORLANIR — üst üste binen saatler.
  // Ölçüldü: ilk denemede `hyper` çakışan etkinlik üretti.
  const restCap = Math.max(base, Math.ceil((T - todayCap) / (A - 1)));
  return { todayCap, restCap };
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LOAD_RANK, targetDayIndex, loadRank, orderTasksByLoad, dailyCaps };
}
