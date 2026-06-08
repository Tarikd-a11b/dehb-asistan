# FocusAid — Devam İnstructionu

Bu dosyayı bir sonraki sohbette Claude'a ver. Projenin tam bağlamını taşır.

---

## Projeye Genel Bakış

**FocusAid** — DEHB'li kullanıcılar için yapay zeka destekli görev parçalama ve takvim planlama uygulaması.
- Kullanıcı bir proje/görev tanımlar → n8n AI agent onu odak seanslarına böler → Google Takvime otomatik ekler → Supabase'e kaydeder
- Stack: vanilla HTML/JS + Tailwind CSS + FullCalendar + Supabase Auth + n8n (yerel) + OpenAI

---

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `C:\Users\bilal\Desktop\denemekod\index_2.html` | Ana uygulama (~900 satır, all-in-one) |
| `C:\Users\bilal\Desktop\denemekod\auth.html` | Google OAuth login sayfası |
| `C:\Users\bilal\Desktop\denemekod\schema.sql` | Supabase şema dosyası |

---

## Uygulamayı Başlatma

Her çalıştırmada HTTP server açık olmalı:
```bash
python -m http.server 3000 --directory C:\Users\bilal\Desktop\denemekod
```
Sonra tarayıcıda: `http://localhost:3000/auth.html`

n8n de açık olmalı: `http://localhost:5678`

---

## Supabase

- **URL:** `https://tigawsmrndalzvuyjycc.supabase.co`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZ2F3c21ybmRhbHp2dXlqeWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Nzg5NTYsImV4cCI6MjA5NDI1NDk1Nn0.K8-Rfk6AgxBDzk6GmPU11usEWIbqbVG3HmaeoV42emI`
- **Auth:** Google OAuth, `INITIAL_SESSION` event ile yönetiliyor
- **Tablolar:** `profiles` (✅), `tasks` (⚠️ — bkz. Bekleyen İşler)

---

## n8n Workflow

- **ID:** `KoSsoWH2tLfZszUC`
- **API Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhNTRjZTdkZi01YmE3LTQ3ZDAtYTQwYy04NjgzOTQ0NDEyZWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNWVmZmNmNjAtM2E0Mi00NDdjLThlYzEtYzIwNjQyYzhlNjBkIiwiaWF0IjoxNzgwODIxNzg4LCJleHAiOjE3ODMzOTY4MDB9.VDcgtIX579LvV_fyEYIpNOAr1v6FCVV9B9dn4VM8m8w`
- **Webhook:** `http://localhost:5678/webhook-test/focusaid-processor`

**Akış:**
```
Webhook → Get many events → Merge → AI Agent (OpenAI) 
  → Code in JavaScript → Loop Over Items 
  → Create an event → Save task to Supabase → Respond to Webhook
```

**AI Agent:** Deadline'dan geriye doğru `target_tasks = round(available_days × 0.6)` adet görev üretir. Her görev spesifik ve aksiyon odaklı.

**Code Node:** Görevleri proportional distribution algoritmasıyla tarihlere yayar. Her task item'ına `userId`, `supabaseToken`, `projectTitle` ekler.

**Save task to Supabase Node:** Her takvim etkinliği oluştuktan sonra Supabase `tasks` tablosuna POST atar. User JWT (Bearer token) ile auth yapar.

---

## Google Cloud Console

- **OAuth Client ID:** `967142942363-ikk9i91et27v9h4gtva0ln2f7s92rv9i.apps.googleusercontent.com`
- **Authorized redirect URI:** `https://tigawsmrndalzvuyjycc.supabase.co/auth/v1/callback`
- **Calendar API:** Etkin

---

## Bekleyen / Tamamlanmamış İşler

### 1. KRITIK — tasks tablosu kolonları eksik
Supabase SQL Editor'de şunu çalıştır:
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
> Not: `DROP TABLE CASCADE` denemedik çünkü `task_chunks` adlı bağımlı bir tablo var.
> Eğer `ALTER` de çalışmıyorsa, Supabase Table Editor'den tabloyu manuel düzenle.

### 2. tasks kaydını test et
Kolonlar düzeltilince workflow'u çalıştır ve Supabase Table Editor'de tasks tablosunu kontrol et.

### 3. provider_token yenileme (uzun vadeli)
Supabase'den gelen Google access token ~1 saat sonra sürüyor. Sürünce takvim boş görünür, kullanıcı "Google Takvimi Bağla" butonuna basmalı. İleride otomatik yenileme eklenebilir.

---

## Çözülmüş Sorunlar (Bu Oturumda)

- ✅ n8n scheduling bug: aynı saate çakışan görevler, atlanan günler
- ✅ AI görev kalitesi: çok genel görevler → spesifik, aksiyon odaklı
- ✅ Zaman dağılımı: kısa süreye sıkıştırma → deadline'a orantılı yayma
- ✅ Supabase auth entegrasyonu (Google OAuth)
- ✅ auth.html login sayfası oluşturuldu
- ✅ profiles tablosu + RLS + trigger
- ✅ JavaScript SyntaxError: `saveProfile()` async değildi, tüm script çalışmıyordu
- ✅ Takvim olayları yüklenmiyordu: FullCalendar Google plugin → gapi.client custom events
- ✅ OAuth redirect döngüsü: getSession() → INITIAL_SESSION event ile çözüldü
- ✅ Google Client Secret eksikti → eklendi
- ✅ n8n workflow'a "Save task to Supabase" node eklendi
