# Çalışma analizi ve süre kalibrasyonu

**Tarih:** 2026-10-12
**Durum:** Tasarım — kullanıcı onayladı (2026-10-12), uygulama planı bekleniyor

## Sorun

FocusAid görevleri planlarken iki varsayım yapıyor ve ikisini de hiç doğrulamıyor:

1. **AI'nın süre tahmini doğru.** Görevde yalnız planlanan süre var (`start_time` / `end_time`);
   gerçekte ne kadar sürdüğü kaydedilmiyor. Tamamlama tek bir onay kutusu.
2. **Kullanıcının odak süresi profilde yazdığı kadar.** `focusPeriod` (varsayılan 25 dk) bir kez
   girilip kalıyor; AI adım boyutu, n8n yerleştirmesi, erteleme ve çalışma odası süreleri hep buna
   dayanıyor.

DEHB'de zaman körlüğü nedeniyle tahmin hatası sistematik (özellikle zor görevlerde). Plan
sistematik olarak iyimser kalınca kullanıcı her gün "yetişemedim" duygusuyla bitiyor.

Rakip taramasında (Obsidian `wiki/projeler/focusaid-rakip-analizi.md`) kullanıcının **kendi
tahmin hatasından öğrenen** bir planlayıcı görülmedi — bu FocusAid'in ayırt edici özelliği olacak.

## Hedef

- Görevlerin gerçek süresini, kullanıcıya yük bindirmeden yakalamak.
- Bunu analiz edip (a) zorluk seviyesine göre bir **tahmin oranı**, (b) bir **odak süresi önerisi**
  çıkarmak.
- Tahmin oranını yerleştiricide otomatik kullanmak; odak süresini yalnız **kullanıcı onayıyla**
  değiştirmek.
- Sonucu Profil'de sakin, görsel bir kartta ve haftalık mailde göstermek.

## Kapsam dışı

- Bugün şeridi / Time Timer / PiP gibi çalışma anı görselleri — bu veri birikince ayrı spec.
- Misafir modu için analiz.
- LLM prompt'una oran göndermek (tarih/süre kararları LLM'e bırakılmaz ilkesi korunur).

## Kullanıcı kararları

| Soru | Karar |
|---|---|
| Yeni odak süresi bulununca | **Öner, tek dokunuşla onayla** — habersiz değişen plan güveni sarsar |
| Gerçek süre nasıl yakalanır | **Karma:** mevcut görev sayacı (isteğe bağlı) kaydeder; kullanılmadıysa bitişte kısa/aynı/uzun sorusu |
| Sonuç nerede görünür | **Profil'de görsel kart + haftalık mailde tek satır** (yeni sayfa yok) |

## Mimari kararı: hesap nerede yapılır

| Aday | Karar |
|---|---|
| A. Tarayıcıda saf mantık (`analysis-logic.js`), sonuç `profiles.calibration`'a yazılır | ✅ Seçildi. Mevcut desen (`hyperfocus-logic.js`, `profile-logic.js`); `node --test` ile test edilir; mantık tek yerde. |
| B. Supabase SQL view / RPC | ❌ SQL içindeki mantık zor test edilir; her değişiklik elle SQL Editor gerektirir. |
| C. n8n gece akışı | ❌ Bu iş için ağır; repo↔canlı elle senkron derdini büyütür. |

n8n hesap yapmaz, yalnız `profiles.calibration`'ı (yerleştirmede istek gövdesinden, raporda
Supabase'ten) **okur**.

## 1. Veri modeli

`tasks` tablosuna (hepsi NULL olabilir, eski satırlar etkilenmez):

| Alan | Tip | Anlamı |
|---|---|---|
| `started_at` | TIMESTAMPTZ | Görev sayacında Başla'ya ilk basıldığı an |
| `running_since` | TIMESTAMPTZ | Ölçüm çalışıyorsa şu anki kesintisiz dilimin başladığı an; duraklatılmışsa NULL |
| `active_seconds` | INT | Kapanmış dilimlerin toplamı (molalar hariç) — Duraklat'a her basışta güncellenir |
| `longest_stretch_sec` | INT | En uzun kesintisiz dilim (saniye) |
| `actual_minutes` | INT | Tamamlanınca kesinleşen gerçek süre |
| `duration_feedback` | TEXT | `shorter` / `same` / `longer` (zamanlayıcı kullanılmadıysa) |
| `completed_at` | TIMESTAMPTZ | Tamamlanma anı |
| `planned_factor` | NUMERIC | n8n'in bu bloğa uyguladığı süre çarpanı (40 dk = 25 × 1.6 → 1.6); NULL = 1 (tek "Ekle" yolu, eski satırlar) |

Zamanlayıcı durumu veritabanında tutulur → sekme kapansa / cihaz değişse de kaybolmaz.

`profiles` tablosuna: `calibration JSONB`. Biçim:

```json
{
  "computedAt": "2026-10-12T09:00:00Z",
  "factors": { "low": 1.05, "medium": 1.2, "high": 1.6 },
  "samples": { "low": 6, "medium": 9, "high": 4 },
  "focusSuggestion": 35,
  "timedSessions": 11
}
```

`focusSuggestion` öneri yoksa `null`. DDL `add-calibration.sql` olarak repoya konur; kullanıcı
Supabase SQL Editor'de çalıştırır (izin sistemi DDL'i asistana yaptırmıyor). RLS: mevcut tasks
UPDATE ve profiles UPDATE politikaları yeni alanları da kapsar, yeni politika gerekmez.

## 2. Ölçüm akışı

**Yeni zamanlayıcı yazılmaz.** Bugün ekranında göreve bağlı donut geri sayım zaten var
(`TaskTimerState`, `tasks-view.js`: Başla/Duraklat, "+5 dk"). Şu an durumu yalnız bellekte
tutuyor ve hiçbir şey kaydetmiyor. Bu spec onu ölçüm kaynağına çevirir:

- **Başla** → `started_at` (ilk kez) ve `running_since` yazılır. **Duraklat** → `active_seconds`
  ve `longest_stretch_sec` güncellenir, `running_since` NULL olur. Sayfa yenilenince durum veritabanından
  geri kurulur (bugün bellekte kaybolup sıfırdan başlıyor).
- **Süre dolunca:** geri sayım bugünkü gibi durur ve zil çalar, ama ölçüm **arka planda devam
  eder** (kullanıcı çalışmayı sürdürüyor olabilir). Donutun altında sakin tek satır:
  "süre doldu · +7 dk" — dakikada bir güncellenir, renk/animasyon yok. Ölçüm Duraklat'a ya da
  tamamlamaya kadar sürer.
- "+5 dk" düğmesi planlanan süreyi değiştirmez; yalnız geri sayıma ekler (tahmin hatası sinyali
  olarak gerçek süreye zaten yansır).
- **Tamamlanınca:**
  - `started_at` doluysa: `actual_minutes` hesaplanır, soru **sorulmaz**.
  - Boşsa: kartın altında tek satır şerit — "Tahminden **kısa · aynı · uzun** sürdü" — atlanabilir,
    8 sn sonra kendiliğinden kapanır (cevap yoksa `duration_feedback` NULL kalır).
- **Unutulmuş zamanlayıcı:** aktif süre planlananın 3 katını **veya** 240 dk'yı aşarsa ölçüm
  geçersiz sayılır (`actual_minutes` NULL), yerine soru şeridi gösterilir.
- **Yanlışlıkla Başla → Tamamla:** aktif süre 2 dk'dan kısaysa (`ANALYSIS_MIN_MEASURED_MIN`) ölçüm
  yapılmamış sayılır — aynı şekilde `actual_minutes` NULL, soru şeridi gösterilir.
- Tamamlama geri alınırsa (onay kutusu kaldırılırsa) `completed_at`, `actual_minutes`,
  `duration_feedback` temizlenir; zamanlayıcı alanları korunur.

## 3. Analiz (`analysis-logic.js`, saf mantık)

DOM yok, ağ yok, `Date.now()` yok — zaman dışarıdan verilir (hiperfokus deseni). Global
çakışma tuzağı nedeniyle tüm üst düzey adlar `ANALYSIS_` / `analysis` önekli.

**Tahmin oranı** (her `cognitive_load` için ayrı, son 30 gün, tamamlanmış görevler):

- Örnek oranı: zamanlayıcılı görevde `actual_minutes / planlanan`, ağırlık 1;
  soru cevabında `shorter=0.75`, `same=1.0`, `longer=1.4`, ağırlık 0.5.
- Örnek oranı `planned_factor` ile çarpılır — çarpanın kendini beslemesini önler. (Blok zaten
  `25 × 1.6 = 40` dk yazıldıysa ve 40 dk sürdüyse örnek 1.0 değil 1.6'dır; çarpılmasa oran
  her turda kendi uzattığı bloğa göre ölçülür ve ≈ √f'ye söner.) Değer yoksa 1.
- Ağırlıklı ortalama `r`, toplam ağırlık `n`; yumuşatma `(n·r + 5·1.0) / (n + 5)`.
- Sınır: 0.6 – 2.5. Hiç örnek yoksa 1.0.

**Odak süresi önerisi** (son 14 gün, `longest_stretch_sec` dolu oturumlar; dakikaya çevrilir):

- En az 8 oturum yoksa öneri yok.
- Ortanca → 5'e yuvarla → 10–60 dk arası sınırla.
- Mevcut `focusPeriod`'dan farkı < 5 dk ise öneri yok.

**Ne zaman hesaplanır:** Profil sayfası açıldığında ve bir görev tamamlandığında. Sonuç
öncekinden farklıysa `profiles.calibration`'a yazılır.

## 4. Görsel kart — Profil → "Çalışma Analizim"

- **Tahmin ve gerçek:** üç yatay çubuk (hafif / orta / ağır), "1.0 = tam isabet" dikey çizgisi;
  çubuk ucunda "×1.6" ve örnek sayısı.
- **Odak süreleri:** son 14 günün küçük sütun grafiği (gün başına en uzun kesintisiz dilim),
  mevcut `focusPeriod` kesikli yatay çizgi.
- **Öneri kutusu** (yalnız `focusSuggestion` varsa): "Ortalama 35 dk kesintisiz
  odaklanıyorsun. Odak süreni 25 → 35 dk yapalım mı?" **[Uygula]** **[Şimdilik değil]**.
  Uygula → `focusPeriod` güncellenir, toast. Şimdilik değil → aynı öneri 7 gün gösterilmez
  (`localStorage`, bozuksa yok sayılır).
- **Sakinlik ilkeleri:** animasyon yok, soluk renkler (mevcut hafif/orta/ağır paletinin açık
  tonları), kütüphane yok — satır içi SVG, açık/koyu tema uyumlu.
- **Az veri:** grafik yerine "Analiz için 3/8 oturum — görev sayacını kullandıkça dolacak."
- **Misafir:** "Giriş yapınca açılır."

## 5. Plana etkisi (n8n yerleştirme Code node)

- Tarayıcı `planningProfile()` ile profili zaten n8n'e gönderiyor; buna
  `durationFactors: {low, medium, high}` eklenir (calibration yoksa hepsi 1.0).
- Yerleştirici her görev için takvimde `round5(süre × factor[load])` kadar yer ayırır. Sonuç:
  oranı yüksek seviyedeki görevler daha uzun blok alır, güne daha az sığar; taşma kuralı
  (silinmez, ileri kayar, kullanıcıya söylenir) aynen geçerli.
- Uzatılmış blok (`len > focusPeriod`) molasıyla birlikte rezerve edilir ve yer ararken molası
  da sığmalıdır; aksi halde `len ≥ adım` olduğunda (pomodoro 25+5, ×1.2 → 30 dk) sonraki blok
  molasız bitişik düşüyordu. Çarpan 1'de dolgu yok (eski yerleşim birebir korunur).
- Her sonuçta `plannedFactor` = bloğa gerçekten uygulanan çarpan (`len / focusPeriod`; 5'e
  yuvarlama ve 10 dk tabanı dahil, çarpan 1 iken 1) üretilir; `Prepare Supabase Payload` ve
  `Save task to Supabase` bunu `tasks.planned_factor` olarak yazar (bkz. §3).
- AI Agent prompt'u değişmez.
- `focusPeriod` onayla değişince mevcut tüm tüketiciler (adım boyutu, erteleme, oda süreleri)
  ek kod olmadan etkilenir.
- n8n node kodu repo↔canlı senkron: `scripts/n8n-senkron.mjs` (API key gelirse) ya da elle.

## 6. Haftalık mail

Rapor akışı kullanıcının `profiles.calibration`'ını okur. En yüksek oran ≥ 1.2 ve o seviyede
≥ 5 örnek varsa tek satır: "Ağır görevlerin ortalama 1.6 kat sürdü — planlarını buna göre
ayarlıyorum." Koşul sağlanmazsa satır çıkmaz.

## 7. Hata durumları

| Durum | Davranış |
|---|---|
| `calibration` NULL / bozuk JSON | Oranlar 1.0, öneri yok; kart "az veri" görünümü |
| Supabase yazma hatası (zamanlayıcı) | İyimser UI geri alınır, toast (mevcut `toggleTask` deseni) |
| Planlanan süre okunamıyor (start/end eksik) | Örnek analize alınmaz |
| Aynı görev iki sekmede başlatıldı | Veritabanındaki `running_since` esas; ikinci basış yok sayılır |
| Takvim bağlı değil | Etkilenmez — analiz yalnız Supabase verisiyle çalışır |

## 8. Test

- `test/analysis-logic.test.js`: oran hesabı, ağırlıklar, yumuşatma, sınırlar, 30/14 gün
  pencereleri, öneri eşikleri (8 oturum, 5 dk fark), unutulmuş zamanlayıcı, bozuk girdi.
- `test/n8n-placement.test.js`: `durationFactors` yok / 1.0 / 1.6 durumları; taşma kuralının
  korunması.
- `test-ui`: Profil kartı az-veri ve dolu görünümleri; sayaç Başla → Duraklat → yenile (durum geri kuruluyor mu) → Tamamla akışı; süre dolunca ölçümün sürmesi;
  soru şeridi.
- CI `TZ=Europe/Istanbul` ile koşar (mevcut kural).
