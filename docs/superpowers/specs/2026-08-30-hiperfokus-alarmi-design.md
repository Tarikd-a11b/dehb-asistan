# Hiperfokus alarmı

**Tarih:** 2026-08-30
**Durum:** Tasarım — uygulama bu spec'le birlikte yapıldı

## Sorun

Profildeki **Hiperfokus Uyarısı** alanı (`hyperfocusLimit`) kullanıcıya açık bir söz veriyor:
"⏰ 60 dk'da bir uyar". Değer kaydediliyor, Supabase'e yazılıyor, `planningProfile()` ile n8n'e
bile gidiyor — ama **hiçbir yerde bir uyarı üretilmiyor.** Alan 2026-07'den beri ölü.

2026-08-28 tarihli bilişsel yük spec'inde bu alan bir kez `effectiveFocus` ile seans süresini
kısaltmak için kullanılacaktı; kullanıcı bunu reddetti ve gerekçesi burada da geçerli:
**"beni uyar" diyene "seansını kısalttım" demek başka bir şeydir.** Bu spec gerçek alarmı yazar,
seans süresine dokunmaz.

## Hedef

Kullanıcı aralıksız `N` dakikadır çalışıyorsa nazikçe uyarılsın; mola verince sayaç sıfırlansın;
uyarı `N` dakikada bir tekrarlansın. `none` seçiliyse hiçbir şey olmasın.

## En kritik karar: "kesintisiz çalışma" nasıl ölçülür

Üç aday vardı:

| aday | neden reddedildi / seçildi |
|---|---|
| (a) **Görev programına bakmak** — aktif görev var mı, seans bitti mi | ❌ Program zaten mola içeriyor (pomodoro 5 dk). Her seans arasında sayaç sıfırlanır, alarm **hiç** çalmaz. Ölçmek istediğimiz şey tam da "planlı molayı atlamak"; onu planın kendisiyle ölçemeyiz. |
| (b) **Sekme görünürlüğü** — sekme gizlenince mola sayılsın | ❌ Hiperfokusun tipik hali sekmeyi gizleyip başka pencerede (editör, doküman) saatlerce kalmaktır. Bu ölçüm tam da yakalanması gereken vakayı "mola" sayar. |
| (c) **Duvar saati + gerçek kesinti kanıtı** | ✅ Seçildi. Aşağıda. |

**Seçilen model:** Sayaç, uygulama açık olduğu sürece duvar saatiyle akar. Mola yalnızca
**kanıt varsa** kaydedilir:

1. Kullanıcı alarmdaki **"Mola verdim"** düğmesine basar (açık niyet), veya
2. Uygulama kapalıyken/uykudayken **≥ 10 dakika** geçer — iki tik arasındaki boşluktan anlaşılır
   (sekme kapatıldı, laptop kapandı, makine uyudu).

Sekmenin gizlenmesi mola **sayılmaz**; sayaç işlemeye devam eder.

### Bilinçli olarak yanlış-pozitif tarafında duruyoruz

Sekmeyi açık bırakıp yürüyüşe çıkan (ve makinesi uyumayan) biri boş yere uyarı alır. Kabul
edildi: alarmın maliyeti bir şerit, faydası ise kaçırıldığında **tamamen** yok oluyor. DEHB
bağlamında sessiz kalan alarm, fazladan çalan alarmdan daha pahalıdır. "Mola verdim" düğmesi
yanlış pozitifi tek tıkla kapatır.

### Ölçemediğimiz şey (dürüst sınır)

FocusAid bir tarayıcı sayfası; kullanıcının başka uygulamalarda ne yaptığını göremez. Sayaç
"kullanıcı çalışıyor"u değil, **"uygulama açık ve makine uyanık"**ı ölçer. Bu, hiperfokusun
gözlenebilir en yakın vekilidir, aynısı değil.

## Kapsam dışı

- **Odak zamanlayıcısı / "Odağa başla" düğmesi.** Ayrı ve büyük bir iş; bu spec mevcut ekranlara
  düğme eklemez.
- **Ses.** Duyusal hassasiyet alanları profilden 2026-08-29'da kaldırıldı, otomatik ses çalma
  tarayıcı politikalarıyla da sorunlu. Alarm sessiz.
- **`hyperfocusLimit`'in planlamaya etkisi.** Alan n8n'e gitmeye devam eder, planlayıcı onu
  yine kullanmaz. Bu spec yalnızca istemci tarafıdır — **n8n'de değişiklik yok.**
- **Sunucu tarafı hatırlama.** Sayaç `localStorage`'da durur, cihaz başınadır. Hiperfokus zaten
  tek oturumluk bir olaydır; cihazlar arası taşımanın anlamı yok.

## Tasarım

### 1. Yeni dosya: `hyperfocus-logic.js` (saf)

DOM yok, ağ yok, `Date.now()` yok — zaman **dışarıdan** verilir, testler böylece saati taklit
edebilir. CLAUDE.md'deki "saf hesap `*-logic.js`'e" kuralı.

```js
parseHyperfocusLimit(value) -> number   // 'none'|''|bozuk -> 0 (kapalı), '60' -> 60
hyperfocusTick(state, input) -> { state, alarm }
hyperfocusMessage(minutes)   -> string
```

`state` = `{ startMs, lastTickMs, lastAlarmMs }` veya `null` (seri yok).
`input` = `{ nowMs, limitMinutes, breakMinutes }`.

Kurallar, sırayla:

1. `limitMinutes <= 0` → alarm kapalı: `state: null`, `alarm: null`.
2. `state` yoksa → yeni seri başlar (`startMs = lastTickMs = now`), alarm yok.
3. `now - lastTickMs >= breakMinutes` → **mola tespit edildi**, seri `now`'dan yeniden başlar.
4. Saat geriye giderse (`now < lastTickMs`, yaz saati/manuel değişiklik) → seri `now`'dan
   yeniden başlar. Negatif geçmiş süreyle alarm üretmek anlamsız.
5. Aksi halde `lastTickMs = now`. Son alarmdan (yoksa seri başından) beri
   `>= limitMinutes` geçtiyse **alarm**: `lastAlarmMs = now`, `alarm = { elapsedMinutes, ... }`.

Adım 5'teki dayanağın `lastAlarmMs ?? startMs` olması, "N dakikada **bir**" sözünün tekrar
kısmını karşılar: 60 dk'da uyarır, 120'de yine uyarır.

⚠️ Tek bir tikte hem mola hem alarm olmaz; mola dalı erken döner.

### 2. Yeni dosya: `hyperfocus-view.js` (DOM)

- `startHyperfocusWatch()` — 30 saniyede bir tik. **Uygulama seviyesinde** çalışır, sayfaya
  bağlı değil: `loadPage()` her gezinmede `stopTodayTimer()` çağırıyor, alarm ona takılmamalı.
- Durum `localStorage['focusaid_hyperfocus']`'ta saklanır → **sayfa yenilemek mola değildir.**
- Limit `userProfile.hyperfocusLimit`'ten her tikte okunur; profilde değişince yeniden başlatma
  gerekmez.
- Alarm görünümü **toast değil, üstte yapışkan şerit.** `showToast` 3.5 saniyede kayboluyor;
  hiperfokustaki birinin 3.5 saniyelik bir şeyi görmesini beklemek bu özelliğin amacını
  baştan yok eder. Şerit kullanıcı bir şey yapana kadar durur.
  - **"Mola verdim"** → seriyi sıfırlar, şerit kapanır.
  - **"5 dk sonra"** → şerit kapanır, `lastAlarmMs` 5 dk ileri alınır (erteleme).
- Tarayıcı bildirimi: yalnızca izin **zaten verilmişse** gönderilir. İzin, kullanıcı profilde
  `none` dışında bir değer seçtiği anda (gerçek kullanıcı hareketi) istenir. Kendiliğinden izin
  penceresi açılmaz.

### 3. Arayüz metni

Şerit dili nötr ve suçlayıcı değil (RSD koruması, `dayLabel`'daki aynı kural):
> ⏰ **90 dakikadır aralıksız çalışıyorsun.** Beş dakika kalk, su iç, gözlerini dinlendir.

"Çok fazla", "aşırı", "hâlâ" gibi ifadeler kullanılmaz.

## Doğrulama

- `hyperfocus-logic.js` için birim testler (`test/hyperfocus-logic.test.js`): kapalı limit,
  ilk seri, alarm eşiği, tekrar, mola tespiti, sayfa yenileme, saat geri gitmesi.
- Elle: profilde 60 dk seç → `localStorage` durumunu geriye kaydırıp şeridin çıktığını gör.
