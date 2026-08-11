# FocusAid — Claude Code notları

DEHB odak asistanı. Kullanıcı görev veya yönerge dosyası girer → n8n workflow'u görevi odak
seanslarına böler → Google Calendar'a ekler → Supabase `tasks` tablosuna yazar → "Bugün" ekranında
listelenir.

**Stack:** vanilla HTML/JS + Tailwind (CDN) + FullCalendar + Supabase (Google OAuth + Postgres) +
n8n (yerel, `localhost:5678`). Build adımı yok, paket yöneticisi yok — dosyalar doğrudan servis edilir.

Bu dosya elle güncellenir; kullanıcı "CLAUDE.md'yi güncelle" dediğinde yenilenir, her değişiklikte değil.
Son güncelleme: 2026-08-11.

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

n8n ayrı çalışır: `localhost:5678` açık olmalı, yoksa görev parçalama sessizce başarısız olur.

## Testler

```bash
node --test          # 30 test — kök dizinden, ARGÜMANSIZ
```

`node --test test/` Windows'ta MODULE_NOT_FOUND verir. Dizin yerine ya argümansız çalıştır ya da
dosyaları tek tek ver.

Test edilen: `tasks-logic.js` ve `doc-intake-logic.js` — ikisi de bilinçli olarak DOM'suz ve ağsız.
Yeni mantık yazarken bu ayrımı koru: saf hesap `*-logic.js`'e, DOM ve `fetch` `*-view.js` / `doc-intake.js`'e.

## Dosya düzeni

| dosya | rol |
|---|---|
| `auth.html` | Google OAuth giriş sayfası |
| `index.html` | **Tek uygulama dosyası** — tüm ekranlar içinde `<template>` olarak |
| `index_2.html` | `index.html`'e yönlendirme köprüsü — aşağıya bak, silme |
| `tasks-logic.js` / `tasks-view.js` | "Bugün" ekranı: saf mantık / DOM+ağ |
| `doc-intake-logic.js` / `doc-intake.js` | Yönerge dosyası yükleme: saf mantık / arayüz |
| `serve.py` | önbelleksiz geliştirme sunucusu |
| `schema.sql`, `fix-*.sql` | Supabase şeması ve düzeltmeleri |
| `n8n-workflow-*.json` | n8n workflow tanımları (yerel kopya) |
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

- **Takvim ay/hafta görünümünde event başlıkları görülmüyor.** Supabase'ten 109+ görev yükleniyor ve
  day-view modal'ında başlıklar doğru görülüyor, ama month/week görünümünde "Görev" yazılı kutular 
  olarak gösterilmiyor (FullCalendar CSS compact rendering). Çözüm: `.fc-event-title` stilini 
  override'lamak veya `eventContent` render function'ını kullanmak.
- **Tasks tablosu title kolonu.** n8n workflow'unda title'ı nasıl yazıldığı kontrol edilmedi; 
  description'a yazılıyor olabilir.

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
- **Google OAuth istemcisinde iki redirect URI birden olmalı:** Supabase callback (uygulama girişi) ve
  `http://localhost:5678/rest/oauth2-credential/callback` (n8n takvimi). Biri silinirse o akış komple kırılır.

## Çalışma düzeni

- **Commit ve push**: kullanıcı istediğinde. Kendiliğinden commit atma.
- **Bu dosyanın güncellenmesi**: kullanıcı "CLAUDE.md'yi güncelle" dediğinde, günün işi bitince.
- Uzun oturumlardan kaçın; iş bitince `/clear`. Şişmiş bir oturuma geri dönmek çok pahalı.
