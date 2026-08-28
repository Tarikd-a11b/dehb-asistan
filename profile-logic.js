/* ══════════════════════════════════════════════════════════════
   FocusAid — Nöro-Profil saf mantık katmanı
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   Testler: node --test   (kök dizinden, ARGÜMANSIZ)

   Bu dosya profil verisinin TEK doğruluk kaynağıdır: varsayılanlar, Supabase
   satırı ↔ profil nesnesi dönüşümü, birleştirme ve n8n'e giden planlama
   özeti. index.html yalnızca DOM'u okur/yazar, dönüşümü buraya bırakır.
   ══════════════════════════════════════════════════════════════ */

const DEFAULT_PROFILE = {
  focusPeriod: 25, workHours: { start: '09:00', end: '18:00' },
  social: 'solo', energyPeak: 'morning', focusTrigger: 'silence',
  motivationNote: '', mainObstacle: 'paralysis', breakStyle: 'pomodoro',
  todayMood: '', todayMoodDate: '', hyperfocusLimit: 'none',
  lightSensitivity: 2,
  superpowers: []
};

/**
 * Kullanıcının işaretleyebileceği güçlü yanlar. `superpowers` JSONB kolonunda
 * yalnızca id'ler saklanır; etiket/emoji burada durur, böylece metin
 * değiştiğinde kayıtlı veriye dokunmak gerekmez.
 */
const SUPERPOWERS = [
  { id: 'hyperfocus',  emoji: '🎯', label: 'Hiperfokus' },
  { id: 'creativity',  emoji: '🎨', label: 'Yaratıcılık' },
  { id: 'crisis',      emoji: '🚨', label: 'Kriz Anında Sakinlik' },
  { id: 'empathy',     emoji: '💚', label: 'Yüksek Empati' },
  { id: 'problem',     emoji: '🧩', label: 'Problem Çözme' },
  { id: 'energy',      emoji: '⚡', label: 'Yüksek Enerji' },
  { id: 'humor',       emoji: '😄', label: 'Mizah' },
  { id: 'curiosity',   emoji: '🔭', label: 'Merak & Öğrenme' },
  { id: 'spontaneity', emoji: '🎲', label: 'Doğaçlama' },
  { id: 'resilience',  emoji: '🪨', label: 'Toparlanma Gücü' }
];

const SUPERPOWER_IDS = SUPERPOWERS.map(s => s.id);

/**
 * 1-5 arası tam sayıya kırp; çöp değer gelirse varsayılana düş.
 * ⚠️ null/'' önce elenir: `Number(null)` 0 verir ve kırpma onu 1'e çeker —
 * yani DB'de NULL duran bir kolon "en düşük hassasiyet" gibi okunurdu.
 * Değeri OLMAYAN ile 1 SEÇMİŞ olan aynı şey değil.
 */
function clampLevel(v, fallback = 2) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}

/**
 * `superpowers` kolonu JSONB. Postgres dizi döndürür ama eski satırlarda
 * metin olarak da gelebiliyor; ikisini de kabul et, tanınmayan id'leri at —
 * arayüz karşılığı olmayan bir id'yi zaten çizemez.
 */
function normalizeSuperpowers(raw) {
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch (e) { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter(id => SUPERPOWER_IDS.includes(id));
}

/** Supabase `profiles` satırı → uygulama içi profil nesnesi. */
function rowToProfile(row) {
  const r = row || {};
  return {
    focusPeriod:      r.focus_period     ?? DEFAULT_PROFILE.focusPeriod,
    workHours:        { start: r.work_start ?? DEFAULT_PROFILE.workHours.start,
                        end:   r.work_end   ?? DEFAULT_PROFILE.workHours.end },
    social:           r.social           ?? DEFAULT_PROFILE.social,
    energyPeak:       r.energy_peak      ?? DEFAULT_PROFILE.energyPeak,
    focusTrigger:     r.focus_trigger    ?? DEFAULT_PROFILE.focusTrigger,
    motivationNote:   r.motivation_note  ?? DEFAULT_PROFILE.motivationNote,
    mainObstacle:     r.main_obstacle    ?? DEFAULT_PROFILE.mainObstacle,
    breakStyle:       r.break_style      ?? DEFAULT_PROFILE.breakStyle,
    todayMood:        r.today_mood       ?? DEFAULT_PROFILE.todayMood,
    todayMoodDate:    r.today_mood_date  ?? DEFAULT_PROFILE.todayMoodDate,
    hyperfocusLimit:  r.hyperfocus_limit ?? DEFAULT_PROFILE.hyperfocusLimit,
    lightSensitivity: clampLevel(r.light_sensitivity, DEFAULT_PROFILE.lightSensitivity),
    superpowers:      normalizeSuperpowers(r.superpowers)
  };
}

/**
 * Profil nesnesi → Supabase upsert gövdesi.
 * ⚠️ `undefined` alan bırakma: JSON.stringify onu düşürür, upsert o kolonu
 * hiç göndermez ve eski değer sessizce yerinde kalır. Eksikler varsayılana
 * çekiliyor, böylece gönderilen gövde her zaman tam.
 */
function profileToRow(profile, identity) {
  const p = { ...DEFAULT_PROFILE, ...(profile || {}) };
  const id = identity || {};
  return {
    id:                id.id,
    email:             id.email,
    focus_period:      p.focusPeriod,
    work_start:        p.workHours?.start ?? DEFAULT_PROFILE.workHours.start,
    work_end:          p.workHours?.end   ?? DEFAULT_PROFILE.workHours.end,
    energy_peak:       p.energyPeak,
    social:            p.social,
    focus_trigger:     p.focusTrigger,
    motivation_note:   p.motivationNote,
    main_obstacle:     p.mainObstacle,
    break_style:       p.breakStyle,
    today_mood:        p.todayMood,
    today_mood_date:   p.todayMoodDate || null,
    hyperfocus_limit:  p.hyperfocusLimit,
    light_sensitivity: clampLevel(p.lightSensitivity, DEFAULT_PROFILE.lightSensitivity),
    superpowers:       normalizeSuperpowers(p.superpowers)
  };
}

/**
 * Mevcut profilin üzerine yama uygular ve ALANI ASLA DÜŞÜRMEZ.
 *
 * Buranın var oluş sebebi gerçek bir veri kaybı hatasıydı: saveProfile()
 * `userProfile`'ı formdaki alanlardan sıfırdan kuruyordu, dolayısıyla formda
 * karşılığı olmayan her alan (o dönem lightSensitivity) kaydet'e her basışta
 * siliniyordu. Artık form yalnızca yama üretir, birleştirme burada olur.
 *
 * `undefined` yamalar yok sayılır (form alanı yoksa eski değer korunur),
 * `workHours` toptan değil parça parça birleşir.
 */
function mergeProfile(current, patch) {
  const base = { ...DEFAULT_PROFILE, ...(current || {}) };
  const out = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === undefined) continue;
    if (k === 'workHours') {
      // Alt anahtarlar tek tek elenir. Duz spread yapilsaydi
      // {start: undefined} acikca yazilir, asagidaki ?? onu varsayilana
      // cekerdi — yani formda saat alani yoksa kullanicinin mesaisi
      // sessizce 09:00-18:00'e donerdi. Duzeltilen hatanin ayni cinsi.
      const wh = { ...base.workHours };
      for (const [wk, wv] of Object.entries(v || {})) {
        if (wv !== undefined) wh[wk] = wv;
      }
      out.workHours = wh;
    } else {
      out[k] = v;
    }
  }
  out.workHours = { start: out.workHours?.start ?? DEFAULT_PROFILE.workHours.start,
                    end:   out.workHours?.end   ?? DEFAULT_PROFILE.workHours.end };
  return out;
}

/** Bir süper gücü listede varsa çıkarır, yoksa ekler. Girdiyi değiştirmez. */
function toggleSuperpower(list, id) {
  const cur = normalizeSuperpowers(list);
  if (!SUPERPOWER_IDS.includes(id)) return cur;
  return cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
}

/**
 * n8n'e gönderilen planlama özeti.
 *
 * Eskiden yalnızca 6 alan gidiyordu; profilde toplanan focusTrigger, social,
 * hyperfocusLimit, todayMood, motivationNote ve duyusal/regülasyon alanları
 * kullanıcıya sorulup hiçbir yere ulaşmıyordu. Hepsi tek yerden üretilsin diye
 * bu fonksiyon var — Parçalayıcı ve sohbet akışı aynı gövdeyi kullanır.
 *
 * Boş profil gelse bile her alan dolu döner: n8n tarafındaki ifadeler
 * `undefined` görmesin.
 */
function planningProfile(profile) {
  const p = { ...DEFAULT_PROFILE, ...(profile || {}) };
  return {
    focusPeriod:      Number(p.focusPeriod) || DEFAULT_PROFILE.focusPeriod,
    breakStyle:       p.breakStyle,
    energyPeak:       p.energyPeak,
    workHours:        { start: p.workHours?.start ?? DEFAULT_PROFILE.workHours.start,
                        end:   p.workHours?.end   ?? DEFAULT_PROFILE.workHours.end },
    mainObstacle:     p.mainObstacle,
    // ── Aşağıdakiler 2026-08-28'de eklendi: profilde zaten toplanıyorlardı
    //    ama planlamaya hiç ulaşmıyorlardı.
    hyperfocusLimit:  p.hyperfocusLimit,
    todayMood:        p.todayMood,
    focusTrigger:     p.focusTrigger,
    social:           p.social,
    motivationNote:   p.motivationNote,
    lightSensitivity: clampLevel(p.lightSensitivity, DEFAULT_PROFILE.lightSensitivity),
    superpowers:      normalizeSuperpowers(p.superpowers)
  };
}

/**
 * Işık hassasiyeti ↔ tema köprüsü. 3 ve üstü koyu tema demek; sidebar'daki
 * anahtar da profildeki kaydırıcı da aynı eşiği kullanır ki ikisi birbirini
 * yalanlamasın.
 */
const KOYU_TEMA_ESIGI = 3;
function themeIsDark(lightSensitivity) { return clampLevel(lightSensitivity) >= KOYU_TEMA_ESIGI; }
function lightSensitivityForTheme(dark) { return dark ? 4 : 1; }

/**
 * Bugüne ait olmayan modu boş sayar.
 *
 * "Bugün nasıl hissediyorsun" sorusunun cevabı yalnızca o gün geçerlidir;
 * eskiden tarih damgası yoktu ve pazartesi seçilen mod haftalarca planı
 * küçültüyordu. Tarih karşılaştırması 'YYYY-MM-DD' dizeleri üzerinden yapılır;
 * hangi günün "bugün" olduğuna ÇAĞIRAN karar verir — bu dosya saat dilimi bilmez.
 *
 * ⚠️ Tarihi olmayan mod BAYAT sayılır. `today_mood_date` kolonu eklenmeden
 * önce kaydedilmiş satırların hepsi tarihsizdir; onları "bugünkü" saymak
 * düzeltmeye çalıştığımız hatayı sürdürürdü.
 */
function moodForToday(todayMood, todayMoodDate, bugun) {
  if (!todayMood || !todayMoodDate || !bugun) return '';
  return todayMoodDate === bugun ? todayMood : '';
}

/**
 * Profilin ne kadarının doldurulduğu (0-100). "Şunu da doldur" diye
 * dırdır etmeden ilerlemeyi görünür kılar. Yalnızca kullanıcının bilinçli
 * seçim yapması gereken alanlar sayılır: varsayılandan farklıysa dolmuş sayılır.
 */
function profileCompleteness(profile) {
  const p = { ...DEFAULT_PROFILE, ...(profile || {}) };
  const checks = [
    Number(p.focusPeriod) !== DEFAULT_PROFILE.focusPeriod,
    p.hyperfocusLimit !== DEFAULT_PROFILE.hyperfocusLimit,
    p.workHours?.start !== DEFAULT_PROFILE.workHours.start || p.workHours?.end !== DEFAULT_PROFILE.workHours.end,
    p.energyPeak !== DEFAULT_PROFILE.energyPeak,
    p.social !== DEFAULT_PROFILE.social,
    p.focusTrigger !== DEFAULT_PROFILE.focusTrigger,
    p.breakStyle !== DEFAULT_PROFILE.breakStyle,
    String(p.motivationNote || '').trim() !== '',
    p.mainObstacle !== DEFAULT_PROFILE.mainObstacle,
    normalizeSuperpowers(p.superpowers).length > 0
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_PROFILE, SUPERPOWERS, SUPERPOWER_IDS, KOYU_TEMA_ESIGI,
                     clampLevel, normalizeSuperpowers, rowToProfile, profileToRow,
                     mergeProfile, toggleSuperpower, planningProfile,
                     themeIsDark, lightSensitivityForTheme, moodForToday, profileCompleteness };
}
