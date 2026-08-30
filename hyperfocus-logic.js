/* ══════════════════════════════════════════════════════════════
   FocusAid — Hiperfokus alarmı saf mantık katmanı
   DOM YOK, ağ YOK, `Date.now()` YOK. Zaman daima dışarıdan verilir;
   testler saati böylece taklit edebiliyor.
   Testler: node --test   (kök dizinden, ARGÜMANSIZ)

   Tasarım kararları ve gerekçeleri:
   docs/superpowers/specs/2026-08-30-hiperfokus-alarmi-design.md
   ══════════════════════════════════════════════════════════════ */

/**
 * Kesintiyi "mola" saymak için gereken boşluk. Uygulama açıkken tik 30
 * saniyede bir atılır; bu eşiği aşan bir boşluk ancak sekme kapandıysa,
 * makine uyuduysa veya laptop kapandıysa oluşur.
 *
 * ⚠️ Sekmenin GİZLENMESİ mola sayılmaz — hiperfokusun tipik hali sekmeyi
 * gizleyip başka pencerede saatlerce kalmaktır. Gizli sekmede de tik atmaya
 * devam edilir (bkz. hyperfocus-view.js).
 */
// ⚠️ Ad `HYPERFOCUS_` onekli: `tasks-logic.js` de ust duzeyde
// `DEFAULT_BREAK_MINUTES` tanimliyor. Bu dosyalar index.html'e KLASIK script
// olarak yukleniyor, hepsi ayni global sozlugu paylasiyor; ayni `const` iki kez
// tanimlaninca ikinci dosya komple SyntaxError'la dusuyor ve SESSIZCE hicbir
// fonksiyonu tanimlanmiyor. Bir kez basimiza geldi (2026-08-30), testler
// gecerken tarayicida alarm hic calismiyordu.
const HYPERFOCUS_BREAK_MINUTES = 10;

/** Profildeki 'none' | '60' | '90' | '120' değerini dakikaya çevirir. 0 = kapalı. */
function parseHyperfocusLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;   // 'none', '', null, 'abc', -30
  return n;
}

/** Durum nesnesi localStorage'dan geliyor; bozuksa çökmek yerine sıfırlanır. */
function _isValidState(s) {
  return !!s && typeof s === 'object'
    && Number.isFinite(s.startMs) && Number.isFinite(s.lastTickMs);
}

function _newStreak(nowMs) {
  return { startMs: nowMs, lastTickMs: nowMs, lastAlarmMs: null, snoozeUntilMs: null };
}

/**
 * Bir tik. Saf: girdi durumunu DEĞİŞTİRMEZ, yenisini döndürür.
 *
 * @param {Object|null} state  { startMs, lastTickMs, lastAlarmMs, snoozeUntilMs }
 * @param {Object} input       { nowMs, limitMinutes, breakMinutes? }
 * @returns {{ state: Object|null, alarm: {elapsedMinutes, limitMinutes}|null }}
 */
function hyperfocusTick(state, input) {
  const { nowMs } = input;
  const limitMinutes = parseHyperfocusLimit(input.limitMinutes);

  // 1. Alarm kapalı: biriken seri de silinir, açılınca sıfırdan başlasın.
  if (limitMinutes <= 0) return { state: null, alarm: null };

  // 2. Seri yok (ilk tik) veya durum bozuk.
  if (!_isValidState(state)) return { state: _newStreak(nowMs), alarm: null };

  const breakMs = (input.breakMinutes ?? HYPERFOCUS_BREAK_MINUTES) * 60000;
  const gap = nowMs - state.lastTickMs;

  // 3. Mola kanıtı: tikler arasında büyük boşluk (sekme kapandı / makine uyudu).
  // 4. Saat geriye gitti (yaz saati, elle değiştirme): negatif süreyle alarm
  //    üretmek anlamsız, seri baştan başlar.
  if (gap >= breakMs || gap < 0) return { state: _newStreak(nowMs), alarm: null };

  // 5. Seri sürüyor. Alarm zamanı geldi mi?
  const base = state.lastAlarmMs ?? state.startMs;
  const due = state.snoozeUntilMs != null
    ? nowMs >= state.snoozeUntilMs                  // ertelendi: erteleme dolunca
    : nowMs - base >= limitMinutes * 60000;         // normal: son alarmdan beri limit

  const next = {
    startMs: state.startMs,
    lastTickMs: nowMs,
    lastAlarmMs: due ? nowMs : (state.lastAlarmMs ?? null),
    snoozeUntilMs: due ? null : (state.snoozeUntilMs ?? null)
  };

  if (!due) return { state: next, alarm: null };
  return {
    state: next,
    alarm: {
      elapsedMinutes: Math.round((nowMs - state.startMs) / 60000),
      limitMinutes
    }
  };
}

/** "Mola verdim": seri sıfırdan başlar. */
function resetHyperfocus(nowMs) {
  return _newStreak(nowMs);
}

/**
 * "5 dk sonra hatırlat": seri KORUNUR, yalnızca bir sonraki alarm ötelenir.
 * Erteleme dolduğunda alarm çalar ve normal döngü kaldığı yerden sürer.
 */
function snoozeHyperfocus(state, nowMs, snoozeMinutes) {
  if (!_isValidState(state)) return null;
  return { ...state, snoozeUntilMs: nowMs + snoozeMinutes * 60000 };
}

/**
 * Şerit metni. Nötr dil — suçlama, "çok fazla / aşırı / hâlâ" gibi ifadeler
 * yok (RSD koruması; `dayLabel`'daki aynı kural).
 */
function hyperfocusMessage(minutes) {
  const sure = (minutes >= 120 && minutes % 60 === 0)
    ? `${minutes / 60} saat`
    : `${minutes} dakika`;
  return `${sure}dır aralıksız çalışıyorsun. Beş dakika kalk, su iç, gözlerini dinlendir.`;
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HYPERFOCUS_BREAK_MINUTES,
    parseHyperfocusLimit, hyperfocusTick,
    resetHyperfocus, snoozeHyperfocus, hyperfocusMessage
  };
}
