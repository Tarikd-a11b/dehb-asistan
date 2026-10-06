/* ══════════════════════════════════════════════════════════════
   FocusAid — 📁 Projelerim: içeriğe göre proje ikonu (saf mantık)

   Eskiden her kart sırasına göre dönen bir ikon alıyordu (🚀, 🎯, 📚…):
   ikon projeyle ilgisizdi. Artık başlığa (yoksa görev adlarına) bakılıyor:
   bilinen bir teknoloji geçiyorsa onun LOGOSU, bilinen bir iş türü geçiyorsa
   uygun EMOJİ; hiçbiri yoksa null → arayüz eski dönen temaya düşer.

   Logolar devicon'dan (MIT), sürüm sabitli jsDelivr adresiyle. Yalnızca
   CDN'de varlığı tek tek doğrulanmış adlar listede (2026-10-06, HTTP 200).
   Excel / Power BI / Tableau devicon'da YOK — onlar emoji ile karşılanıyor.

   Eşleştirme kuralları:
   - Metin Türkçe kurallarıyla küçültülür ('SQL' → 'sql', 'İ' → 'i').
   - Desenler kelime BAŞINDAN eşleşir ama sonu açıktır: "SQL'de", "Python'la",
     "sunumu" da yakalansın diye. Türkçede ek kelimenin sonuna gelir.
   - Kısa/çok anlamlı adlar (git → "gitmek", r, c, go) ya tam kelime
     istenerek ya da hiç eklenmeyerek dışarıda bırakıldı.
   - Sıra önemli: özel olan genelden önce (javascript > java, mysql > sql).
   ══════════════════════════════════════════════════════════════ */

const DEVICON_TABAN = 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/';

// [desen, devicon adı, varyant, görünen ad]
const PROJE_LOGOLARI = [
  [/(^|[^a-z0-9])(postgres|postgresql|neon db)/, 'postgresql', 'original', 'PostgreSQL'],
  [/(^|[^a-z0-9])mysql/, 'mysql', 'original', 'MySQL'],
  [/(^|[^a-z0-9])sqlite/, 'sqlite', 'original', 'SQLite'],
  [/(^|[^a-z0-9])(mongo|mongodb)/, 'mongodb', 'original', 'MongoDB'],
  [/(^|[^a-z0-9])(sql|veritaban|database|sorgu)/, 'azuresqldatabase', 'original', 'SQL'],
  [/(^|[^a-z0-9])(typescript|ts\b)/, 'typescript', 'original', 'TypeScript'],
  [/(^|[^a-z0-9])(javascript|js\b)/, 'javascript', 'original', 'JavaScript'],
  [/(^|[^a-z0-9])(node\.?js|nodejs)/, 'nodejs', 'original', 'Node.js'],
  [/(^|[^a-z0-9])(next\.?js)/, 'nextjs', 'original', 'Next.js'],
  [/(^|[^a-z0-9])react/, 'react', 'original', 'React'],
  [/(^|[^a-z0-9])(vue)/, 'vuejs', 'original', 'Vue'],
  [/(^|[^a-z0-9])angular/, 'angularjs', 'original', 'Angular'],
  [/(^|[^a-z0-9])tailwind/, 'tailwindcss', 'original', 'Tailwind'],
  [/(^|[^a-z0-9])html/, 'html5', 'original', 'HTML'],
  [/(^|[^a-z0-9])css/, 'css3', 'original', 'CSS'],
  [/(^|[^a-z0-9])django/, 'django', 'plain', 'Django'],
  [/(^|[^a-z0-9])flask/, 'flask', 'original', 'Flask'],
  [/(^|[^a-z0-9])pandas/, 'pandas', 'original', 'pandas'],
  [/(^|[^a-z0-9])numpy/, 'numpy', 'original', 'NumPy'],
  [/(^|[^a-z0-9])(tensorflow|keras)/, 'tensorflow', 'original', 'TensorFlow'],
  [/(^|[^a-z0-9])(jupyter|notebook)/, 'jupyter', 'original', 'Jupyter'],
  [/(^|[^a-z0-9])kaggle/, 'kaggle', 'original', 'Kaggle'],
  [/(^|[^a-z0-9])python/, 'python', 'original', 'Python'],
  [/(^|[^a-z0-9])rstudio/, 'rstudio', 'original', 'RStudio'],
  [/(^|[^a-z0-9])matlab/, 'matlab', 'original', 'MATLAB'],
  [/(^|[^a-z0-9])java(?!script)/, 'java', 'original', 'Java'],
  [/(^|[^a-z0-9])kotlin/, 'kotlin', 'original', 'Kotlin'],
  [/(^|[^a-z0-9])(c#|csharp)/, 'csharp', 'original', 'C#'],
  [/(^|[^a-z0-9])(c\+\+|cpp\b)/, 'cplusplus', 'original', 'C++'],
  [/(^|[^a-z0-9])php/, 'php', 'original', 'PHP'],
  [/(^|[^a-z0-9])(golang)/, 'go', 'original', 'Go'],
  [/(^|[^a-z0-9])rust\b/, 'rust', 'original', 'Rust'],
  [/(^|[^a-z0-9])swift/, 'swift', 'original', 'Swift'],
  [/(^|[^a-z0-9])flutter/, 'flutter', 'original', 'Flutter'],
  [/(^|[^a-z0-9])android/, 'android', 'original', 'Android'],
  [/(^|[^a-z0-9])docker/, 'docker', 'original', 'Docker'],
  [/(^|[^a-z0-9])linux/, 'linux', 'original', 'Linux'],
  [/(^|[^a-z0-9])github/, 'github', 'original', 'GitHub'],
  [/(^|[^a-z0-9])git\b/, 'git', 'original', 'Git'],
  [/(^|[^a-z0-9])supabase/, 'supabase', 'original', 'Supabase'],
  [/(^|[^a-z0-9])firebase/, 'firebase', 'original', 'Firebase'],
  [/(^|[^a-z0-9])(aws|amazon web)/, 'amazonwebservices', 'original', 'AWS'],
  [/(^|[^a-z0-9])azure/, 'azure', 'original', 'Azure'],
  [/(^|[^a-z0-9])(google cloud|gcp\b)/, 'googlecloud', 'original', 'Google Cloud'],
  [/(^|[^a-z0-9])figma/, 'figma', 'original', 'Figma'],
  [/(^|[^a-z0-9])photoshop/, 'photoshop', 'original', 'Photoshop'],
  [/(^|[^a-z0-9])illustrator/, 'illustrator', 'plain', 'Illustrator'],
  [/(^|[^a-z0-9])canva(?!s)/, 'canva', 'original', 'Canva'],
  [/(^|[^a-z0-9])blender/, 'blender', 'original', 'Blender'],
  [/(^|[^a-z0-9])unity/, 'unity', 'original', 'Unity'],
  [/(^|[^a-z0-9])wordpress/, 'wordpress', 'original', 'WordPress']
];

// [desen, emoji] — Türkçe kökler, ekler açık uçta kalıyor.
const PROJE_EMOJILERI = [
  [/(^|[^a-zçğıöşü])(excel|spreadsheet|e-tablo)/, '📗'],
  [/(^|[^a-zçğıöşü])(power ?bi|tableau|dashboard|gösterge paneli|veri analiz|analiz|istatistik|veri(?!m))/, '📈'],
  [/(^|[^a-zçğıöşü])(makine öğren|machine learning|yapay zek|ai\b|llm|chatbot)/, '🤖'],
  [/(^|[^a-zçğıöşü])(n8n|otomasyon|automation|zapier)/, '⚙️'],
  [/(^|[^a-zçğıöşü])(güneş|solar|enerji|panel)/, '☀️'],
  [/(^|[^a-zçğıöşü])(sunum|slayt|presentation|pitch|deck)/, '🎤'],
  [/(^|[^a-zçğıöşü])(tez|makale|rapor|essay|blog|yazı(?!l))/, '✍️'],
  [/(^|[^a-zçğıöşü])(ödev|assignment|homework)/, '📝'],
  [/(^|[^a-zçğıöşü])(sınav|vize|final|quiz|kpss|yks|ales|ders|çalış)/, '📚'],
  [/(^|[^a-zçğıöşü])(cv|özgeçmiş|mülakat|staj|iş başvuru|linkedin|kariyer)/, '💼'],
  [/(^|[^a-zçğıöşü])(bitirme|mezuniyet|graduation|capstone)/, '🎓'],
  [/(^|[^a-zçğıöşü])(girişim|startup|iş planı|hackathon|kickstart)/, '🚀'],
  [/(^|[^a-zçğıöşü])(tasarım|logo|design|ui\b|ux\b|afiş|poster)/, '🎨'],
  [/(^|[^a-zçğıöşü])(video|youtube|montaj|reels|tiktok|vlog)/, '🎬'],
  [/(^|[^a-zçğıöşü])(web ?site|site|landing|portföy|portfolio|web)/, '🌐'],
  [/(^|[^a-zçğıöşü])(mobil|uygulama|app\b)/, '📱'],
  [/(^|[^a-zçğıöşü])(bütçe|finans|vergi|fatura|muhasebe|yatırım|borsa)/, '💰'],
  [/(^|[^a-zçğıöşü])(ingilizce|almanca|fransızca|ielts|toefl|yds|kelime|dil öğren)/, '🗣️'],
  [/(^|[^a-zçğıöşü])(matematik|kalkülüs|fizik|kimya|geometri)/, '📐'],
  [/(^|[^a-zçğıöşü])(kitap|okuma|roman)/, '📖'],
  [/(^|[^a-zçğıöşü])(müzik|gitar|piyano|şarkı)/, '🎵'],
  [/(^|[^a-zçğıöşü])(spor|antrenman|koşu(?!l)|gym|fitness|yürüyüş)/, '🏋️'],
  [/(^|[^a-zçğıöşü])(doktor|sağlık|randevu|ilaç|hastane)/, '🩺'],
  [/(^|[^a-zçğıöşü])(seyahat|tatil|uçuş|otel)/, '✈️'],
  [/(^|[^a-zçğıöşü])(temizlik|çamaşır|bulaşık|taşın|ev işi)/, '🏠'],
  [/(^|[^a-zçğıöşü])(alışveriş|market(?!ing)|sipariş)/, '🛒'],
  [/(^|[^a-zçğıöşü])(yemek|tarif|mutfak)/, '🍳'],
  [/(^|[^a-zçğıöşü])(toplantı|etkinlik|organizasyon|düğün|doğum günü)/, '📅']
];

function ikonMetniEslestir(metin) {
  const m = String(metin || '').toLocaleLowerCase('tr');
  if (!m.trim()) return null;
  for (const [desen, ad, varyant, etiket] of PROJE_LOGOLARI) {
    if (desen.test(m)) return { tur: 'logo', src: `${DEVICON_TABAN}${ad}/${ad}-${varyant}.svg`, etiket };
  }
  for (const [desen, simge] of PROJE_EMOJILERI) {
    if (desen.test(m)) return { tur: 'emoji', simge };
  }
  return null;
}

/**
 * Projenin ikonu. Önce BAŞLIK: kullanıcının kendi koyduğu ad en güçlü
 * sinyal. Başlıkta bir şey yoksa görev adlarına bakılır (AI'nın ürettiği
 * adımlar çoğu zaman teknolojiyi anar: "SQL ile müşteri tablosunu sorgula").
 * Görevlerde EN ÇOK geçen eşleşme kazanır — tek bir yan söz projeyi ele geçirmesin.
 * @returns {{tur:'logo',src:string,etiket:string}|{tur:'emoji',simge:string}|null}
 */
function projeIkonu(baslik, gorevAdlari) {
  const basliktan = ikonMetniEslestir(baslik);
  if (basliktan) return basliktan;
  const sayac = new Map();
  for (const ad of (Array.isArray(gorevAdlari) ? gorevAdlari : [])) {
    const e = ikonMetniEslestir(ad);
    if (!e) continue;
    const anahtar = e.tur === 'logo' ? e.src : e.simge;
    const kayit = sayac.get(anahtar) || { e, n: 0 };
    kayit.n++;
    sayac.set(anahtar, kayit);
  }
  let enIyi = null;
  for (const k of sayac.values()) if (!enIyi || k.n > enIyi.n) enIyi = k;
  return enIyi ? enIyi.e : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { projeIkonu, ikonMetniEslestir, PROJE_LOGOLARI, PROJE_EMOJILERI, DEVICON_TABAN };
}
