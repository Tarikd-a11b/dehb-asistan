# FocusAid — Claude Code notları

DEHB odak asistanı. Kullanıcı görev veya yönerge dosyası girer → n8n workflow'u görevi odak
seanslarına böler → Google Calendar'a ekler → Supabase `tasks` tablosuna yazar → "Bugün" ekranında
listelenir.

**Stack:** vanilla HTML/JS + Tailwind (**derlenmiş**, artık CDN değil) + FullCalendar +
Supabase (Google OAuth + Postgres) + n8n (**Oracle Cloud'da self-hosted**,
`https://focusaid-n8n.duckdns.org`) + Google Gemini.

HTML ve JS hâlâ build adımsız, doğrudan servis edilir. **Tek istisna CSS:** Tailwind
2026-09-05'te play CDN'inden çıkarıldı, `tailwind.css` olarak bir kez üretiliyor
(bkz. [CSS derlemesi](#css-derlemesi)). `package.json` **yalnızca geliştirme araçları** için
(Tailwind CLI, Playwright); uygulamanın çalışması için `npm i` gerekmez, `serve.py` yeter.

`serve.py` hem yerel geliştirme sunucusu hem de Render'daki üretim sunucusu: statik dosyaları
servis eder, `config.js`'i ortam değişkenlerinden üretir, Google token'ını yeniler ve n8n'e
giden istekleri vekiller.

Bu dosya elle güncellenir; kullanıcı "CLAUDE.md'yi güncelle" dediğinde yenilenir, her değişiklikte değil.
Son güncelleme: 2026-09-05.

---

## Çalıştırma

```bash
python serve.py                      # port 3000, önbelleksiz
# tarayıcıda: http://localhost:3000/auth.html
```

Üç kural, üçü de birer saat kaybettirmiştir:

1. **Dosyayı çift tıklayarak açma.** `file://` ayrı bir origin sayılır; localhost'ta kurulan Supabase
   oturumu orada görünmez ve Google `file://` adresine geri dönemez.
2. **`127.0.0.1` değil `localhost`.** PKCE'nin `code_verifier`'ı girişin başladığı origin'in
   localStorage'ında durur; ikisi farklı origin'dir.
3. **`python -m http.server` yerine `serve.py`.** Yerleşik sunucu önbellek başlığı göndermediği için
   tarayıcı `config.js` ve `*.js` dosyalarının eski sürümünü çalıştırmaya devam eder; Ctrl+Shift+R bile
   her zaman yetmez. `serve.py` her yanıta `Cache-Control: no-store` ekler.

**n8n'i artık yerelde çalıştırmana gerek yok** — Oracle Cloud'da 7/24 ayakta ve `serve.py`
oraya vekillik ediyor. (Eski not "localhost:5678 açık olmalı" diyordu; 2026-08-26'da geçersizleşti.)

## CSS derlemesi

```bash
npm i                 # bir kez: Tailwind CLI + Playwright (yalnızca geliştirme)
npm run build:css     # üretim (minified) → tailwind.css
npm run watch:css     # geliştirirken açık bırak
```

Sayfa eskiden `cdn.tailwindcss.com` yüklüyordu: **407 KB ham / 123 KB gzip JavaScript** indirip
CSS'i her açılışta tarayıcıda derliyordu. Şimdi `tailwind.css` **53.600 bayt / 9.118 bayt gzip**
ve derleme yok.

⚠️ **Yeni bir Tailwind sınıfı yazdığında `npm run build:css` çalıştır.** Unutursan o sınıf
dosyada olmaz ve öğe **sessizce stilsiz** kalır — konsolda hata yok, sayfa patlamaz.
`test-ui/tailwind-guncel.mjs` bunu yakalıyor (CSS'i yeniden üretip bayt bayt karşılaştırır).

`<link rel="stylesheet" href="tailwind.css">` **bilerek** sayfanın kendi `<style>` bloğundan
SONRA duruyor: play CDN de stylesheet'ini çalışma anında `<head>`'in sonuna enjekte ediyordu.
Eşitlikte Tailwind yardımcılarının kazandığı kaskad sırası böylece değişmedi — sayfanın kendi
`.fc-*` kurallarının çoğu bu yüzden zaten `!important` taşıyor. Link'i yukarı taşıma.

Geçişte görünümün değişmediği ölçüldü: iki sürüm de headless Chrome'da açılıp tüm öğelerin
36 hesaplanmış stili karşılaştırıldı (6 sayfa × 2 ekran). Kontrol grubu (CDN vs CDN) 1899 öğede
8 fark verdi; asıl karşılaştırma (CDN vs derlenmiş) 2234 öğede 8 fark — gürültü tabanıyla eşit,
hepsi canlı animasyon opaklığı. Yerleşim/renk/boyut farkı sıfır.

## Deploy

**`main`'e push → Render otomatik deploy eder.** 2026-08-27'de doğrulandı: push'tan ~38 saniye
sonra yeni içerik canlıdaydı.

Tarihçe (aynı yanlış teşhisi tekrarlamamak için): bir dönem hiç otomatik deploy olmuyordu, çünkü
Render GitHub App'inin bu repoya erişimi kesilmişti. Panelde Auto-Deploy "On Commit" göründüğü için
"ayar kapalı" sanmak kolaydı — **ayar açıktı, bağlantı kopuktu.** İkisi farklı şeyler.
Onarımı `github.com/settings/installations` → Render → repository access üzerinden **kullanıcı
yapmalı** (OAuth izni; `gh` token'ı yetmiyor, `gh api user/installations` → 403).

⚠️ **`gh api repos/<repo>/hooks` → `[]` bunun göstergesi DEĞİL.** GitHub App entegrasyonları repo
seviyesinde webhook oluşturmaz, olaylar App'in kendi webhook'una gider. Bu uç bağlantı sağlamken de
boş döner; bir dönem buna dayanıp yanlış teşhis kondu.

**Doğru teşhis yolu:** Render → `dehb-asistan` → **Events** sayfasında push'tan sonra yeni deploy
satırı çıkıyor mu, çıkıyorsa tetikleyicisi ne diyor. Ya da ucuz kanarya: `README.md` canlıda servis
ediliyor ama çalışma davranışının parçası değil — içine izlenebilir bir dize koyup push et, sonra
`curl -s .../README.md | grep -c <dize>` ile yokla. Risksiz ölçüm.

Otomatik deploy bozulursa geçici çözüm: Render Dashboard → `dehb-asistan` →
**Manual Deploy → Deploy latest commit**. ~30 saniye sürer.

Doğrulaması — yerel dosyaya değil, canlının servis ettiği içeriğe bak:

```bash
curl -s https://dehb-asistan.onrender.com/index.html | grep -c <yeni_fonksiyon_adı>
```

`render.yaml` servisi **yönetmiyor** (servis panelden elle kurulmuş, Blueprint'e bağlı değil);
yalnızca yapılandırmayı ve gereken ortam değişkenlerini belgeliyor.

## Testler

İki ayrı takım var. **Karıştırma:** hızlı olan hiçbir şey kurmadan çalışır, yavaş olan tarayıcı açar.

```bash
node --test          # 180 test, ~370 ms — kök dizinden, ARGÜMANSIZ, node_modules gerekmez
npm run test:ui      # 15 test, ~90 sn — gerçek Chrome'da yerleşim + misafir modu + CSS güncelliği
```

`node --test test/` Windows'ta MODULE_NOT_FOUND verir. Dizin yerine ya argümansız çalıştır ya da
dosyaları tek tek ver.

**`test/` — saf mantık, DOM'suz, ağsız, bağımlılıksız.** Test edilen: `tasks-logic.js`,
`doc-intake-logic.js`, `calendar-logic.js`, `profile-logic.js`, `scheduling-logic.js`,
`hyperfocus-logic.js`. Yeni mantık yazarken bu ayrımı koru: saf hesap `*-logic.js`'e, DOM ve
`fetch` `*-view.js` / `doc-intake.js`'e.

`test/sablon-fixed.test.js` bunlardan farklı: `index.html`i **metin olarak** okuyup şablonların
içinde `position:fixed` öğe olmadığını doğruluyor (gerekçesi Tuzaklar'da). Tarayıcı gerektirmediği
için hızlı takımda kalabiliyor.

**`test-ui/` — gerçek tarayıcıda yerleşim.** `playwright-core` + sistemde kurulu Chrome
(`channel: 'chrome'`); tarayıcı indirmesi yok, internet ister (sayfa Supabase/FullCalendar'ı
CDN'den çekiyor).

| dosya | ne doğruluyor |
|---|---|
| `test-ui/layout-check.mjs` | 390×844 ve 1280×800'de 9 yerleşim iddiası: sayfalar yatay kaydırmıyor **ve ana sütun ekranı kullanıyor**, Parçala butonu input yazısına binmiyor, takvim mobilde liste / masaüstünde ay açılıyor, gün modalı ekran içinde, çekmece açılıp kapanıyor, masaüstüne mobil kabuk sızmıyor, landing hero'su çakışmıyor |
| `test-ui/misafir-modu.mjs` | Demo modunda kullanıcıya ham hata sızmıyor: 6 sayfada iz taraması, gün modalı boş durum gösteriyor, Parçalayıcı demo modunu açıklıyor, Supabase/n8n'e **hiç istek gitmiyor** |
| `test-ui/tailwind-guncel.mjs` | `tailwind.css` kaynaklarla güncel mi (`npm run build:css` unutulmuş mu), hiçbir sayfa play CDN yüklüyor mu |

⚠️ **Dizin adı `test-ui/`, dosya adları `*.test.js` değil** — argümansız `node --test` bunları
BULMASIN diye. Buraya `x.test.js` adında dosya koyarsan hızlı takım 45 saniyeye çıkar.

⚠️ **Yeni bir yerleşim testi yazdığında bozuk kodda kırmızıya döndüğünü GÖSTER.** Geçen bir test
hiçbir şey kanıtlamaz. Bu takımın tamamı böyle doğrulandı: `git show 715fc43:index.html` (mobil
düzeltmelerden önceki sürüm) yerine konup koşuldu, 9 testin 7'si düştü. "Yatay taşma yok"
iddiası tek başına o sürümü GEÇİYORDU — 256px'lik sabit sidebar ana içeriği 125px'e eziyor,
içerik taşmak yerine tek kelimelik sütuna sarıyordu. O yüzden "ana sütun ekranın en az %85'ini
kullanır" iddiası eklendi.

**`test/n8n-placement.test.js` ayrı bir şey yapıyor: n8n node kodunu doğrudan koşturuyor.** Node
kodu repoda bir JSON alanında duruyor ve canlıya elle kopyalanıyor; 2026-08-30'a kadar hiçbir şey
onu test etmiyordu. Dosya `new Function('$','$json', jsCode)` ile node'u çalıştırıp yerleştiricinin
değişmezlerini kilitliyor (çakışma yok, görev kaybı yok, mevcut takvim etkinliğinin üstüne
yazılmıyor) ve `dailyCaps` kopyasının `scheduling-logic.js` ile birebir aynılığını doğruluyor.
**n8n node kodunu değiştirdiğinde bu dosyayı çalıştır.**

## Mobil arayüz

2026-09-05'e kadar mobil düzen **hiç yazılmamıştı**: `index.html`deki `@media (max-width:768px)`
bloğunun içinde boş bir TODO duruyordu. Sidebar her genişlikte `w-64` (256px) sabitti, 390px'lik
telefonda ana içeriğe 125px kalıyordu.

**Kırılma noktası 768px (Tailwind `md:`).** Altında:

- Sidebar ekran dışında bekleyen bir **çekmece** (`#app-sidebar` + `-translate-x-full`), üstte
  hamburger çubuğu (`#mobile-topbar`), arkada perde. `loadPage` her çağrıldığında
  `closeMobileSidebar()` çalışıyor — yoksa sayfa değişiyor ama kullanıcı içeriği göremiyor.
- `main`'de `min-w-0` **şart**: flex çocuğu varsayılan olarak `min-width:auto` ile büzülmeyi
  reddediyor, içerik ezilip tek kelimelik sütuna sarıyordu.
- Parçalayıcı'da "Parçala" butonu input'un **altına** akıyor. ≥768px'te eskisi gibi input'un
  içine mutlak konumlanıyor — o düzeltmenin masaüstüne sızmadığını bir test bekliyor.
- Takvim **liste görünümüyle** (`listWeek`) açılıyor. Gerekçe ölçüm: ay ızgarası 7 sütuna
  bölününce hücre 46px kalıyor, görev başlığına 4-6px düşüyor (metin 105-129px istiyor) —
  görevler okunamaz renkli çizgilere dönüşüyordu. Ay görünümü erişilebilir ama orada başlık
  yerine bilişsel yük renginde 5px'lik şerit basılıyor; detay güne dokununca gün modalinde.
- FullCalendar ızgarası `table-layout:fixed` ile sabitleniyor: sütun genişliği içeriğin
  min-content'inden hesaplandığı için Pazar sütunu kırpılıyordu.

**Mobil ve masaüstü bilinçli olarak ayrı** (kullanıcı kararı, 2026-09-05): aynı veriyi her ekranın
kaldırdığı biçimde göstermek, 46px'lik hücreye metin sığdırmaya çalışmaktan iyi.

Landing'de ayrı bir tuzak vardı: `.sahne.merkez .sahne-in` (0,3,0) mevcut `@media(max-width:980px)`
kuralından (0,1,0) daha özgül olduğu için hero telefonda da iki sütunlu kalıyor, maket metnin
üstüne biniyordu. Mobil override'lar **aynı özgüllükte** yazılmalı.

## Profil

2026-08-29'da 18 alandan 11'e indirildi. Planlamaya **gerçekten etki eden** alanlar:

| alan | etkisi |
|---|---|
| `focusPeriod`, `workHours`, `breakStyle` | günde kaç odak seansı sığdığı (n8n `Normalize & Calculate`) |
| `todayMood` | `foggy`/`crash`/`anxious` → **bugünün** görev tavanı −1; `hyper`/`focused` → +1 (bkz. aşağıda) |
| `hyperfocusLimit` | tarayıcıdaki hiperfokus alarmının periyodu (`hyperfocus-view.js`) |
| `mainObstacle` | AI prompt'una girer |
| `lightSensitivity` | **koyu tema hafızası** — arayüzde kartı yok ama alan duruyor; silersen tema tercihi cihazlar arası kaybolur |

`social`, `focusTrigger`, `motivationNote`, `superpowers` toplanıp n8n'e gidiyor
ama henüz bir karşılığı yok.

`todayMood`'un görev **sayısına** etkisi 2026-08-30'da yerleştirmeye taşındı: AI'ya verilen
`minTasks`–`maxTasks` aralığı bir tavsiyeydi ve AI onu umursamıyordu (ölçüldü: `anxious` ve `hyper`
aynı 9 görevi üretti). Artık `dailyCaps()` **bugünün** tavanını günün *doğal* görev sayısına göre
kaydırıyor; taşan görev silinmiyor, sonraki günlere yayılıyor. `moodDelta > 0` bugüne görev
**çekmez** — asimetri bilinçli, gerekçesi `scheduling-logic.js`'teki yorumda.

`hyperfocusLimit` artık ölü değil: `hyperfocus-view.js` uygulama açıkken kesintisiz süreyi sayıp
seçilen periyotta bir şerit çıkarıyor. Sayaç **n8n'e hiç uğramaz**, tamamen tarayıcıda. Mola
yalnızca "Mola verdim" düğmesi ya da tikler arası ≥10 dk boşlukla sıfırlanır; sekmenin gizlenmesi
mola sayılmaz (gerekçe: `docs/superpowers/specs/2026-08-30-hiperfokus-alarmi-design.md`). `medication`, `rsdLevel`, `soundSensitivity`, `envPref`,
`regulationMethod`, `stimPref`, Duyusal Profil ve Duygu Regülasyonu kartları kaldırıldı.

`todayMood` günlüktür: `today_mood_date` bugünün İstanbul tarihi değilse mod bayat sayılır ve
planlamaya gitmez (`moodForToday()`). Bu filtre **iki ayrı yolda** olmalı — profil ekranı
yüklenirken ve `index.html`'de n8n payload'ı kurulurken. İkincisi test kapsamı dışında, elle koru.

## n8n ile senkron

`n8n-workflow-focusaid.json` canlı n8n ile **elle** eşitlenir. Node koduna workflow JSON'ını değil,
`parameters.jsCode` alanının içeriğini yapıştır — 2026-08-29'da bir kez JSON yapıştırıldı ve akış
12 dakika kırık yayında kaldı. Doğrulaması gözle değil hash'le:

```js
// n8n sekmesinde konsol; kod repodakiyle bayt bayt aynı mı
const bid = localStorage.getItem('n8n-browserId');
const wf = (await (await fetch('/rest/workflows/<id>', {headers:{'browser-id':bid}})).json()).data;
const code = wf.nodes.find(n => n.name === '<node adı>').parameters.jsCode;
[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)))]
  .map(b => b.toString(16).padStart(2,'0')).join('');
```

**2026-08-30: canlı ile repo eşit.** `Normalize & Calculate`, `Code in JavaScript` ve
`Respond to Webhook` "mod gorev sayisi + tasma duzeltmesi" adıyla yayınlandı; üçünün de
SHA-256'sı repodaki `n8n-workflow-focusaid.json` ile birebir doğrulandı.

💡 Yeni kodu tarayıcıya elle yapıştırma — GitHub raw CORS'a izin veriyor, doğrudan oradan çek:
```js
const j = await (await fetch('https://raw.githubusercontent.com/Tarikd-a11b/dehb-asistan/main/n8n-workflow-focusaid.json')).json();
const kod = j.nodes.find(n => n.name === '<node adı>').parameters.jsCode;
document.querySelector('.cm-content').cmTile.view.dispatch({changes:{from:0, to:view.state.doc.length, insert:kod}});
```
Böylece kaçış/yapıştırma hatası imkânsız hale geliyor. `Respond to Webhook` gibi **ifade**
alanlarında saklanan değer `=` önekiyle başlar, editöre `=` **girmez** — `kod.slice(1)` yaz.

⚠️ n8n kanvası klavye kısayollarına (`1`, zoom düğmeleri, wheel) her zaman yanıt vermiyor; ekranda
olmayan bir node'u açmak için `.vue-flow__transformationpane`'in `transform`'unu geçici olarak
kaydır. Vue Flow re-render'da geri sıçratıyor, bu yüzden dönüşümü 50 ms'de bir yeniden uygulayan
bir `setInterval` kurup çift tıkla, sonra durdur.

`Prepare Supabase Payload` takvim olaylarıyla görevleri **indeks eşleşmesiyle** birleştirir
(`events.map((item,i) => tasks[i])`). `Code in JavaScript` çıktısını filtreleyen ya da yeniden
sıralayan bir şey eklersen görevler yanlış takvim etkinliğine bağlanır.

## Dosya düzeni

| dosya | rol |
|---|---|
| `landing.html` | **Tanıtım sayfası** — kök adres (`/`) burayı sunuyor. Tek dosya: 5 sahneli kaydırma anlatısı + arayüz slider'ı |
| `landing-gorsel/` | Sahne fotoğrafları (referans videodan çıkarıldı) ve `arayuz/` altında 6 gerçek uygulama ekranı |
| `auth.html` | Google OAuth giriş sayfası |
| `index.html` | **Tek uygulama dosyası** — tüm ekranlar içinde `<template>` olarak |
| `index_2.html` | `index.html`'e yönlendirme köprüsü — aşağıya bak, silme |
| `tasks-logic.js` / `tasks-view.js` | "Bugün" ekranı: saf mantık / DOM+ağ |
| `calendar-logic.js` | Takvim tarih hesapları (ay ızgarası, hafta aralığı) — DOM'suz |
| `profile-logic.js` | Profil alanları, doluluk hesabı, n8n'e giden `planningProfile()` — DOM'suz |
| `scheduling-logic.js` | Gün ataması, gün içi bilişsel yük sıralaması, `dailyCaps` — **tarayıcıda yüklenmez**, gövdesi n8n `Code in JavaScript` node'una kopyalanır |
| `hyperfocus-logic.js` / `hyperfocus-view.js` | Hiperfokus alarmı: saf sayaç / şerit + bildirim. Tamamen istemci tarafı, n8n'e hiç uğramaz |
| `doc-intake-logic.js` / `doc-intake.js` | Yönerge dosyası yükleme: saf mantık / arayüz |
| `dehb-info.js` | DEHB Bilgilendirme Platformu içeriği |
| `serve.py` | uygulama sunucusu: statik + config enjeksiyonu + n8n vekili + `/api/google/refresh`. **`/` → `landing.html`** (uygulama `/index.html`'de) |
| `schema.sql`, `fix-*.sql` | Supabase şeması ve düzeltmeleri |
| `n8n-workflow-*.json` | n8n workflow tanımları — canlı n8n ile senkron tutulmalı |
| `infra/n8n/` | n8n sunucusunun kurulum kiti (Oracle + Docker + Caddy + `KURULUM.md`) |
| `render.yaml` | Render yapılandırması ve ortam değişkeni listesi (servisi yönetmez) |
| `config.js` | **gitignored** — Supabase/Google anahtarları; şablonu `config.example.js` |
| `tailwind.css` | **Üretilen dosya** — elle düzenleme, `npm run build:css` ile yenilenir. Commit'li: canlıda servis ediliyor |
| `tailwind.config.js` / `tailwind-giris.css` | Tailwind derleme yapılandırması ve giriş dosyası |
| `package.json` | **Yalnızca geliştirme araçları** (Tailwind CLI, playwright-core). Uygulama bunlarsız çalışır; `node_modules/` gitignored |
| `test/` | Saf mantık testleri — `node --test`, bağımlılıksız |
| `test-ui/` | Tarayıcıda yerleşim testleri — `npm run test:ui`. Dosya adları bilerek `*.test.js` DEĞİL |

`docs/superpowers/` altındaki plan ve spec'ler **tamamlanmış işin tarihsel kaydıdır**, güncel talimat
değil. Özellikle oradaki "`index.html` ve `index_2.html` ikizdir, birini değiştirince diğerine kopyala"
notları GEÇERSİZ.

## `index_2.html` neden duruyor

Uygulama eskiden iki birebir kopya halinde tutulup elle eşitleniyordu. 2026-07-27'de tek dosyaya
(`index.html`) indirildi. Ama **Supabase → Authentication → URL Configuration → Redirect URLs**
listesinde kayıtlı adres hâlâ `http://localhost:3000/index_2.html`; Google girişinden dönüş oraya
düşüyor. Bu yüzden `index_2.html`, sorgu dizesini ve hash'i koruyarak `index.html`'e devreden 24 satırlık
bir köprü olarak bırakıldı. `auth.html` içindeki `redirectTo` da bilerek değiştirilmedi.

Kaldırmak için sıra önemli: önce Supabase'e `http://localhost:3000/index.html` ekle, sonra `redirectTo`'yu
değiştir, en son köprüyü sil.

## Oturum akışı

`index.html` oturumu `getSession()` ile değil `INITIAL_SESSION` olayıyla bekler — PKCE code exchange
dahil tüm async iş bitince ateşlendiği için yönlendirme döngüsünü engeller. Oturum yoksa `auth.html`'e
gider; `sessionStorage` bayrağı sayesinde döngü oluşursa ikinci turda durup teşhis ekranı basar
(`gosterOturumTeshisi()`), tarayıcıda bounce eden bir sayfayı incelemek zor olduğu için.

## Bilinen Sorunlar

- **Takvim senkronu sessizce atlanabiliyor.** n8n'deki takvim node'ları `onError: continue` ile
  geçtiği için görev Supabase'e yazılır ama Google Takvim'e hiçbir şey düşmeyebilir. 2026-08-27'de
  cevaba `takvimeYazilan` / `toplam` sayaçları eklendi ve mesaj buna göre değişiyor
  (`parcalamaSonucMesaji`), yani kullanıcı artık yanlış bilgilendirilmiyor — ama sessiz atlama
  davranışının kendisi duruyor.
- **Misafir modu veri saklamıyor — bilinçli.** Misafir modu ürünü çalıştırmak için değil
  **arayüzü göstermek** için var (2026-09-05, kullanıcı kararı). Misafire `id: 'guest_user'`
  veriliyor; bu bir UUID olmadığı için `.eq('user_id', ...)` içeren her sorgu Postgres'ten
  `invalid input syntax for type uuid` ile dönerdi, Parçalayıcı da vekilden 401 alırdı
  (misafirin Supabase oturumu yok, `serve.py` kimlik doğruluyor).

  **Artık bu hatalar kullanıcıya GÖSTERİLMİYOR:** `misafirIstemcisiniKur()` misafirde
  `supabaseClient.from`'u sahte bir sorgu katmanıyla değiştiriyor, ağa hiç çıkılmıyor. Okuma boş
  sonuç dönüyor → ekranların zaten tasarlanmış boş durumları görünüyor. Yazma yolları (görev
  ekleme, profil kaydı, Parçalayıcı, yönerge analizi) n8n vekiline gitmeden açık birer demo
  mesajı basıyor. `auth` gerçek kalıyor, çıkış çalışıyor.

  ⚠️ Sahte katmanda `.single()` özel: boş dizi değil **null** döner. Dizi dönerse `rowToProfile`
  ve benzeri tek-satır bekleyen çağrılar sessizce yanlış davranır.

  Sözü `test-ui/misafir-modu.mjs` koruyor (ham iz taraması + "Supabase/n8n'e hiç istek gitmiyor").
  Misafir modunu gerçekten çalışır kılmak istenirse yol: veriyi localStorage'a alan ince bir
  depolama katmanı — uygulama hangi arka uçta olduğunu bilmesin.
- **Render ücretsiz planı uykuya geçiyor**; ilk istek 50 saniyeye kadar gecikebiliyor. Bu yüzden
  takvimin otomatik bağlanması normalde ~7 sn sürerken soğuk açılışta ~14 sn'yi bulabiliyor.
  Ölçüm yaparken sabırsız olma, "takvim bozuk" diye yanlış teşhis koymak kolay.

- **Sığmayan plan artık teslim tarihini aşıyor.** Yerleştirici çalışma penceresine sığmayan
  görevleri son seansın sonundan itibaren diziyor; bu bilinçli bir takas (bkz. Tuzaklar). Kullanıcı
  `tesliminOtesinde` sayacıyla uyarılıyor.

**Çözülmüş (eski notlar kaldırıldı):** ay/hafta görünümünde başlıkların görünmemesi `eventContent`
render fonksiyonuyla çözüldü; `tasks` tablosuna başlığın nasıl yazıldığı da netleşti —
`Prepare Supabase Payload` node'u `name` alanına yazıyor. **Taşma çakışması** (aşırı dolu planda
görevlerin aynı saate yığılması) 2026-08-30'da bitti: 8064 senaryoda 3174 → 0.

## Tuzaklar

- **Yerel `*.js` dosyaları `index.html`'e KLASİK script olarak yükleniyor: hepsi aynı global
  sözlüğü paylaşıyor.** İki dosya aynı üst düzey `const`'u tanımlarsa ikincisi komple
  `SyntaxError` ile düşer ve **sessizce hiçbir fonksiyonu tanımlanmaz** — konsolda tek satır,
  uygulamada özellik yok. 2026-08-30'da `hyperfocus-logic.js`'teki `DEFAULT_BREAK_MINUTES`
  `tasks-logic.js`'tekiyle çakıştı; 166 birim test geçerken alarm tarayıcıda hiç çalışmadı. Yeni
  bir `*-logic.js` eklerken ad çakışmasını tara:
  `for f in *.js; do grep -oE "^(const|let|var|function) +[A-Za-z_$][A-Za-z0-9_$]*" $f; done | sort | uniq -d`
- **Yerleştiricide "üst üste binmek" yerine "teslimi aşmak" seçildi.** Plan çalışma penceresine
  sığmadığında bir şey feda edilecek: üst üste binen etkinlik *sessiz bir veri hatası*, teslimi
  aşan görev ise *görünür bir gerçek*. Görev düşürmek hiçbir durumda seçenek değil.
- **Tailwind `-translate-x-1/2` ile ortalama yapma.** `.animate-slide-in`'in `reveal` kareleri
  `transform`'u komple eziyor. `inset-x-0 mx-auto` kullan.
- **Şablonların İÇİNE `position:fixed` öğe koyma** — aynı `reveal` transformunun ikinci yüzü.
  Transformlu bir öğe, içindeki `fixed` çocuklar için yeni bir *kapsayıcı blok* yaratır: o çocuk
  artık viewport'a değil transformlu ataya göre konumlanır, yani animasyon sürdüğü ~0.6 sn boyunca
  tam ekran katman kayar. `#confirm-modal` ve `#day-modal` bu yüzden body seviyesinde duruyor.
  Kuralı `test/sablon-fixed.test.js` bekliyor.
  ⚠️ Tarihçe düzeltmesi: 42e1157 bu taşımayı "modal telefonda ekran dışına taşıyor, ölçüldü"
  diye anlatmıştı — **yanlıştı**, o ölçüm donmuş bir renderer'da alınmıştı. Sağlıklı tarayıcıda
  modal taşımadan önce de doğru yerde açılıyordu. Taşıma yine de doğru (loadPage `main`'i silerken
  modal yok olmuyor), ama bir hata düzeltmesi değil, sağlamlaştırma.
- **Sınıf adını parça parça üretme:** `'bg-' + renk`, `` `text-${x}-500` `` çalışmaz. Tailwind
  artık derleniyor ve kaynağı **düz metin** olarak tarıyor; oluşturamadığı sınıf CSS'e girmez.
  ⚠️ Bu play CDN'de ÇALIŞIYORDU (JIT, DOM'u çalışma anında izliyordu) — 2026-09-05'teki geçişle
  davranış değişti. Değişken sınıf gerekiyorsa **tam adları** bir sözlükte tut, `tasks-view.js`
  içindeki `YUK_KENAR` gibi; tarayıcı literalleri orada bulur.
- **Mobil override'ları aynı özgüllükte yaz.** `@media` bir kuralı otomatik kazandırmaz; kaskad
  yine özgüllüğe bakar. Landing'de `.sahne.merkez .sahne-in` (0,3,0) mobil `.sahne-in` (0,1,0)
  kuralını eziyor ve hero telefonda iki sütunlu kalıyordu.
- **Canlı `tasks` tablosu `schema.sql`'den ayrışabiliyor.** Bir insert beklenmedik şekilde patlarsa
  repo'daki şemaya güvenme, `information_schema.columns` ile canlı yapıya bak. Geçmişte eski nesilden
  kalan `title NOT NULL` kolonu tüm insert'leri `23502` ile düşürmüştü.
- **`service_role` anahtarı YALNIZCA n8n'de durur.** `config.js`'e, ön yüze veya paylaşılan JSON'a asla
  girmez. Ön yüz okuması user-JWT + RLS ile yapılır, o yüzden RLS politikaları kalmalı.
- **Planlamayı AI yapmaz.** AI Agent yalnızca görev listesi + `cognitive_load` üretir; tarih/saat
  yerleştirmesini n8n'deki Code node algoritmayla yapar. LLM'e tarih/saat bırakma kararı bilinçli.
- **n8n `{{ }}` ifadesine `\n` yapıştırırken** gerçek satır sonuna dönüşmemesine dikkat. Dönüşürse n8n
  "invalid syntax" der — bu mesaj modelden değil n8n'in kendi ifade motorundan gelir.
- **n8n'in takvim node'ları artık KENDİ Google credential'ını kullanmıyor.** `Get many events` ve
  `Create an event` birer HTTP Request node'u; isteği yapan kullanıcının tarayıcıdan gelen token'ıyla
  (`Authorization: Bearer {{ $json.googleAccessToken }}`) **o kullanıcının kendi takvimine** yazıyor.
  Bu yüzden Google OAuth istemcisinde artık yalnızca Supabase callback'i gerekiyor;
  `localhost:5678/rest/oauth2-credential/callback` kaydı bu akış için ARTIK GEREKLİ DEĞİL.
- **n8n webhook'ları Header Auth ile korunuyor.** `X-Focusaid-Secret` başlığı olmayan istek `403`
  alır. Değer Render'daki `N8N_SECRET` ile n8n'deki `Header Auth account` credential'ında **birebir
  aynı** olmalı; birini değiştirip diğerini unutmak Parçalayıcı'yı komple kırar.
- **`config.js`'teki `N8N_WEBHOOK` / `N8N_ANALYZE_WEBHOOK` değerleri kullanılmıyor.** `serve.py`
  onları her zaman kendi vekil uçlarıyla (`/api/n8n/split`, `/api/n8n/analyze`) eziyor. n8n'in gerçek
  adresleri sunucu tarafındaki aynı adlı ortam değişkenlerinden okunuyor — tanımsızsa `serve.py`
  sessizce `localhost:5678`'e düşer ve canlıda hiçbir şey çalışmaz.
- **Workflow dosyaları canlıdan sapabiliyor.** Canlı n8n'de elle yapılan değişiklikler repoya
  yansımıyor; bir kez `focusaid.json` OpenAI'da kalırken canlı Gemini'ye geçmişti. Canlının JSON'ını
  okumak için `/rest/` ucuna düz `fetch` atma — 401 verip oturumu düşürür, `browser-id` başlığı şart:
  `fetch('/rest/workflows/<ID>', {credentials:'include', headers:{'browser-id': localStorage.getItem('n8n-browserId')}})`
  ⚠️ Canlı workflow'u toptan kopyalayıp repoya yazma: `Save task to Supabase` node'unda gerçek
  `service_role` anahtarı duruyor.

## Landing page tuzakları

- **Sahne fotoğraflarında yapay zekânın uydurduğu SAHTE arayüz yazıları var.** Referans video
  AI üretimi; 2. ve 5. karede "Fina FrusArid with legret seot", "Landrcllum Page film" gibi
  bozuk metinler büyük puntoda duruyor. Çözüm CSS'te: o iki kareye `blur(5px)`, 5. karede blur
  yetmediği için `scale(1.34) translateY(-15%)` ile sahte başlık kadraj dışına itiliyor.
  **1, 3, 4 net kalmalı** — onlarda sahte yazı yok, bulanıklaştırma sadece kalite kaybı olur.
- **Gemini filigranı** videoda `(1136, 572)` konumunda ~50×54 px. Yeni kare çıkarırsan
  `delogo=x=1124:y=558:w=80:h=84` uygula, yoksa sayfaya Google'ın logosu gelir.
- **`.perdeler`e sabit `min-height` VERME.** Eskiden `392px`'di; başlık puntosu her
  değiştiğinde elle güncellenmesi gerekiyordu ve unutulduğunda içerik taşıp alttaki
  çentiklerin üstüne biniyordu (ölçüldü: sahne 2=449, 3=465, 5=501px). Perdeler artık aynı
  **grid hücresinde** yığılıyor (`display:grid` + `grid-area:1/1`); kutu en uzun sahneye göre
  kendiliğinden büyüyor. Mutlak konuma geri dönme.
- **Sahne geçişinde sönme ve belirme aynı anda olmamalı.** İkisi de `.5s` sürerken giden ve
  gelen sahne yarı yolda buluşup başlıklar fiziksel olarak üst üste biniyordu. Sönme `.26s`'de
  bitiyor, belirme `.26s` gecikmeyle başlıyor (gecikmeyi sürücü `transitionDelay` ile veriyor).
- **Açılış animasyonunu `requestAnimationFrame` ile tetikleme.** Sekme arka plandayken Chrome
  rAF'i donduruyor; sınıf hiç eklenmiyor ve bloklar `opacity:0`'da kilitli kalıyor.
  `setTimeout(..., 0)` kullan. Aynı sebeple **sahne sürücüsü de gizli sekmede ilerlemiyor** —
  otomasyonla uzaktan sahne gezmek güvenilmez, ölçüm yapacaksan
  `el.getAnimations({subtree:true}).forEach(a => { a.currentTime = 4000; a.pause(); })`.
- **Ekran görüntüsü aracı bu sayfada bayat kare veriyor** (opaklık GPU'da birleşiyor). DOM
  ölçümü doğruyu söylerken görüntü eski sahneyi gösterebiliyor. Çekmeden önce
  `window.scrollBy(0, 1)` ile boyamayı zorla.
- **Tasarım kimliği tek renk üzerine kurulu.** Zemin `#0E1219`, işaret rengi `#E2542C`, hepsi
  beş sahnede aynı. Sahnelere ayrı ayrı renk verme — duygu yolculuğunu fotoğraflar taşıyor.
  Fontlar Fraunces (başlık) + Archivo (gövde); mono font yok, rakamlar `tabular-nums`.

## Çalışma düzeni

- **Commit ve push**: kullanıcı istediğinde. Kendiliğinden commit atma. İzin geldiğinde iş
  `main`'e kadar gitmeli — Render `main`'den deploy ediyor, dalda bırakılan commit kullanıcı için
  "yapılmamış" demek. Dalda commit'le, sonra `main`'e fast-forward merge et, push et ve
  **deploy'u canlı URL'den doğrula**; "pushlandı" demekle iş bitmiyor.
- **Bu dosyanın güncellenmesi**: kullanıcı "CLAUDE.md'yi güncelle" dediğinde, günün işi bitince.
- Uzun oturumlardan kaçın; iş bitince `/clear`. Şişmiş bir oturuma geri dönmek çok pahalı.
