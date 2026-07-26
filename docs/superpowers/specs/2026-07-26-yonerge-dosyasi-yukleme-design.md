# FocusAid — Yönerge Dosyası Yükleyerek Görev Parçalama — Tasarım

**Tarih:** 2026-07-26
**Durum:** Onaylandı, uygulamaya hazır
**Kapsam:** Ön yüz + yeni bir n8n workflow'u. Mevcut `FocusAid Processor` workflow'unda yalnızca iki node dokunuşu. Veritabanı değişikliği yok.

## Problem

Görev parçalama şu an yalnızca elle yazmayla çalışıyor: kullanıcı başlık, açıklama ve teslim tarihini
kendisi giriyor. Oysa okul/staj işlerinin çoğu bir **yönerge dosyasıyla** geliyor (PDF ya da Word) ve
gereklilikler, teslim tarihi, aşamalar hep o belgenin içinde. Kullanıcı bunları elle özetlemek zorunda
kalıyor — DEHB'de "başlama felcini" tetikleyen tam da bu tür bir ön hazırlık yükü.

## Amaç

Yönerge dosyasını yükle, sistem içinden görevi, zorunlulukları ve teslim tarihini çıkarsın, sen onayla,
parçalama ona göre yapılsın.

## Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Dosya türleri | PDF ve Word (.docx) | Kullanıcının elindeki yönergeler bu ikisi |
| Metin çıkarma yeri | **Tarayıcı** (`pdf.js` + `mammoth.js`) | n8n'in `Extract from File` node'u DOCX desteklemiyor (destek listesi: pdf, csv, html, rtf, text, xls, xlsx, ods, xml). Tarayıcıda ikisi de tek kod yolundan geçer |
| Analiz yeri | **Yeni ayrı workflow** (`FocusAid Analyzer`) | Bugün uçtan uca çalışır hale gelen `FocusAid Processor`'a IF dallanması eklemek gereksiz risk |
| Onay adımı | **Var.** AI formu doldurur, kullanıcı düzeltip "Parçala"ya basar | Yanlış okunan teslim tarihi tüm planlamayı kaydırır |
| Parçalama girdisi | Analizden çıkan **zorunluluk listesi** (tam metin değil) | Kompakt, kullanıcı düzeltebilir, token maliyeti düşük, kapak/imza gürültüsü yok |
| Dosya yükleme | **Zorunlu değil** | Elle yazma yolu aynen kalır; analiz her koşulda başarısız olabilir |

## Ekran akışı

Yeni sekme yok — mevcut **Parçalayıcı** ekranına ekleniyor.

1. Başlık alanının üstünde bırakma alanı: *"Yönerge dosyasını sürükle veya seç (PDF, Word)"*
2. Dosya seçilince metin tarayıcıda çıkarılır — "Yönerge okunuyor…" durumu görünür
3. Metin analiz webhook'una gider
4. Form kendiliğinden dolar:
   - başlık → mevcut `task-input`
   - teslim tarihi → mevcut `task-deadline`
   - **yeni:** zorunluluklar, her satırı bir madde olan bir `<textarea>`
5. Tarihin altında küçük gri satır: **"Yönergede geçen: '…son teslim 15 Ağustos 2026…'"**
6. Kullanıcı düzeltir, **Parçala**'ya basar → mevcut akış, ek olarak `requirements` ile

**Zorunluluklar neden textarea?** Çip/etiket bileşeni, silme düğmeleri, sürükle-bırak yerine düz metin
alanı: tek yerde serbestçe düzeltilir, öğrenilecek arayüz yoktur. DEHB tarafında da doğrusu bu —
düzeltme işlemi ek bir bilişsel yük olmamalı.

**Hiçbir şey kullanıcı onayı olmadan takvime yazılmaz.** Analizin tek çıktısı doldurulmuş bir formdur.

## Metin çıkarma (tarayıcı)

- **PDF:** `pdf.js` — sayfa sayfa `getTextContent()`
- **Word:** `mammoth.js` — `extractRawText({ arrayBuffer })`
- İkisi de CDN'den yüklenir (proje zaten Tailwind, Supabase, FullCalendar'ı CDN'den çekiyor)

**Sınırlar:**

| Sınır | Değer | Aşılırsa |
|---|---|---|
| Dosya boyutu | 10 MB | Yükleme reddedilir |
| Çıkarılan metin | 40.000 karakter | İlk 40.000 karaktere kırpılır, kullanıcıya bildirilir |

**Taranmış belgeler desteklenmiyor.** Fotoğraflanmış/taranmış PDF'te metin katmanı olmadığı için sonuç
boş döner. Bu durum sessizce boş form bırakmak yerine ayrı bir hata olarak yakalanır: *"Bu belge
taranmış görünüyor, metin içermiyor."* OCR bu spec'in kapsamı dışında.

## Analiz workflow'u — `FocusAid Analyzer`

Yeni ve bağımsız n8n workflow'u: `Webhook (POST /focusaid-analyze) → AI Agent (Gemini) → Respond to Webhook`.

**Workflow aktifleştirilmelidir.** n8n'de pasif workflow'un yalnızca `/webhook-test/…` adresi çalışır ve
o da ancak editörde "Listen for test event" açıkken. Ön yüz production adresini (`/webhook/…`)
çağıracağı için workflow'un **Active** olması gerekir.

**Webhook adresi `config.js`'e eklenir:** `N8N_ANALYZE_WEBHOOK`. `config.js` gitignored olduğu için
`config.example.js` de aynı anahtarla güncellenir, yoksa projeyi yeniden kuran (veya yeni makinede
açan) kişi eksik anahtarla karşılaşır.

### İstek

```json
{ "documentText": "…", "fileName": "yonerge.pdf", "today": "2026-07-26" }
```

**`today` alanı zorunludur.** Yönergede "iki hafta içinde", "dönem sonuna kadar" gibi göreli ifadeler
olabilir; model bugünün tarihini bilmezse kendi eğitim kesimini baz alır ve tarih sessizce yanlış çıkar.

### Yanıt

```json
{
  "title": "AutoCAD Portfolyo Ödevi",
  "deadline": "2026-08-15T23:59:00+03:00",
  "deadlineQuote": "Projeler 15 Ağustos 2026 tarihine kadar teslim edilecektir.",
  "requirements": ["4 aşamalı çizim", "katman kuralları", "PDF çıktısı"]
}
```

- `deadline` ISO 8601, **+03:00** ofsetiyle (projenin geri kalanıyla tutarlı)
- `deadline` ve `deadlineQuote` **null olabilir** — prompt, tarih bulunamadığında uydurmak yerine null
  döndürmeyi açıkça ister. Boş bırakmak, uydurmaktan iyidir.
- `requirements` boş dizi olabilir
- `deadlineQuote`, tarihin alındığı cümlenin belgeden birebir alıntısıdır; kullanıcının halüsinasyonu
  tek bakışta yakalaması içindir

### Ön yüz doğrulaması

Modelin döndürdüğü JSON forma yazılmadan önce doğrulanır: alanlar var mı, `deadline` gerçekten
ayrıştırılabilir bir tarih mi, `requirements` dizi mi. Geçersizse form doldurulmaz ve kullanıcıya elle
girmesi söylenir. Model çıktısına körlemesine güvenilmez.

## Hata durumları

Hepsinde uygulama kullanılabilir kalır; elle giriş yolu her zaman açıktır.

| Durum | Davranış |
|---|---|
| Dosya > 10 MB | Yükleme reddedilir, sebep gösterilir |
| Desteklenmeyen tür | Reddedilir ("PDF veya Word yükleyebilirsin") |
| Şifreli PDF | `pdf.js` hatası yakalanır: "şifreli, açıp tekrar dene" |
| Taranmış / metinsiz belge | "Metin bulunamadı, taranmış olabilir — elle girebilirsin" |
| Metin 40.000 karakteri aşıyor | Kırpılır + uyarı gösterilir, akış devam eder |
| n8n kapalı / webhook hatası | "Analiz edilemedi, elle girebilirsin" — form boş kalır |
| AI geçersiz JSON / doğrulama başarısız | Aynı nazik hata, akış kırılmaz |

## Parçalama tarafındaki değişiklik

Ön yüz, POST gövdesine `requirements: string[]` ekler. Liste, zorunluluklar textarea'sının satırlara
bölünmesiyle üretilir: her satır bir madde, baştaki/sondaki boşluklar kırpılır, boş satırlar atılır.
Kullanıcı dosya yüklemediyse veya alanı boşalttıysa `[]` gider ve parçalama eskisi gibi çalışır.

Canlı `FocusAid Processor` workflow'unda iki node dokunuşu:

1. **`Normalize & Calculate`** — `body.requirements` okunur (yoksa `[]`), `merged` nesnesine eklenir
2. **`AI Agent`** — prompt'a zorunluluk listesi girer: üretilen mikro görevler bu maddeleri kapsamalı

Planlama algoritması (`Code in JavaScript`) **değişmez** — tarih/saat yerleştirme yine Code node'un işi,
AI yalnızca görev + `cognitive_load` üretmeye devam eder. Bu, projenin mevcut mimari kararıdır.

## Kod yapısı

- **`doc-intake.js`** (yeni) → dosya seçme, metin çıkarma, analiz çağrısı, formu doldurma
- Saf ve test edilebilir parçalar (`tasks-logic.js` deseninde): dosya türü tespiti, metin kırpma,
  **AI yanıtı doğrulama**. Node'un yerleşik test runner'ı ile test edilir (`node --test`, argümansız —
  Windows'ta dizin argümanı MODULE_NOT_FOUND verir).
- **`index_2.html`** → `tpl-chatbot` içine bırakma alanı, zorunluluklar textarea'sı, kaynak cümle satırı;
  head'e iki CDN script
- **`index.html`** ikizdir, aynı değişiklik ona da uygulanır

## Doğrulama

Birim testleri (saf mantık): dosya türü tespiti (uzantı + MIME), 40.000 karakter kırpma sınırı, AI yanıtı
doğrulama (eksik alan, geçersiz tarih, `requirements` dizi değil, `deadline: null` geçerli sayılmalı).

Tarayıcı doğrulaması: gerçek bir PDF yönerge (`Desktop\Okul\TNCStaj\Proje\AutoCad\AutoCAD Ders
Yönergesi.pdf` uygun bir aday) ve bir .docx ile uçtan uca; ayrıca taranmış PDF, 10 MB üstü dosya, n8n
kapalıyken yükleme ve dosyasız elle giriş yollarının bozulmadığı.

## Kapsam dışı

- OCR (taranmış belge okuma)
- Birden fazla dosya aynı anda
- Yüklenen dosyanın saklanması (metin çıkarılır, dosya cihazdan çıkmaz)
- Görsel/ekran görüntüsü yükleme
- Analiz sonucunun `tasks` tablosunda saklanması
