-- FocusAid — çalışma analizi ve süre kalibrasyonu (2026-10-12)
-- Spec: docs/superpowers/specs/2026-10-12-calisma-analizi-kalibrasyon-design.md
-- Supabase SQL Editor'de KULLANICI çalıştırır. Tekrar çalıştırmak güvenli (IF NOT EXISTS).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS running_since       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_seconds      INT,
  ADD COLUMN IF NOT EXISTS longest_stretch_sec INT,
  ADD COLUMN IF NOT EXISTS actual_minutes      INT,
  ADD COLUMN IF NOT EXISTS duration_feedback   TEXT
    CHECK (duration_feedback IN ('shorter', 'same', 'longer')),
  ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ,
  -- n8n'in bloğa uyguladığı süre çarpanı (40 dk = 25 × 1.6 → 1.6). Analiz örneği
  -- bununla çarpılır; NULL (tek "Ekle" yolu, eski satırlar) = 1.
  ADD COLUMN IF NOT EXISTS planned_factor      NUMERIC;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calibration JSONB;

-- Analiz sorgusu: user_id + completed_at aralığı
CREATE INDEX IF NOT EXISTS tasks_user_completed_at_idx
  ON public.tasks (user_id, completed_at);

-- Doğrulama (çalıştırınca 9 satır dönmeli: tasks'tan 8, profiles'tan 1):
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'tasks' AND column_name IN
        ('started_at','running_since','active_seconds','longest_stretch_sec',
         'actual_minutes','duration_feedback','completed_at','planned_factor'))
    OR (table_name = 'profiles' AND column_name = 'calibration'))
ORDER BY table_name, column_name;
