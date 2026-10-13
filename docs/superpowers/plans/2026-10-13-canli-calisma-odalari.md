# Canlı çalışma odaları — uygulama planı

Spec: `docs/superpowers/specs/2026-10-13-canli-calisma-odalari-design.md` · Dal: `canli-odalar`

| # | Görev | Dosyalar | Doğrulama |
|---|---|---|---|
| 1 | Saf mantık: oda listesi, süre seçenekleri, kişisel sayaç fazları, boşta durumu, `userData` temizleme, kalan kota, seans güncellemesi | `live-rooms-logic.js`, `test/live-rooms-logic.test.js` | `node --test` |
| 2 | SQL: `room_sessions` + 4 RLS, `room_reports` (yalnız insert), `profiles.room_consent_at` | `add-room-sessions.sql` | kullanıcı SQL Editor'de çalıştırır |
| 3 | Sunucu: `POST /api/rooms/token`, `GET /api/rooms/presence` (kimlik + beyaz liste + günlük limit + 15 sn önbellek), Daily REST yardımcıları | `serve.py`, `test/test_serve_rooms.py`, CI adımı, `render.yaml` | `python -m unittest` |
| 4 | Daily'de 3 kalıcı oda (idempotent) | `scripts/daily-odalar.mjs` | anahtar gelince çalıştırılır |
| 5 | Arayüz: lobi kartları, giriş paneli (hedef/görev/süre/kamera/KVKK), body seviyesinde tam/mini oda katmanı, ızgara, kişisel sayaç + mola/devam/bitir, boşta kontrolü, 60 sn kalp atışı, çıkış sorusu, gizle/bildir | `live-rooms.js`, `index.html`, `study-rooms.js` | UI testi |
| 6 | Analiz kartına haftalık oda satırı | `analysis-logic.js`, `analysis-view.js`, test | `node --test` |
| 7 | UI testi (sahte Daily nesnesi): giriş, kamerasız kart, sayaç bitince kalma, sayfa değişince mini, çıkış sorusu, misafirde kapalı | `test-ui/canli-odalar.mjs`, `package.json` | `npm run test:ui` |
| 8 | `npm run build:css`, tam test seti, ad çakışma taraması | — | hepsi yeşil |

Canlıya çıkış (kullanıcı onayıyla): SQL → Render env (`DAILY_API_KEY`, `DAILY_DOMAIN`) → `node scripts/daily-odalar.mjs` → merge/push → iki hesapla gerçek deneme.
