-- ═══════════════════════════════════════════════════════════
-- FocusAid — 🟢 Canlı çalışma odaları (2026-10-13)
-- Spec: docs/superpowers/specs/2026-10-13-canli-calisma-odalari-design.md
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır (idempotent).
--
-- room_sessions : kişinin odada geçirdiği her oturum (hedef, süre, hedefe ulaştı mı).
--                 serve.py günlük üst sınırı bunun bugünkü toplamından hesaplıyor
--                 (kullanıcının KENDİ token'ıyla; RLS yalnız kendi satırlarını verir).
-- room_reports  : "Bildir" — kullanıcı yalnız EKLEYEBİLİR, kimse okuyamaz
--                 (okuma yalnız service_role / Dashboard'dan; moderasyon elle).
-- profiles.room_consent_at : ilk girişteki KVKK onayının zamanı.
--
-- ORTAK PROJE: tablolar YENİ ve yalnız FocusAid kullanıyor; profiles'a yalnız
-- NULL olabilen bir kolon ekleniyor.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.room_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  room             TEXT NOT NULL CHECK (room IN ('canli-kutuphane', 'canli-sabah', 'canli-gece')),
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at          TIMESTAMPTZ,
  active_seconds   INT NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  focus_seconds    INT NOT NULL DEFAULT 0 CHECK (focus_seconds >= 0),
  break_seconds    INT NOT NULL DEFAULT 0 CHECK (break_seconds >= 0),
  planned_minutes  INT CHECK (planned_minutes IS NULL OR planned_minutes BETWEEN 1 AND 600),
  goal             TEXT CHECK (goal IS NULL OR char_length(goal) <= 80),
  goal_met         TEXT CHECK (goal_met IN ('yes', 'partly', 'no')),
  task_id          UUID REFERENCES public.tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS room_sessions_user_joined_idx
  ON public.room_sessions (user_id, joined_at DESC);

ALTER TABLE public.room_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kendi oda oturumlarini gor" ON public.room_sessions;
CREATE POLICY "Kendi oda oturumlarini gor" ON public.room_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Kendi oda oturumunu ekle" ON public.room_sessions;
CREATE POLICY "Kendi oda oturumunu ekle" ON public.room_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Kendi oda oturumunu duzenle" ON public.room_sessions;
CREATE POLICY "Kendi oda oturumunu duzenle" ON public.room_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Kendi oda oturumunu sil" ON public.room_sessions;
CREATE POLICY "Kendi oda oturumunu sil" ON public.room_sessions
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.room_sessions IS
  'FocusAid canlı çalışma odası oturumları. Yalnız FocusAid kullanır (ContentHub ile ortak projede).';


CREATE TABLE IF NOT EXISTS public.room_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id  UUID,
  reported_name     TEXT CHECK (reported_name IS NULL OR char_length(reported_name) <= 60),
  room              TEXT NOT NULL,
  reason            TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.room_reports ENABLE ROW LEVEL SECURITY;

-- Yalnız ekleme. SELECT/UPDATE/DELETE politikası YOK → anon/authenticated okuyamaz.
DROP POLICY IF EXISTS "Bildirim ekle" ON public.room_reports;
CREATE POLICY "Bildirim ekle" ON public.room_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

COMMENT ON TABLE public.room_reports IS
  'FocusAid canlı oda bildirimleri. Yalnız Dashboard/service_role okur.';


ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS room_consent_at TIMESTAMPTZ;


-- Doğrulama (çalıştırınca 3 satır dönmeli):
SELECT 'room_sessions' AS nesne, count(*)::text AS politika FROM pg_policies WHERE tablename = 'room_sessions'
UNION ALL
SELECT 'room_reports', count(*)::text FROM pg_policies WHERE tablename = 'room_reports'
UNION ALL
SELECT 'profiles.room_consent_at', data_type FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'room_consent_at';
