-- ═══════════════════════════════════════════════════════════
-- FocusAid — "Bildir" (room_reports) spam sınırı. Idempotent.
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır.
--
-- NEDEN: room_reports'a yalnız ekleme yapılabiliyor (doğru), ama sayı sınırı
-- yoktu: giriş yapmış biri döngüyle binlerce satır basıp tabloyu ve elle
-- moderasyonu boğabilirdi. Ayrıca `room` sütunu serbest metindi.
--
-- Sınır: kişi başı saatte 10 bildirim. Aşan insert açık bir mesajla P0001 hatası
-- alır; arayüz (live-rooms.js) hatayı zaten yakalayıp "gönderilemedi" diyor.
--
-- ⚠️ Fonksiyon SECURITY DEFINER olmak ZORUNDA: room_reports'ta SELECT politikası
-- yok, kullanıcının kendi yetkisiyle sayım her zaman 0 dönerdi (RLS) ve sınır
-- hiç çalışmazdı. search_path bu yüzden sabit.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.room_reports_sinir()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT count(*) FROM public.room_reports
      WHERE reporter_id = NEW.reporter_id
        AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'Bildirim sınırı: saatte en fazla 10';
  END IF;
  RETURN NEW;
END;
$$;

-- Tetikleyici dışında çağrılmasın.
REVOKE ALL ON FUNCTION public.room_reports_sinir() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS room_reports_sinir ON public.room_reports;
CREATE TRIGGER room_reports_sinir
  BEFORE INSERT ON public.room_reports
  FOR EACH ROW EXECUTE FUNCTION public.room_reports_sinir();

-- room yalnız bilinen odalar (room_sessions'taki kısıt + arayüzün oda bilinmediğinde
-- yazdığı 'bilinmiyor'). Mevcut satırlarda başka değer varsa bu adım hata verir:
-- önce  SELECT DISTINCT room FROM public.room_reports;  ile bak.
ALTER TABLE public.room_reports DROP CONSTRAINT IF EXISTS room_reports_room_check;
ALTER TABLE public.room_reports ADD CONSTRAINT room_reports_room_check
  CHECK (room IN ('canli-kutuphane', 'canli-sabah', 'canli-gece', 'bilinmiyor'));

-- Doğrulama: 1 satır dönmeli (tetikleyici var).
SELECT tgname FROM pg_trigger WHERE tgname = 'room_reports_sinir';
