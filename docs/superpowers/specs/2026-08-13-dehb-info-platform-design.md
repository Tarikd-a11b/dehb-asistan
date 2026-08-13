# DEHB Bilgilendirme Platformu — Design Spec

**Tarih:** 2026-08-13  
**Proje:** FocusAid — DEHB Odak Asistanı  
**Özellik:** Entegre DEHB Eğitim Platformu  
**Durum:** Design Onaylandı

---

## 1. Genel Bakış

FocusAid uygulamasına, DEHB'li bireyleri bilgilendiren, kendi kaynakları ve bilimsel literatürden derlenmiş eğitim içeriği içeren bağımsız bir bilgilendirme platformu eklemek.

**Amaç:** FocusAid'i kullanan DEHB bireyleri, platformu kullanırken kendi durumlarını anlayabilmeleri, DEHB hakkında doğru, DEHB-dostu (kısa, net, dikkat süresi göz önüne alınmış) bilgi alabilmelerini sağlamak.

**Kapsam:**
- ✅ Entegre template (index.html içinde yeni sayfa)
- ✅ Sol taraf mini nav-bar (5 alt başlık)
- ✅ DEHB-friendly format (kısa, görselli, emojili)
- ✅ Mevcut kaynaklar + bilimsel literature
- ❌ Teşhis/tedavi tavsiyeleri, ilaç rehberi (dışlanmış)

---

## 2. Mimarisi

### 2.1 Sayfa Yapısı

```
index.html (mevcut)
  ├─ <template id="tpl-today"> (mevcut)
  ├─ <template id="tpl-calendar"> (mevcut)
  ├─ <template id="tpl-chatbot"> (mevcut)
  ├─ <template id="tpl-profile"> (mevcut)
  └─ <template id="tpl-dehb-info"> ✨ YENİ
     ├─ Mini nav-bar (sol taraf, sabit)
     └─ İçerik alanı (dinamik)
```

### 2.2 Nav Bar Entegrasyonu

Mevcut nav bar'a yeni buton:

```html
<button onclick="loadPage('dehb-info')" id="nav-dehb-info" 
  class="sidebar-item w-full text-left px-4 py-3 rounded-xl ...">
  ℹ️ DEHB Bilgisi
</button>
```

### 2.3 Mini Nav-Bar (Bilgi Sayfası İçinde)

Sol taraf, diğer nav bar'ın altında görünür. 5 link:

```
📖 DEHB Nedir?
⚡ Belirtiler  
💡 Başa Çıkma
🌙 Yaşam İpuçları
🔗 Kaynaklar
```

Her link: `onclick="showDehbSection('nedir')"` tarzı.

**Stil:** Mevcut `.sidebar-item` class'ı kullan, aktif bölümü `.active-link` ile highlight.

### 2.4 İçerik Şablonu

Her bölüm ayrı bir `<div id="dehb-section-{name}">` içinde.

Görünülürlük: `display: none` default, `display: block` aktif bölümde.

---

## 3. İçerik Yapısı

### 3.1 Bölüm 1: DEHB Nedir?

**Başlık:** 🧠 DEHB Nedir?

**İçerik:**
- DEHB tanımı (1-2 cümle, dopamin/noradrenalin kısaca)
- Genetik temellidir (kalıtım %76)
- Çocuklukta başlayıp yaşlılığa devam eder
- Hiperaktif görünmeyenler de DEHB'li olabilir
- Yaygınlık istatistikleri (çocuk: %3-7, yetişkin: %2-3)

**Format:** Bullet points + emojiler, 1 scroll kadar.

---

### 3.2 Bölüm 2: Belirtiler (Detaylı)

**Başlık:** ⚡ DEHB'ye Özgü Belirtiler

**Alt Başlıklar + İçerik:**

#### 2.1 Zamansal Miyopi (Zaman Kavramı Kaybı)
- Neden açıklama (prefrontal korteks dopamin eksikliği)
- Belirti listesi
- Günlük impact

#### 2.2 Zihin Oryantasyon Kaybi (DMN Takılması)
- Neden + tıbbi adı (SCT)
- Belirti listesi

#### 2.3 Tepki İnhibisyonu Yetersizliği (Frenleme Gücü)
- Neden
- Belirti + farklı yaş sunumları

#### 2.4 Yürütücü İşlev Bozukluğu (6 Modül)
- Tablo/grid: Aktivasyon, Odaklanma, Çaba, Duygu Yönetimi, Bellek, Eylem
- Her modülün 2-3 belirti

#### 2.5 Emosyonel Dysregülasyon
- Neden + tıbbi adı (RSD)
- Belirti listesi

#### 2.6 Sosyal İşlev Sorunu
- Neden
- Belirti listesi

#### 2.7 Unutkanlık & Çalışma Belleği
- Neden (encoding failure)
- Belirti listesi

**Ek: DEHB'nin 3 Türü**
- Hiperaktif-Dürtüsel Tip (20-30%)
- Dikkat Eksikliği Baskın Tip (30-40%) — kaçırılma riski vurgusu
- Kombine Tip (40-50%)

Tablo: Her tip için görünürlük, fark edilme, tanı süresi, sosyal etki karşılaştırması.

---

### 3.3 Bölüm 3: Başa Çıkma Stratejileri

**Başlık:** 💡 Dikkat Desteği Stratejileri

**İçerik:**

#### 3.1 Görsel Desteği
- Renkli not tutma
- Görevleri yazılı tutmak
- Timer ve görsel reminders

#### 3.2 İşitsel Desteği
- Müzik/white noise ile çalışma
- Kendine yüksek sesle talimat verme

#### 3.3 Bedensel Desteği
- Hareket ederek çalışma
- Yer değiştirerek görev yapma
- Sporla prefrontal dopamin artışı

**Vurgu:** DEHB'li bireyler farklı dikkat değiştiricilerine yanıt veriyor.

---

### 3.4 Bölüm 4: Yaşam İpuçları

**Başlık:** 🌙 Günlük Yaşamda İpuçları

**İçerik:**

#### 4.1 Uyku & Beslenme
- Düzenli uyku rutini kritik
- Kafein dengesi

#### 4.2 Sosyalleştirme & İlişkiler
- Reddedilme hassasiyeti yüksek
- Açık iletişim, uyarı

#### 4.3 İşbirliği & Çalışma
- Yapılandırılmış ortamlar
- Belirli kurallar ve zaman yönetimi
- Sık geribildirim sistemi

---

### 3.5 Bölüm 5: Harici Kaynaklar

**Başlık:** 🔗 Daha Fazla Bilgi İçin

**İçerik:**

#### 5.1 Uluslararası Kaynaklar
- CHADD.org (Children and Adults with ADHD)
- ADHD.org (ADHD Association)
- Russell Barkley videos

#### 5.2 Türkçe Kaynaklar
- Türkiye Psikiyatri Derneği
- Prof. Dr. Bengi Semerci
- DergiPark bilimsel makaleler

#### 5.3 Önemli Not
- Eğitim amaçlı bilgi
- Teşhis/tedavi için uzman doktor

---

## 4. Teknik Uygulama

### 4.1 Template Dosyası

Yeni template: `<template id="tpl-dehb-info">`

```html
<template id="tpl-dehb-info">
  <div class="animate-slide-in max-w-6xl mx-auto pb-10">
    
    <!-- Başlık -->
    <div class="mb-8">
      <h2 class="text-4xl font-extrabold text-slate-900">DEHB Bilgilendirme</h2>
      <p class="text-slate-500 italic mt-1">Kendini anlamaya başla</p>
    </div>

    <!-- Mini Nav-Bar (Sol) -->
    <div class="flex gap-8">
      <nav class="w-48 flex-shrink-0 space-y-2">
        <button onclick="showDehbSection('nedir')" 
          class="dehb-nav-item w-full text-left px-4 py-3 rounded-xl ...">
          🧠 DEHB Nedir?
        </button>
        <!-- ... diğer 4 buton ... -->
      </nav>

      <!-- İçerik Alanı -->
      <div class="flex-1">
        <div id="dehb-section-nedir" class="dehb-content">
          <!-- Bölüm 1 içeriği -->
        </div>
        <div id="dehb-section-belirtiler" class="dehb-content hidden">
          <!-- Bölüm 2 içeriği -->
        </div>
        <!-- ... diğer bölümler ... -->
      </div>
    </div>

  </div>
</template>
```

### 4.2 JavaScript (tasksView.js'e benzer yapı)

Yeni fonksiyon: `showDehbSection(sectionName)`

```javascript
function showDehbSection(sectionName) {
  // 1. Tüm bölümleri gizle
  document.querySelectorAll('.dehb-content').forEach(el => {
    el.classList.add('hidden');
  });
  
  // 2. İsteneni göster
  document.getElementById(`dehb-section-${sectionName}`)?.classList.remove('hidden');
  
  // 3. Mini nav aktif durumunu güncelle
  document.querySelectorAll('.dehb-nav-item').forEach(b => {
    b.classList.remove('active-link', 'bg-indigo-50', 'text-indigo-600');
  });
  event.target.closest('.dehb-nav-item')?.classList.add('active-link', 'bg-indigo-50', 'text-indigo-600');
  
  // 4. localStorage'a kaydet (açılan bölümü hatırla)
  localStorage.setItem('dehb_section', sectionName);
}

// Sayfa yükleme: localStorage'dan oku, varsayılan "nedir"
window.addEventListener('INITIAL_SESSION', () => {
  const saved = localStorage.getItem('dehb_section') || 'nedir';
  showDehbSection(saved);
});
```

### 4.3 Stil (CSS)

`.dehb-content` — içerik containerları
`.dehb-nav-item` — mini nav butonları (mevcut `.sidebar-item` den inherit)
`.hidden` — `display: none`

---

## 5. DEHB-Friendly Format (Tüm Bölümlerde)

**Uygulama Kuralları:**

✅ Kullanılacak:
- Kısa başlıklar (max 6 kelime)
- Mini paragraflar (2-3 cümle max)
- Bullet points
- İkonlar/Emojiler
- Renk kodlama
- Minimal scroll (bölüm max 3 scroll)
- Harici linkler

❌ Kaçılacak:
- Uzun paragraflar
- Kompleks tablolar
- Otomatik animasyon
- "Devamını oku" (frustration)

---

## 6. Entegrasyon Noktaları

### 6.1 Index.html
- Yeni template ekleme
- Nav bar'a buton ekleme

### 6.2 JavaScript
- `showDehbSection()` fonksiyonu yazma
- localStorage entegrasyonu

### 6.3 Stil
- `.dehb-nav-item` ve `.dehb-content` class'ları (mevcut Tailwind + CSS ile)

### 6.4 Sayfa Yüklemesi
- Mevcut `loadPage()` fonksiyonu kullanılacak (değişim yok)

---

## 7. Kaynaklar

**İçerik Temeli:**
- `C:\Users\dmrta\Desktop\Projeler\FocusAid\DEHB-Bilgi-Raporu.md` (39 KB, 170 sayfa literature-review)
- Kullanıcı notları (Tip, belirtiler, yönetim stratejileri)
- CHADD.org, ADHD.org, Türkiye Psikiyatri Derneği

**Bilimsiz Temel:**
- Russell Barkley (Tepki İnhibisyonu Modeli)
- Thomas Brown (Bilişsel Şebeke Modeli)
- DMN/TPN araştırmaları
- DSM-5-TR / ICD-11 tanı kriterlerine dayalı 3-tip sınıflandırması

---

## 8. Bilinen Sınırlamalar & Notlar

1. **Teşhis/Tedavi Tavsiyesi Yok:** Platform eğitim amaçlı. Herhangi bir ilaç, terapi veya teşhis tavsiyesi içermeyecek.

2. **Mobil Responsive:** Şu aşamada web-only (masaüstü). Mini nav-bar mobile'da responsive hale getirilecek sonraki iterasyonda.

3. **Güncelleme:** İçerik geliştirilmiş kaynaklar veya kullanıcı feedback'e göre güncellenebilir, ama spec değişmeyecek.

4. **Erişilebilirlik:** Tüm linkler harici olacak (CHADD, ADHD.org vb), sitenin kendi servisi olmayacak.

---

## 9. Doğrulama Kriterleri (Definition of Done)

✅ Template yazılmış, index.html'ye entegre edilmiş
✅ Nav bar butonları çalışıyor
✅ Mini nav-bar tüm 5 bölümü şalıyor
✅ İçerik DEHB-friendly format'ta, dikkat süresi göz önüne alınmış
✅ localStorage sayfa kapatıp açıldığında son bölümü hatırlıyor
✅ Harici linkler çalışıyor
✅ Stil mevcut FocusAid tasarımıyla tutarlı
✅ Yüksek sesle test (okuduktan sonra anlamla uyumlu mu?)

---

**Sonraki Adım:** Implementation Planning (writing-plans skill)
