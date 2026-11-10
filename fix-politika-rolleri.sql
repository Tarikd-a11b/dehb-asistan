-- ═══════════════════════════════════════════════════════════
-- FocusAid — guvenlik-kontrol.sql bulgularının kapatılması. Idempotent.
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır.
--
-- 1) acik_politika: yazma politikaları roles={public} ile tanımlıydı. Koşulları
--    auth.uid() = user_id olduğu için anon (uid NULL) zaten geçemiyordu — sızıntı
--    yok. Yine de politikayı yalnız giriş yapmış rol için tanımlamak savunmada
--    ikinci kat: koşul ileride gevşetilirse anon otomatik açılmaz.
-- 2) definer_yolsuz: trigger_discovery_on_new_interest (ContentHub, ortak proje)
--    SECURITY DEFINER ama search_path'i sabit değildi. Yeni ContentHub şemasındaki
--    (ayirma/sema.sql) gibi sabitlenir; tetikleyici dışında çağrılmasın diye
--    EXECUTE geri alınır (tetikleyiciler çalışırken EXECUTE yetkisine bakılmaz).
-- ═══════════════════════════════════════════════════════════

ALTER POLICY "Kendi görevlerini düzenle"   ON public.tasks         TO authenticated;
ALTER POLICY "Kendi görevlerini ekle"      ON public.tasks         TO authenticated;
ALTER POLICY "Kendi görevlerini sil"       ON public.tasks         TO authenticated;
ALTER POLICY "Bildirim ekle"               ON public.room_reports  TO authenticated;
ALTER POLICY profiles_insert_own           ON public.profiles      TO authenticated;
ALTER POLICY profiles_update_own           ON public.profiles      TO authenticated;
ALTER POLICY "Kendi oda oturumunu duzenle" ON public.room_sessions TO authenticated;
ALTER POLICY "Kendi oda oturumunu ekle"    ON public.room_sessions TO authenticated;
ALTER POLICY "Kendi oda oturumunu sil"     ON public.room_sessions TO authenticated;
ALTER POLICY "Kendi dusuncesini duzenle"   ON public.brain_dump    TO authenticated;
ALTER POLICY "Kendi dusuncesini ekle"      ON public.brain_dump    TO authenticated;
ALTER POLICY "Kendi dusuncesini sil"       ON public.brain_dump    TO authenticated;

ALTER FUNCTION public.trigger_discovery_on_new_interest() SET search_path = public, extensions, pg_temp;
REVOKE ALL ON FUNCTION public.trigger_discovery_on_new_interest() FROM PUBLIC, anon, authenticated;

-- Doğrulama: guvenlik-kontrol.sql'i yeniden çalıştır → 0 satır dönmeli.
