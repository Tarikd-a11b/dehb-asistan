# FocusAid — DEHB Odak Asistanı

DEHB'li kullanıcılar için yapay zeka destekli görev parçalama ve takvim planlama uygulaması. Bir görev tanımlarsın, n8n AI ajanı onu odaklanılabilir seanslarına böler ve Google Takvime otomatik ekler.

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
    N8N_WEBHOOK:       'http://localhost:5678/webhook-test/focusaid-processor',
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

`n8n-logic.js` dosyasındaki akışı referans alarak n8n'de workflow oluşturun:

```
Webhook → Get Calendar Events → Merge → AI Agent → Code Node → Loop → Create Event → Save to Supabase → Respond
```

- Webhook path: `focusaid-processor`
- AI Agent, deadline'dan geriye doğru `target_tasks = round(available_days × 0.6)` adet görev üretir

### 6. Uygulamayı Başlat

```bash
python -m http.server 3000 --directory .
```

Tarayıcıda: `http://localhost:3000/auth.html`

## Dosya Yapısı

```
├── auth.html          # Google OAuth giriş sayfası
├── index_2.html       # Ana uygulama (chatbot + takvim + profil)
├── calendar.html      # Takvim bileşeni
├── chatbot.html       # AI sohbet bileşeni
├── profile.html       # Kullanıcı profil bileşeni
├── rapor.html         # Rapor bileşeni
├── app-core.js        # Ortak JS modülleri
├── n8n-logic.js       # n8n entegrasyon mantığı
├── profile.js         # Profil yönetimi
├── style.css          # Ek stiller
├── schema.sql         # Supabase veritabanı şeması
├── config.example.js  # Konfigürasyon şablonu (bunu kopyala → config.js)
└── config.js          # Gerçek konfigürasyon (gitignored, paylaşma)
```

## Bilinen Eksikler

- Google access token ~1 saat sonra sürüyor; sürdüğünde "Google Takvimi Bağla" butonuna basmak gerekiyor (otomatik yenileme henüz yok)
- n8n yerel çalıştığı için mobil erişim mevcut değil
