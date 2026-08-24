# FocusAid — DEHB Odak Asistanı

DEHB'li kullanıcılar için yapay zeka destekli görev parçalama ve takvim planlama uygulaması. Bir görev tanımlarsın, n8n AI ajanı onu odaklanılabilir seanslarına böler ve Google Takvime otomatik ekler.

## 🌐 Canlı Demo

**[https://dehb-asistan.onrender.com](https://dehb-asistan.onrender.com)**

Google OAuth login, DEHB Bilgilendirme Platformu, "Bugün" ekranı, "Projelerim" ekranı ve Google Calendar entegrasyonu tam olarak canlıda çalışıyor. **Parçalayıcı** (AI görev-bölme) özelliği şu an yalnızca n8n'in yerel olarak çalıştırıldığı bir makineden erişilebiliyor — n8n'i buluta taşıma denemeleri (Render: RAM yetersizliği, Oracle Cloud: ARM kapasite darlığı) henüz sonuçsuz kaldı, bkz. [Bilinen Eksikler](#bilinen-eksikler).

Arayüz açık/koyu tema destekliyor (sidebar'daki 🌗 anahtarı, tercih hesaba kalıcı kaydediliyor). "Projelerim" sayfası, n8n'in parçaladığı görevleri proje bazında gruplayıp tek tıkla (bağlı Google Calendar etkinlikleriyle birlikte) silmeyi sağlıyor.

**Takvim** sayfası üç kolonlu: solda mini ay takvimi (büyük takvimle çift yönlü senkron) ve haftalık tamamlanma özeti, sağda ay/hafta görünümü. Hafta görünümündeki kartlar bilişsel yüke göre renklendiriliyor (hafif/orta/ağır) ve içerikleri görevin süresine göre seçiliyor — kısa görevlerde saat gizlenip başlık korunuyor, böylece hiçbir kart okunamaz hale gelmiyor. Bir güne tıklayınca o günün görevleri açılıyor; geçmiş günlere görev eklenemiyor ve gün zaten doluysa (5+ görev) uyarı veriliyor. Google Calendar'ın tüm gün süren etkinlikleri (tatil, izin vb.) hafta görünümünde üstteki "Tüm gün" şeridinde gösteriliyor. Yan paneldeki "+ Yeni Görev" mini takvimde seçili olan güne göre açılıyor.

Görev formunda tek bir **Ekle** butonu var; üstündeki **"🧩 AI ile parçalara böl"** kutusu varsayılan olarak açık ve hangi yolun izleneceğini belirliyor. İşaretliyse görev n8n'e gidip mikro adımlara bölünüyor; işaretli değilse tek görev olarak kaydediliyor. n8n'e ulaşılamıyorsa kutu form açılırken otomatik kapanıp kilitleniyor ve sebebi yazıyor — çalışmayan bir seçenek işaretli kalmıyor. (Erişilebilirlik yoklaması `HEAD` + `no-cors` ile yapılıyor: `POST` atmak gerçek bir workflow çalıştırırdı.)

Her iki yol da Supabase'i kaynak doğruluk kabul ediyor. Tek görev kaydında satır önce `tasks` tablosuna yazılıyor, Google Calendar bağlıysa etkinlik oraya da açılıp `calendar_event_id` ile eşleniyor (takvim bu alanla tekilleştirdiği için görev iki kez görünmüyor); bağlı değilse görev yine kaydediliyor ve kullanıcı bilgilendiriliyor. Böylece elle eklenen görev, n8n'in ürettiği görevlerle aynı veri modelinde: "Bugün" ve "Projelerim" ekranlarında da görünüyor.

## Nasıl Çalışır

```
Kullanıcı görev girer
  → n8n webhook tetiklenir
  → AI Agent (OpenAI) görevi mikro parçalara böler
  → Takvim etkinlikleri oluşturulur (Google Calendar)
  → Görevler Supabase'e kaydedilir
  → Tarayıcıda FullCalendar'da görünür
```

## Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Vanilla HTML/JS + Tailwind CSS + FullCalendar |
| Auth | Supabase (Google OAuth) |
| Otomasyon | n8n (yerel) |
| AI | OpenAI (n8n AI Agent node) |
| Veritabanı | Supabase (PostgreSQL) |

## Kurulum

### 1. Gereksinimler

- [n8n](https://n8n.io/) kurulu ve `http://localhost:5678` adresinde çalışıyor olmalı
- [Python](https://python.org) (HTTP server için)
- Supabase hesabı
- Google Cloud Console projesi (Calendar API + OAuth 2.0)

### 2. Konfigürasyon

`config.example.js` dosyasını `config.js` olarak kopyalayın ve kendi değerlerinizi girin:

```bash
cp config.example.js config.js
```

`config.js` içinde doldurulacak alanlar:

```js
const FOCUSAID_CONFIG = {
    SUPABASE_URL:      'https://PROJE_ID.supabase.co',
    SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY_BURAYA',
    GOOGLE_API_KEY:    'GOOGLE_API_KEY_BURAYA',
    GOOGLE_CLIENT_ID:  'CLIENT_ID.apps.googleusercontent.com',
    N8N_WEBHOOK:       'http://localhost:5678/webhook/focusaid-processor',
    // diğer alanlar varsayılan kalabilir
};
```

### 3. Supabase Kurulumu

`schema.sql` dosyasını Supabase SQL Editor'de çalıştırın.

Ardından `tasks` tablosuna gerekli kolonları ekleyin:

```sql
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cognitive_load TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_title TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS day DATE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
NOTIFY pgrst, 'reload schema';
```

### 4. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com) → yeni proje oluştur
2. **Calendar API**'yi etkinleştir
3. **OAuth 2.0 Client ID** oluştur (Web application)
4. Authorized redirect URI olarak Supabase callback URL'ini ekle:
   `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
5. Supabase Dashboard → Authentication → Providers → Google → Client ID ve Secret gir

### 5. n8n Workflow

Hazır workflow tanımlarını n8n'e import edin (n8n → Workflows → Import from File):

- `n8n-workflow-focusaid.json` — ana görev-bölme akışı, webhook path `focusaid-processor`
- `n8n-workflow-analyzer.json` — yönerge dosyası analiz akışı, webhook path `focusaid-analyze`

Import sonrası n8n'de kendi **Google Calendar credential**'ınızı oluşturmanız gerekir (aynı OAuth
client, ek redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`). Workflow'ları
**Active** olarak işaretlemeyi unutmayın.

Akış özeti:

```
Webhook → Get Calendar Events → Merge → AI Agent → Code Node → Loop → Create Event → Save to Supabase → Respond
```

AI Agent, deadline'dan geriye doğru `target_tasks = round(available_days × 0.6)` adet görev üretir;
tarih/saat yerleştirmesini Code node'daki algoritma yapar (LLM'e bırakılmaz).

### 6. Uygulamayı Başlat

```bash
python -m http.server 3000 --directory .
```

Tarayıcıda: `http://localhost:3000/auth.html`

## Dosya Yapısı

```
├── auth.html          # Google OAuth giriş sayfası
├── index.html         # Ana uygulama (Bugün + Takvim + Parçalayıcı + Projelerim + Profil + DEHB Bilgisi)
├── index_2.html       # index.html'e yönlendirme köprüsü (Supabase redirect URL'i buraya kayıtlı)
├── rapor.html         # Rapor bileşeni
├── tasks-logic.js     # Görev mantığı — DOM'suz, test edilebilir
├── tasks-view.js      # Görev ekranı render + Supabase/GAPI çağrıları
├── calendar-logic.js  # Takvim tarih hesapları (ay ızgarası, hafta aralığı) — DOM'suz
├── doc-intake-logic.js # Yönerge dosyası ayrıştırma mantığı — DOM'suz
├── doc-intake.js      # Yönerge dosyası yükleme arayüzü
├── serve.py           # Önbelleksiz geliştirme sunucusu (port 3000)
├── schema.sql         # Supabase veritabanı şeması
├── fix-tasks-*.sql    # tasks tablosu şema/RLS düzeltmeleri
├── n8n-workflow-*.json # n8n iş akışı tanımları
├── test/              # tasks-logic + doc-intake-logic + calendar-logic testleri (node --test)
├── config.example.js  # Konfigürasyon şablonu (bunu kopyala → config.js)
└── config.js          # Gerçek konfigürasyon (gitignored, paylaşma)
```

## Bilinen Eksikler

- **n8n prod'da çalışmıyor.** `N8N_WEBHOOK` yerel makineye (`localhost:5678`) işaret ediyor, yani
  Parçalayıcı özelliği yalnızca n8n'i kendi bilgisayarında açık tutan biri için çalışıyor. Buluta
  taşıma iki kez denendi ve ikisi de teknik sınırlara takıldı:
  - **Render:** Docker olarak deploy edildi, Supabase Postgres'e bağlandı, ama ücretsiz planın
    512MB RAM'i n8n için yetersiz kaldı ("JavaScript heap out of memory"); 2GB'lık Standard plan
    aylık ücretli.
  - **Oracle Cloud (Always Free ARM):** Kurulum tamamlandı ama Frankfurt bölgesindeki üç
    Availability Domain de saatlerce/günlerce kapasite dolu verdi — bilinen bir Oracle Free Tier
    sorunu, garantili bir çözüm süresi yok.
- Google access token ~1 saat sonra sürüyor; süresi dolduğunda "Google Takvimi Bağla" butonuna tekrar basmak gerekiyor (otomatik yenileme henüz yok — token sayfa yenilemeleri arasında localStorage'da kalıcı, ama süresi dolunca yeniden bağlanmak gerekiyor). Görev **kaydetmek** için bağlantı gerekmiyor (aşağıya bak); bağlantı yalnızca görevin Google Calendar'a da işlenmesi, tamamlandı/erteleme değişikliklerinin oraya yansıması ve FocusAid dışı etkinliklerin takvimde görünmesi için gerekli.
- Hafta görünümünün araç çubuğu ve gün adları İngilizce, hafta Pazar'dan başlıyor: kurulu
  `fullcalendar@6.1.8/index.global.min.js` paketi `locales:[]` ile geldiği için `locale:'tr'`
  sessizce İngilizceye düşüyor. Gerçek `tr` locale paketi eklenirse hafta başlangıcı (`firstDay`),
  mini takvim ve haftalık özet birlikte güncellenmeli.
