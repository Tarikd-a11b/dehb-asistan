-- ═══════════════════════════════════════════════════════════
-- FocusAid — tasks tablosu şema hizalama
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır (idempotent).
--
-- SORUN: Canlı tasks tablosu İKİ NESİL kolon taşıyor.
--   Eski nesil (tablonun ilk sürümünden): user_email, title, description,
--     deadline, status  → ne n8n ne de ön yüz bunları kullanıyor.
--   Yeni nesil (fix-tasks-columns.sql ile eklendi): user_id, name, summary,
--     cognitive_load, day, start_time, end_time, calendar_event_id, completed,
--     project_title  → aktif olarak kullanılanlar.
--
-- Eski `title` kolonu NOT NULL kaldığı için, `name` yazan ama `title`
-- yazmayan n8n insert'i 23502 ile patlıyordu. Bu, service_role anahtarı
-- eksikliğinin YANINDA ikinci bir engeldi.
--
-- Repo'daki schema.sql zaten doğru hedefi tarif ediyor (title yok).
-- Bu betik canlı şemayı ona hizalar.
-- ═══════════════════════════════════════════════════════════

-- ── BÖLÜM 1 — ZORUNLU: title kısıtını kaldır ────────────────
-- Tek başına n8n insert'ini ve ön yüz test verisini geçirmeye yeter.
-- Geri dönüşü kolay, veri kaybı yok.
ALTER TABLE public.tasks ALTER COLUMN title DROP NOT NULL;


-- ── BÖLÜM 2 — OPSİYONEL: ölü kolonları temizle ──────────────
-- DİKKAT: DROP COLUMN geri alınamaz. Yalnızca bu kolonlarda saklamak
-- istediğin veri YOKSA çalıştır. (2026-07-26 itibarıyla tablo boştu,
-- bu yüzden kayıp riski yoktu.)
-- Önce kontrol et:
--   select count(*) from public.tasks where title is not null
--      or user_email is not null or description is not null
--      or deadline is not null;
-- Sonuç 0 ise güvenle çalıştırabilirsin:

ALTER TABLE public.tasks DROP COLUMN IF EXISTS title;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS user_email;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS description;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS deadline;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS status;


-- ── BÖLÜM 3 — user_id güvenliği ─────────────────────────────
-- RLS politikaları auth.uid() = user_id üzerine kurulu. user_id NULL
-- kalırsa o satırı hiç kimse okuyamaz (sessizce kaybolur).
-- schema.sql bunu NOT NULL tanımlıyor, canlıda nullable kalmış.
ALTER TABLE public.tasks ALTER COLUMN user_id SET NOT NULL;


-- ── PostgREST şema önbelleğini yenile ───────────────────────
NOTIFY pgrst, 'reload schema';


-- ── DOĞRULAMA ───────────────────────────────────────────────
-- Beklenen: yalnızca yeni nesil kolonlar; user_id NO, diğerleri YES.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks'
order by ordinal_position;
