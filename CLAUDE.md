# FocusAid — Claude Code notları

DEHB odak asistanı. Kullanıcı görev veya yönerge dosyası girer → n8n workflow'u görevi odak
seanslarına böler → Google Calendar'a ekler → Supabase `tasks` tablosuna yazar → "Bugün" ekranında
listelenir.

**Stack:** vanilla HTML/JS + Tailwind (CDN) + FullCalendar + Supabase (Google OAuth + Postgres) +
n8n (**Oracle Cloud'da self-hosted**, `https://focusaid-n8n.duckdns.org`) + Google Gemini.
Build adımı yok, paket yöneticisi yok — dosyalar doğrudan servis edilir.

`serve.py` hem yerel geliştirme sunucusu hem de Render'daki üretim sunucusu: statik dosyaları
servis eder, `config.js`'i ortam değişkenlerinden üretir, Google token'ını yeniler ve n8n'e
giden istekleri vekiller.

Bu dosya elle güncellenir; kullanıcı "CLAUDE.md'yi güncelle" dediğinde yenilenir, her değişiklikte değil.
Son güncelleme: 2026-08-29.

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

```bash
node --test          # 126 test — kök dizinden, ARGÜMANSIZ
```

`node --test test/` Windows'ta MODULE_NOT_FOUND verir. Dizin yerine ya argümansız çalıştır ya da
dosyaları tek tek ver.

Test edilen: `tasks-logic.js`, `doc-intake-logic.js`, `calendar-logic.js`, `profile-logic.js`,
`scheduling-logic.js` — beşi de bilinçli olarak
DOM'suz ve ağsız. Yeni mantık yazarken bu ayrımı koru: saf hesap `*-logic.js`'e, DOM ve `fetch`
`*-view.js` / `doc-intake.js`'e.

## Profil

2026-08-29'da 18 alandan 11'e indirildi. Planlamaya **gerçekten etki eden** alanlar:

| alan | etkisi |
|---|---|
| `focusPeriod`, `workHours`, `breakStyle` | günde kaç odak seansı sığdığı (n8n `Normalize & Calculate`) |
| `todayMood` | `foggy`/`crash`/`anxious` → kapasite −1; `hyper`/`focused` → +1 |
| `mainObstacle` | AI prompt'una girer |
| `lightSensitivity` | **koyu tema hafızası** — arayüzde kartı yok ama alan duruyor; silersen tema tercihi cihazlar arası kaybolur |

`social`, `focusTrigger`, `hyperfocusLimit`, `motivationNote`, `superpowers` toplanıp n8n'e gidiyor
ama henüz bir karşılığı yok. `medication`, `rsdLevel`, `soundSensitivity`, `envPref`,
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

`Prepare Supabase Payload` takvim olaylarıyla görevleri **indeks eşleşmesiyle** birleştirir
(`events.map((item,i) => tasks[i])`). `Code in JavaScript` çıktısını filtreleyen ya da yeniden
sıralayan bir şey eklersen görevler yanlış takvim etkinliğine bağlanır.

## Dosya düzeni

| dosya | rol |
|---|---|
| `auth.html` | Google OAuth giriş sayfası |
| `index.html` | **Tek uygulama dosyası** — tüm ekranlar içinde `<template>` olarak |
| `index_2.html` | `index.html`'e yönlendirme köprüsü — aşağıya bak, silme |
| `tasks-logic.js` / `tasks-view.js` | "Bugün" ekranı: saf mantık / DOM+ağ |
| `calendar-logic.js` | Takvim tarih hesapları (ay ızgarası, hafta aralığı) — DOM'suz |
| `profile-logic.js` | Profil alanları, doluluk hesabı, n8n'e giden `planningProfile()` — DOM'suz |
| `scheduling-logic.js` | Gün ataması ve gün içi bilişsel yük sıralaması — **tarayıcıda yüklenmez**, gövdesi n8n `Code in JavaScript` node'una kopyalanır |
| `doc-intake-logic.js` / `doc-intake.js` | Yönerge dosyası yükleme: saf mantık / arayüz |
| `dehb-info.js` | DEHB Bilgilendirme Platformu içeriği |
| `serve.py` | uygulama sunucusu: statik + config enjeksiyonu + n8n vekili + `/api/google/refresh` |
| `schema.sql`, `fix-*.sql` | Supabase şeması ve düzeltmeleri |
| `n8n-workflow-*.json` | n8n workflow tanımları — canlı n8n ile senkron tutulmalı |
| `infra/n8n/` | n8n sunucusunun kurulum kiti (Oracle + Docker + Caddy + `KURULUM.md`) |
| `render.yaml` | Render yapılandırması ve ortam değişkeni listesi (servisi yönetmez) |
| `config.js` | **gitignored** — Supabase/Google anahtarları; şablonu `config.example.js` |

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
- **Render ücretsiz planı uykuya geçiyor**; ilk istek 50 saniyeye kadar gecikebiliyor. Bu yüzden
  takvimin otomatik bağlanması normalde ~7 sn sürerken soğuk açılışta ~14 sn'yi bulabiliyor.
  Ölçüm yaparken sabırsız olma, "takvim bozuk" diye yanlış teşhis koymak kolay.

**Çözülmüş (eski notlar kaldırıldı):** ay/hafta görünümünde başlıkların görünmemesi `eventContent`
render fonksiyonuyla çözüldü; `tasks` tablosuna başlığın nasıl yazıldığı da netleşti —
`Prepare Supabase Payload` node'u `name` alanına yazıyor.

## Tuzaklar

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

## Çalışma düzeni

- **Commit ve push**: kullanıcı istediğinde. Kendiliğinden commit atma.
- **Bu dosyanın güncellenmesi**: kullanıcı "CLAUDE.md'yi güncelle" dediğinde, günün işi bitince.
- Uzun oturumlardan kaçın; iş bitince `/clear`. Şişmiş bir oturuma geri dönmek çok pahalı.
