-- ═══════════════════════════════════════════════════════════
-- FocusAid — 🧠 Düşünce Parkı tablosu
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır (idempotent).
--
-- NEDEN: Düşünce Parkı yalnız localStorage'daydı; telefonda park edilen düşünce
-- bilgisayarda görünmüyordu. brain-dump.js artık buraya yazıyor, localStorage
-- yalnız önbellek (park etmek ağı beklemeden anında kalsın diye).
--
-- ORTAK PROJE: Bu Supabase ContentHub ile paylaşılıyor. Tablo YENİ ve yalnız
-- FocusAid kullanıyor; ContentHub'da `brain_dump` adında tablo/sorgu yok
-- (2026-10-07'de iki repo da tarandı). Mevcut hiçbir tabloya dokunmuyor.
--
-- id istemcide üretiliyor (crypto.randomUUID): yerel kopya ile satır aynı
-- kimliği taşıyor, yazma geri dönmeden de güncelleme/silme yapılabiliyor.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.brain_dump (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  completed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_dump_user_created_idx
  ON public.brain_dump (user_id, created_at DESC);

ALTER TABLE public.brain_dump ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kendi dusuncelerini gor" ON public.brain_dump;
CREATE POLICY "Kendi dusuncelerini gor" ON public.brain_dump
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Kendi dusuncesini ekle" ON public.brain_dump;
CREATE POLICY "Kendi dusuncesini ekle" ON public.brain_dump
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Kendi dusuncesini duzenle" ON public.brain_dump;
CREATE POLICY "Kendi dusuncesini duzenle" ON public.brain_dump
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Kendi dusuncesini sil" ON public.brain_dump;
CREATE POLICY "Kendi dusuncesini sil" ON public.brain_dump
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.brain_dump IS
  'FocusAid Düşünce Parkı. Yalnız FocusAid kullanır (ContentHub ile ortak projede).';
