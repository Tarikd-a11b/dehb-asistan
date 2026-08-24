-- ═══════════════════════════════════════════════════════════
-- FocusAid — Google refresh token kolonu
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır (idempotent).
--
-- NEDEN: Google access token'ı ~1 saat yaşıyor ve tarayıcı onu tek başına
-- yenileyemiyor (yenileme client secret ister, secret tarayıcıya konulamaz).
-- Refresh token'ı burada saklayıp yenilemeyi serve.py'deki /api/google/refresh
-- uç noktasına yaptırıyoruz; kullanıcı her saat başı takvimi elle bağlamıyor.
--
-- GÜVENLİK: Kolon `profiles` tablosunda, yani zaten var olan RLS politikaları
-- geçerli — bir kullanıcı YALNIZCA kendi satırını okuyup yazabiliyor
-- ("Kendi profilini görüntüle" / "Kendi profilini düzenle", bkz. schema.sql).
-- Token hiçbir zaman başka bir kullanıcıya görünmüyor.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

COMMENT ON COLUMN public.profiles.google_refresh_token IS
  'Google OAuth refresh token. access_type=offline ile giriste alinir, '
  'serve.py /api/google/refresh uc noktasi bununla yeni access token uretir.';
