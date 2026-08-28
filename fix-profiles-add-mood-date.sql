-- ═══════════════════════════════════════════════════════════
-- FocusAid — today_mood_date kolonu
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır.
--
-- NEDEN: `today_mood` "Bugün nasıl hissediyorsun" sorusunun cevabını
-- saklıyor ama TARİH DAMGASI YOKTU. Pazartesi "Beyin Sisi" seçildiyse değer
-- haftalarca kalıyor ve sonraki her planı sessizce küçültüyordu
-- (günlük seans -1). Kullanıcının bunu fark etmesi imkânsızdı.
--
-- NEDEN `updated_at` YETMİYOR: profilde HERHANGİ bir şey değişince
-- güncelleniyor. Salı günü mesai saatini değiştiren biri, pazartesiden
-- kalma modu "bugünkü" gibi göstermiş olurdu.
--
-- GÜVENLİ Mİ? Evet: yalnızca kolon ekleniyor, hiçbir şey düşürülmüyor veya
-- yeniden adlandırılmıyor. Mevcut satırlarda değer NULL kalır; uygulama
-- tarihi olmayan modu BAYAT sayar (moodForToday), yani eski satırlar
-- kendiliğinden doğru davranışa düşer.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS today_mood_date DATE;
