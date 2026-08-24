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
 * initCalendarUnsafe içinde açıkça verilen firstDay:0 ile Pazar-başlangıçlı
 * render ediliyor, hizalı olmalı — bu modül o değerle senkron kalmalı).
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

/**
 * Bir gün bugünden ÖNCE mi? Bugün "geçmiş" SAYILMAZ (bugüne görev eklenebilir).
 *
 * Düz string karşılaştırması bilinçli: 'YYYY-MM-DD' sıfır dolgulu olduğu için
 * sözlük sırası kronolojik sırayla birebir aynı. Date nesnesine çevirmek hem
 * gereksiz hem de bu projede daha önce UTC kaymasına yol açmış bir yol.
 */
function isPastDay(dayISO, todayISO) {
  return dayISO < todayISO;
}

// Bir günde bu kadar (veya daha fazla) görev varsa kullanıcı uyarılır — engellenmez.
// DEHB'de aşırı dolu bir gün planı erteleme/donma tetikleyebiliyor; amaç bloklamak
// değil, "bugünü fazla doldurdun" sinyalini görünür kılmak.
const YOGUN_GUN_ESIGI = 5;

function isBusyDay(gorevSayisi) {
  return (gorevSayisi || 0) >= YOGUN_GUN_ESIGI;
}

// ── HAFTA GÖRÜNÜMÜ KART BİÇİMİ ──
// Bu eşiğin ALTINDAKİ kartlarda FullCalendar'ın kendi 1px'lik üst+alt kenarlığı
// ve dikey padding'i, kartın toplam yüksekliğinin yarısına yakınını yiyor:
// 20dk'lık bir kart 2.8em'lik saat satırında ~15px, kenarlık+padding 4px alınca
// geriye 11px kalıyor ve 10.9px'lik başlık satırı kılpayı taşıp kırpılıyordu.
// Bu süreden kısa kartlarda kenarlık ve dikey padding sıfırlanıyor (bkz. .fc-olay-kisa).
const KISA_OLAY_DK = 30;

/**
 * Kartın içeriği süreye göre değişir: kısa kartlarda saat gizlenir (dikey konum
 * zaten saati gösteriyor), satır sayısı kartın gerçek yüksekliğine göre seçilir.
 * Sabit line-clamp kart yüksekliğine duyarsızdı ve başlığı satır ortasından kesiyordu.
 */
function cardLayout(dakika) {
  const dk = dakika > 0 ? dakika : 0;
  return {
    satir: dk >= 90 ? 3 : dk >= 60 ? 2 : 1,
    saatGoster: dk >= 45,
    // Tek bayrak, iki ayrı yerde kullanılıyor: kartın İÇİNDEKİ yazı küçülüyor
    // (.fc-ozel-kart--mini) ve kartın KENDİSİNDEN kenarlık/padding kalkıyor
    // (.fc-olay-kisa). İkisi de aynı eşiğe bağlı, ayrı alan tutmak gereksiz.
    kisa: dk > 0 && dk < KISA_OLAY_DK
  };
}

/**
 * Görünüme göre takvim yüksekliği. Ay 'auto' (içerik kadar), hafta sabit 700px'lik
 * bir kutuda İÇİNDE kayar — 'auto' ile hafta görünümü sayfayı ~1400px'e şişiriyordu.
 * datesSet bu değeri her gezinmede DEĞİL, yalnızca değiştiğinde uygular.
 */
function heightForView(viewType) {
  return viewType === 'timeGridWeek' ? 700 : 'auto';
}

/**
 * Görev formundaki alanlardan Supabase `tasks` satırı üretir (user_id hariç —
 * onu çağıran ekler, bu katman oturumu bilmez).
 *
 * Saat alanları YEREL kabul edilir; `start_time`/`end_time` UTC ISO olarak
 * yazılır (tasks-logic.js'teki computeSnooze ile aynı biçim), `day` ise yerel
 * takvim günü olarak kalır. Karışık görünüyor ama kasıtlı: `day` bir takvim
 * günü, `start_time` bir zaman anı.
 *
 * Geçersiz girdide null döner — bitiş başlangıçtan SONRA olmalı. Bu kontrol
 * eskiden yoktu: görev yalnızca Google'a yazıldığı için ters saat aralığını
 * Google API'si reddediyordu. Artık satır kendi veritabanımıza gittiğinden
 * reddedecek bir merci yok, kontrol buraya taşındı.
 */
function buildTaskRow(alanlar) {
  const { dayISO, start, end, title, summary } = alanlar || {};
  const ad = (title || '').trim();
  if (!dayISO || !start || !end || !ad) return null;

  const bas = new Date(`${dayISO}T${start}:00`);
  const bit = new Date(`${dayISO}T${end}:00`);
  if (Number.isNaN(bas.getTime()) || Number.isNaN(bit.getTime())) return null;
  if (bit <= bas) return null;

  return {
    name: ad,
    summary: (summary || '').trim() || null,
    day: dayISO,
    start_time: bas.toISOString(),
    end_time: bit.toISOString(),
    // Elle eklenen görevde bilişsel yük sorulmuyor; takvim kartının rengi
    // belirsiz kalmasın diye orta kabul ediliyor (YUK_RENK'in varsayılanı da bu).
    cognitive_load: 'medium',
    completed: false
  };
}

// Node testleri için dışa aktarım; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AY_ADLARI, buildMonthGrid, monthLabel, shiftMonth, weekRangeISO,
                     isPastDay, isBusyDay, YOGUN_GUN_ESIGI,
                     cardLayout, heightForView, KISA_OLAY_DK, buildTaskRow };
}
