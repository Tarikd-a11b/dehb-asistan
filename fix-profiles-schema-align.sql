-- ═══════════════════════════════════════════════════════════
-- FocusAid — profiles tablosu şema hizalama
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır.
--
-- SORUN (2026-08-24'te keşfedildi): Canlı `profiles` tablosu, repo'daki
-- schema.sql ile UYUŞMUYOR. Canlıda yalnızca üç kolon vardı:
--     user_id (PK), name, created_at
-- Oysa uygulamanın tamamı `id` anahtarını ve DEHB profil alanlarını bekliyor:
--     loadProfileFromSupabase  → .eq('id', currentUser.id)
--     saveProfileToSupabase    → upsert({ id, email, focus_period, ... })
--     n8n haftalik rapor       → select=id,email,motivation_note
--
-- SONUÇ: Profil okuma "column profiles.id does not exist" (42703) ile
-- sessizce patlıyordu; `loadProfileFromSupabase` hatayı yutup erken dönüyor,
-- bu yüzden kimse fark etmemiş. Pratikte:
--   • DEHB profil ayarları yalnızca localStorage'da (tarayıcıya bağlı) kalıyor,
--   • koyu tema tercihi (light_sensitivity) hesaba hiç yazılmıyor,
--   • n8n haftalık rapor akışı profilleri hiç çekemiyor.
--
-- GÜVENLİ Mİ? Evet, çalıştırmadan önce canlı şema tek tek kontrol edildi:
--   • Kısıtlar: profiles_pkey PRIMARY KEY (user_id),
--               profiles_user_id_fkey FOREIGN KEY (user_id) → auth.users(id).
--     Postgres'te ikisi de RENAME'i kendiliğinden takip eder.
--   • Tetikleyici YOK: `profiles` üzerinde tetikleyici ya da gövdesinde
--     'profiles' geçen fonksiyon sorgusu 0 satır döndü — yani kayıt sırasında
--     otomatik profil ekleyen bir tetikleyici bu kurulumda bulunmuyor.
--   • RLS politikaları da kolon adını takip eder (parse edilmiş halde saklanır).
--   • Repo'da `profiles.user_id` okuyan tek bir yer bile yok.
--
-- Veri kaybı yok: hiçbir kolon düşürülmüyor, yalnızca bir yeniden adlandırma
-- ve eksik kolonların eklenmesi var.
-- ═══════════════════════════════════════════════════════════

-- ── 1) Anahtar kolonu uygulamanın beklediği ada getir ──────
-- Zaten `id` ise bu satır hata verir; o durumda atlayıp 2. bölüme geç.
ALTER TABLE public.profiles RENAME COLUMN user_id TO id;

-- ── 2) Uygulamanın yazdığı/okuduğu eksik kolonlar ──────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email             TEXT,
  ADD COLUMN IF NOT EXISTS full_name         TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url        TEXT,
  ADD COLUMN IF NOT EXISTS focus_period      INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS work_start        TEXT    DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS work_end          TEXT    DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS energy_peak       TEXT    DEFAULT 'morning',
  ADD COLUMN IF NOT EXISTS medication        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS social            TEXT    DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS focus_trigger     TEXT    DEFAULT 'silence',
  ADD COLUMN IF NOT EXISTS motivation_note   TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS main_obstacle     TEXT    DEFAULT 'paralysis',
  ADD COLUMN IF NOT EXISTS break_style       TEXT    DEFAULT 'pomodoro',
  ADD COLUMN IF NOT EXISTS today_mood        TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS hyperfocus_limit  TEXT    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS light_sensitivity INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS sound_sensitivity INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS env_pref          TEXT    DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS rsd_level         INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS regulation_method TEXT    DEFAULT 'breathing',
  ADD COLUMN IF NOT EXISTS stim_pref         TEXT    DEFAULT 'fidget',
  ADD COLUMN IF NOT EXISTS superpowers       JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- ── 3) Doğrulama ───────────────────────────────────────────
-- Bu sorgu `id` ve `google_refresh_token` dahil tüm kolonları listelemeli.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'profiles'
--  ORDER BY ordinal_position;
