-- ═══════════════════════════════════════════════════════════
-- FocusAid — Günün Zafer Ödülü kolonları (cark_tarihi, cark_odulu)
-- Supabase Dashboard → SQL Editor'e yapıştır ve çalıştır.
--
-- NEDEN: 🎡 Dopamin Çarkı günde BİR kez dönmeli. Kayıt yalnızca tarayıcıda
-- (localStorage) dururken başka bir cihazdan / tarayıcıdan aynı gün yeniden
-- çevrilebiliyordu. Kayıt artık hesapta: çevirme hakkı tek bir koşullu
-- UPDATE ile "alınıyor" (cark_tarihi bugün değilse yaz), iki cihaz aynı anda
-- çevirse bile yalnızca biri kazanır.
--
-- ⚠️ profiles tablosu ContentHub ile ORTAK. 2026-10-06'da ContentHub tarandı:
-- yalnızca `name` okuyup yazıyor (app/profile/page.tsx, lib/profile.ts).
-- Burada sadece BOŞ GEÇİLEBİLİR kolon EKLENİYOR — hiçbir şey düşürülmüyor
-- veya yeniden adlandırılmıyor; mevcut satırlar NULL kalır (= çark açık).
--
-- RLS: mevcut "kendi satırını güncelle" politikası yeterli, yeni politika yok.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cark_tarihi DATE,
  ADD COLUMN IF NOT EXISTS cark_odulu  TEXT;
