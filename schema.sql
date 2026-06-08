-- ═══════════════════════════════════════════════════════════
-- FocusAid — Supabase Schema
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır
-- ═══════════════════════════════════════════════════════════

-- 1. Profiles tablosu (auth.users ile bağlantılı)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email             TEXT,
  full_name         TEXT,
  avatar_url        TEXT,

  -- DEHB Profili
  focus_period      INTEGER     DEFAULT 25,
  work_start        TEXT        DEFAULT '09:00',
  work_end          TEXT        DEFAULT '18:00',
  energy_peak       TEXT        DEFAULT 'morning',
  medication        BOOLEAN     DEFAULT false,
  social            TEXT        DEFAULT 'solo',
  focus_trigger     TEXT        DEFAULT 'silence',
  motivation_note   TEXT        DEFAULT '',
  main_obstacle     TEXT        DEFAULT 'paralysis',
  break_style       TEXT        DEFAULT 'pomodoro',
  today_mood        TEXT        DEFAULT '',
  hyperfocus_limit  TEXT        DEFAULT 'none',
  light_sensitivity INTEGER     DEFAULT 2,
  sound_sensitivity INTEGER     DEFAULT 2,
  env_pref          TEXT        DEFAULT 'minimal',
  rsd_level         INTEGER     DEFAULT 2,
  regulation_method TEXT        DEFAULT 'breathing',
  stim_pref         TEXT        DEFAULT 'fidget',
  superpowers       JSONB       DEFAULT '[]',

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security: her kullanıcı yalnızca kendi profilini görebilir/düzenleyebilir
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kendi profilini görüntüle"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Kendi profilini düzenle"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Profil oluştur"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Yeni kullanıcı kaydında otomatik profil oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. updated_at otomatik güncelle
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════
-- 5. Tasks tablosu (n8n'in oluşturduğu görevler)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tasks (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_title     TEXT,
  name              TEXT        NOT NULL,
  summary           TEXT,
  cognitive_load    TEXT,
  day               DATE,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  calendar_event_id TEXT,
  completed         BOOLEAN     DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: kullanıcı sadece kendi görevlerini görür
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kendi görevlerini görüntüle"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Kendi görevlerini düzenle"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Kendi görevlerini sil"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- n8n (service_role ile) her kullanıcı için görev ekleyebilir
CREATE POLICY "Service role görev ekleyebilir"
  ON public.tasks FOR INSERT
  WITH CHECK (true);
