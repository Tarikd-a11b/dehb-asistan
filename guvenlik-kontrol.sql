-- ═══════════════════════════════════════════════════════════
-- FocusAid — canlı veritabanı güvenlik kontrolü (SALT OKUNUR, hiçbir şey değiştirmez)
-- Supabase Dashboard → SQL Editor'e yapıştır, Run. Tek sorgu: SONUÇ BOŞ olmalı,
-- çıkan her satır bir bulgudur. (Supabase ContentHub ile ortak: yalnız FocusAid
-- tablolarına bakıyor.)
--
--  acik_politika    USING (true) / WITH CHECK (true) ya da anon/public'e yazma izni.
--                   schema.sql'deki eski "WITH CHECK (true)" insert politikası
--                   fix-tasks-rls.sql ile kaldırılmıştı; kalktıysa burada çıkmaz.
--  rls_kapali       RLS kapalı ya da hiç politikası olmayan tablo.
--  definer_yolsuz   search_path'i sabitlenmemiş SECURITY DEFINER fonksiyon (ör. yeni
--                   kullanıcıya profil açan trigger). Düzeltmesi:
--                   ALTER FUNCTION public.<ad>() SET search_path = public, pg_temp;
-- ═══════════════════════════════════════════════════════════
WITH tablolar(ad) AS (VALUES ('tasks'), ('profiles'), ('brain_dump'), ('room_sessions'), ('room_reports'))
SELECT 'acik_politika' AS bulgu, tablename || ' / ' || policyname AS nesne,
       cmd || ' roles=' || roles::text || ' using=' || coalesce(qual, '-') || ' check=' || coalesce(with_check, '-') AS ayrinti
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN (SELECT ad FROM tablolar)
  AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true'
       OR (cmd <> 'SELECT' AND roles && ARRAY['anon', 'public']::name[]))
UNION ALL
SELECT 'rls_kapali', t.ad,
       'tablo_var=' || (c.oid IS NOT NULL) || ' rls=' || coalesce(c.relrowsecurity::text, '-')
FROM tablolar t
LEFT JOIN pg_class c ON c.relname = t.ad AND c.relkind = 'r'
  AND c.relnamespace = 'public'::regnamespace
WHERE c.oid IS NULL OR NOT c.relrowsecurity
   OR NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.ad)
UNION ALL
SELECT 'definer_yolsuz', p.proname,
       'anon_calistirabilir=' || has_function_privilege('anon', p.oid, 'EXECUTE')
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
  AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%');
