-- ═══════════════════════════════════════════════════════════
-- FocusAid — tasks tablosu eksik kolon düzeltmesi
-- PGRST204 "Could not find the 'user_id' column" hatası için.
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır (idempotent).
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id           UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_title     TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS name              TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS summary           TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cognitive_load    TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS day               DATE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_time        TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_time          TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed         BOOLEAN DEFAULT false;

-- PostgREST şema önbelleğini yenile (PGRST204'ün asıl tetikleyicisi)
NOTIFY pgrst, 'reload schema';
