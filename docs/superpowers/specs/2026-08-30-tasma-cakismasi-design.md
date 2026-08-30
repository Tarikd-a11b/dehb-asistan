# Taşma çakışması: sığmayan plan aynı saate birden çok etkinlik yazıyordu

**Tarih:** 2026-08-30
**Durum:** Düzeltildi ve testlerle kilitlendi — canlı n8n'e uygulanması bekliyor

## Sorun

`Code in JavaScript` yerleştiricisinin son dalı:

```js
if (session === null) { session = sessions[A - 1]; startAbs = session.start; } // taşma: son seansa zorla
```

Bu dal **doluluk kontrolü yapmıyordu.** Tüm günler dolduğunda her taşan görev son seansın
*başlangıcına* yazılıyordu; N görev taşarsa N etkinlik **aynı saate** düşüyordu. Kullanıcı
takviminde üst üste binmiş, aynı dakikada başlayan görevler görüyordu.

Ölçüm (node kodu yerelde koşturularak, 8064 senaryo — 1–30 gün × 1–40 görev × 6 mod ×
4 mola stili × 3 çalışma penceresi × takvim dolu/boş):

| | çakışan senaryo |
|---|---|
| eski kod (HEAD) | **3174** |
| yeni kod | **0** |

## Tasarım

Tek dal yerine üç aşama:

1. **Normal:** günlük tavan + boş saat (değişmedi).
2. **Tavan esnetme:** tavan dolu ama saat boşsa tavanı geçici olarak yok say. Günlük tavan bir
   *tercih*; çakışmayan takvim ise *doğruluk* meselesi. Baskı altında tercih feda edilir.
3. **Gerçek taşma:** hiçbir seansta boş saat kalmadıysa son seansın **sonundan** itibaren ilk boş
   aralık aranır (`while (!isFree(...)) startAbs += step`). Plan çalışma penceresini ve teslim
   tarihini aşar.

### Neden "teslimi aşmak", "üst üste binmek"ten iyi

Plan gerçekten sığmıyorsa bir şey feda edilecek. Üst üste binen etkinlik **sessiz bir veri
hatası**: takvim yanlış, kullanıcı fark etmiyor. Teslimi aşan görev ise **görünür bir gerçek**:
plan sığmadı ve bu söyleniyor.

Görev silmek yine seçenek değil (bkz. `2026-08-30-modun-gorev-sayisina-etkisi-design.md`).

## Sığmama artık söyleniyor

`Code in JavaScript` her göreve `deadlineAsiyor` yazıyor (normal yerleştirmede seans sonu zaten
teslimle sınırlı olduğu için bu bayrak **yalnızca** gerçek taşmada `true` olur).
`Respond to Webhook` bunları sayıp `tesliminOtesinde` olarak döndürüyor; `parcalamaSonucMesaji`
uyarıyı ekliyor:

> ⚠️ Plan çalışma saatlerine sığmadı: **3 görev teslim tarihinden sonraya** düştü.
> Teslimi uzat, çalışma pencereni genişlet ya da kapsamı küçült.

Sayaç yoksa (eski n8n sürümü) uyarı **hiç çıkmaz** — takvim sayaçlarındaki aynı kural:
yanlış bilgi vermektense az bilgi ver.

## Yeni test dosyası: `test/n8n-placement.test.js`

n8n node kodu repoda bir JSON alanında duruyor ve canlıya elle kopyalanıyordu; **hiçbir şey onu
test etmiyordu.** Bu dosya node'u `new Function('$','$json', jsCode)` ile doğrudan koşturuyor:
çakışma yok, görev kaybı yok, mevcut takvim etkinliklerinin üstüne yazılmıyor, gece aşan
pencere, `deadlineAsiyor` bayrağının iki yönü, modun bugünü ağırlaştırmaması ve `dailyCaps`
kopyasının `scheduling-logic.js` ile birebir aynılığı.

Testlerin boş olmadığı doğrulandı: HEAD'deki eski node koduna karşı 8 testin **4'ü düşüyor**.
