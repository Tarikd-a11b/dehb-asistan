-- ═══════════════════════════════════════════════════════════
-- FocusAid — tasks tablosu RLS politikaları
-- 403 / 42501 "new row violates row-level security policy" için.
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır (idempotent).
-- Mantık: her kullanıcı yalnızca kendi görevlerini yazar/okur/düzenler/siler.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kendi görevlerini görüntüle" ON public.tasks;
DROP POLICY IF EXISTS "Kendi görevlerini ekle"      ON public.tasks;
DROP POLICY IF EXISTS "Kendi görevlerini düzenle"   ON public.tasks;
DROP POLICY IF EXISTS "Kendi görevlerini sil"       ON public.tasks;
DROP POLICY IF EXISTS "Service role görev ekleyebilir" ON public.tasks;

CREATE POLICY "Kendi görevlerini görüntüle" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Kendi görevlerini ekle" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kendi görevlerini düzenle" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Kendi görevlerini sil" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);
