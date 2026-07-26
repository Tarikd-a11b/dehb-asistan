# Yönerge Dosyası Yükleyerek Görev Parçalama — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcı PDF/Word yönerge dosyası yüklesin; sistem başlığı, teslim tarihini ve zorunlulukları çıkarıp forma doldursun, kullanıcı onayladıktan sonra parçalama bu zorunluluklara göre yapılsın.

**Architecture:** Metin çıkarma tarayıcıda (`pdf.js` + `mammoth.js`) — n8n'in `Extract from File` node'u DOCX desteklemediği için. Analiz, yeni ve bağımsız bir n8n workflow'unda (`FocusAid Analyzer`). Saf mantık (dosya türü, kırpma, AI yanıtı doğrulama) `doc-intake-logic.js` içinde ve birim testli; DOM/ağ tarafı `doc-intake.js` içinde. Mevcut `FocusAid Processor` workflow'una yalnızca iki node dokunuşu.

**Tech Stack:** Vanilla JS (ES2020, global `<script>`), pdf.js + mammoth.js (CDN), n8n 2.26.6 + Gemini, `node --test` (Node 24, sıfır bağımlılık).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-26-yonerge-dosyasi-yukleme-design.md` — çelişki halinde spec kazanır.
- **Veritabanı değişikliği YOK.**
- **Planlama algoritması değişmez.** `Code in JavaScript` node'una dokunulmaz; tarih/saat yerleştirme Code node'un işi, AI yalnızca görev + `cognitive_load` üretir.
- **Dosya yükleme zorunlu değil.** Elle yazarak parçalama yolu her koşulda çalışmaya devam etmeli.
- **Analiz asla kendi başına takvime yazmaz.** Tek çıktısı doldurulmuş formdur.
- **AI çıktısına körlemesine güvenilmez.** Forma yazılmadan önce doğrulanır; geçersizse form doldurulmaz.
- **Tarih bulunamazsa `null`** — model uydurmaya zorlanmaz.
- **Sınırlar:** dosya 10 MB, çıkarılan metin 40.000 karakter (aşarsa kırpılır + kullanıcıya bildirilir).
- **Taranmış belge desteklenmiyor** (OCR kapsam dışı); metin katmanı yoksa ayrı hata mesajı verilir.
- **Testler:** `node --test` (argümansız — Windows'ta dizin argümanı `MODULE_NOT_FOUND` verir).
- **`index_2.html` ve `index.html` ikizdir** — biri değişirse diğeri kopyalanır (Task 6).
- **Dil:** kullanıcıya görünen tüm metinler Türkçe.
- **Tarayıcı testi:** `python -m http.server 3000` + `http://localhost:3000/auth.html` (`127.0.0.1` değil).
- **PowerShell'de commit mesajlarında çift tırnak kullanma** — native komuta geçerken argümanı böler, `unknown option` hatası verir.

---

### Task 1: Saf mantık modülü ve testleri

Dosya türü tespiti, metin kırpma, AI yanıtı doğrulama ve zorunluluk listesi ayrıştırma. En riskli kısım `validateAnalysis` — modelin döndürdüğü tarihi doğrulamadan forma yazmak istemiyoruz.

**Files:**
- Create: `doc-intake-logic.js`
- Create: `test/doc-intake-logic.test.js`

**Interfaces:**
- Consumes: yok
- Produces — `doc-intake.js` bu globalleri kullanacak:
  - `MAX_FILE_BYTES: number` (10485760)
  - `MAX_TEXT_CHARS: number` (40000)
  - `fileKind(name: string, mime: string) → 'pdf' | 'docx' | null`
  - `clampText(text: string) → { text: string, truncated: boolean }`
  - `validateAnalysis(raw: any) → { ok: boolean, data?: {title, deadline, deadlineQuote, requirements}, error?: string }`
  - `parseRequirements(value: string) → string[]`
  - `toLocalDatetimeInput(iso: string) → string` (`datetime-local` input'unun beklediği `YYYY-MM-DDTHH:mm`)

- [ ] **Step 1: Test dosyasını yaz**

`test/doc-intake-logic.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const L = require('../doc-intake-logic.js');

// ── fileKind ──
test('fileKind uzantidan turu bulur', () => {
  assert.strictEqual(L.fileKind('yonerge.pdf', ''), 'pdf');
  assert.strictEqual(L.fileKind('YONERGE.PDF', ''), 'pdf');
  assert.strictEqual(L.fileKind('odev.docx', ''), 'docx');
  assert.strictEqual(L.fileKind('resim.png', 'image/png'), null);
  assert.strictEqual(L.fileKind('eski.doc', ''), null);   // eski .doc formati desteklenmiyor
});

test('fileKind uzanti yoksa MIME turune bakar', () => {
  assert.strictEqual(L.fileKind('dosya', 'application/pdf'), 'pdf');
  assert.strictEqual(L.fileKind('dosya', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx');
});

// ── clampText ──
test('clampText sinir altinda dokunmaz', () => {
  const r = L.clampText('kisa metin');
  assert.strictEqual(r.text, 'kisa metin');
  assert.strictEqual(r.truncated, false);
});

test('clampText sinir ustunde kirpar ve bayrak koyar', () => {
  const r = L.clampText('a'.repeat(L.MAX_TEXT_CHARS + 500));
  assert.strictEqual(r.text.length, L.MAX_TEXT_CHARS);
  assert.strictEqual(r.truncated, true);
});

// ── parseRequirements ──
test('parseRequirements satirlara boler, bosluklari kirpar, bos satiri atar', () => {
  const girdi = '  4 asamali cizim  \n\nkatman kurallari\n   \nPDF ciktisi\n';
  assert.deepStrictEqual(L.parseRequirements(girdi), ['4 asamali cizim', 'katman kurallari', 'PDF ciktisi']);
});

test('parseRequirements bos girdide bos dizi doner', () => {
  assert.deepStrictEqual(L.parseRequirements(''), []);
  assert.deepStrictEqual(L.parseRequirements('   \n  \n'), []);
});

// ── validateAnalysis ──
const gecerli = {
  title: 'AutoCAD Portfolyo Odevi',
  deadline: '2026-08-15T23:59:00+03:00',
  deadlineQuote: 'Projeler 15 Agustos 2026 tarihine kadar teslim edilecektir.',
  requirements: ['4 asamali cizim', 'katman kurallari']
};

test('validateAnalysis gecerli yaniti kabul eder', () => {
  const r = L.validateAnalysis(gecerli);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.title, 'AutoCAD Portfolyo Odevi');
  assert.deepStrictEqual(r.data.requirements, ['4 asamali cizim', 'katman kurallari']);
});

test('validateAnalysis deadline null olmasina izin verir', () => {
  const r = L.validateAnalysis({ ...gecerli, deadline: null, deadlineQuote: null });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.deadline, null);
});

test('validateAnalysis ayristirilamayan tarihi reddeder', () => {
  const r = L.validateAnalysis({ ...gecerli, deadline: 'onumuzdeki hafta' });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /tarih/i);
});

test('validateAnalysis basliksiz yaniti reddeder', () => {
  assert.strictEqual(L.validateAnalysis({ ...gecerli, title: '' }).ok, false);
  assert.strictEqual(L.validateAnalysis({ ...gecerli, title: undefined }).ok, false);
});

test('validateAnalysis requirements dizi degilse reddeder', () => {
  const r = L.validateAnalysis({ ...gecerli, requirements: 'tek metin' });
  assert.strictEqual(r.ok, false);
});

test('validateAnalysis requirements eksikse bos dizi kabul eder', () => {
  const { requirements, ...eksik } = gecerli;
  const r = L.validateAnalysis(eksik);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.data.requirements, []);
});

test('validateAnalysis nesne olmayani reddeder', () => {
  assert.strictEqual(L.validateAnalysis(null).ok, false);
  assert.strictEqual(L.validateAnalysis('metin').ok, false);
});

test('validateAnalysis requirements icindeki bos maddeleri atar', () => {
  const r = L.validateAnalysis({ ...gecerli, requirements: ['  madde  ', '', '   ', 'ikinci'] });
  assert.deepStrictEqual(r.data.requirements, ['madde', 'ikinci']);
});

// ── toLocalDatetimeInput ──
test('toLocalDatetimeInput datetime-local formatina cevirir', () => {
  // 2026-08-15T23:59:00+03:00 -> yerel saat (Istanbul) 23:59
  assert.strictEqual(L.toLocalDatetimeInput('2026-08-15T23:59:00+03:00'), '2026-08-15T23:59');
});

test('toLocalDatetimeInput gecersiz girdide bos string doner', () => {
  assert.strictEqual(L.toLocalDatetimeInput('gecersiz'), '');
  assert.strictEqual(L.toLocalDatetimeInput(null), '');
});
```

- [ ] **Step 2: Testleri çalıştır, başarısız olduklarını gör**

Run: `node --test`
Expected: FAIL — `Cannot find module '../doc-intake-logic.js'`

- [ ] **Step 3: `doc-intake-logic.js` dosyasını yaz**

```js
/* ══════════════════════════════════════════════════════════════
   FocusAid — Yönerge dosyası alımı, saf mantık katmanı
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   Testler: node --test
   ══════════════════════════════════════════════════════════════ */

const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 10 MB
const MAX_TEXT_CHARS = 40000;              // ~15-20 sayfa

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Uzantıdan, olmazsa MIME'dan tür. Eski .doc (binary) DESTEKLENMİYOR. */
function fileKind(name, mime) {
  const ad = String(name || '').toLowerCase();
  if (ad.endsWith('.pdf')) return 'pdf';
  if (ad.endsWith('.docx')) return 'docx';
  const m = String(mime || '').toLowerCase();
  if (m === 'application/pdf') return 'pdf';
  if (m === DOCX_MIME) return 'docx';
  return null;
}

/** Uzun metni sınıra kırpar; kırpıldıysa çağıran kullanıcıyı uyarır. */
function clampText(text) {
  const t = String(text || '');
  if (t.length <= MAX_TEXT_CHARS) return { text: t, truncated: false };
  return { text: t.slice(0, MAX_TEXT_CHARS), truncated: true };
}

/** Textarea içeriğini madde listesine çevirir. */
function parseRequirements(value) {
  return String(value || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

/** ISO tarihi <input type="datetime-local"> biçimine (YYYY-MM-DDTHH:mm) çevirir. */
function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * AI yanıtını doğrular. Model çıktısı forma yazılmadan ÖNCE buradan geçer;
 * uydurulmuş/bozuk tarih doğrudan planlamayı kaydıracağı için güvenmiyoruz.
 */
function validateAnalysis(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Analiz sonucu okunamadı.' };
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return { ok: false, error: 'Yönergeden bir başlık çıkarılamadı.' };

  let deadline = null;
  if (raw.deadline !== null && raw.deadline !== undefined && raw.deadline !== '') {
    const d = new Date(raw.deadline);
    if (isNaN(d.getTime())) return { ok: false, error: 'Okunan teslim tarihi geçersiz.' };
    deadline = raw.deadline;
  }

  if (raw.requirements !== undefined && !Array.isArray(raw.requirements)) {
    return { ok: false, error: 'Zorunluluk listesi beklenen biçimde değil.' };
  }
  const requirements = (raw.requirements || [])
    .map(x => String(x || '').trim())
    .filter(Boolean);

  const deadlineQuote = typeof raw.deadlineQuote === 'string' ? raw.deadlineQuote.trim() : null;

  return { ok: true, data: { title, deadline, deadlineQuote: deadlineQuote || null, requirements } };
}

// Node testleri için; tarayıcıda `module` tanımsız olduğu için atlanır.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAX_FILE_BYTES, MAX_TEXT_CHARS,
    fileKind, clampText, parseRequirements, toLocalDatetimeInput, validateAnalysis
  };
}
```

- [ ] **Step 4: Testleri çalıştır, hepsinin geçtiğini gör**

Run: `node --test`
Expected: PASS — 14 (mevcut) + 16 (yeni) = 30 test, 0 fail. Hata varsa `doc-intake-logic.js` düzeltilir, test dosyası DEĞİŞTİRİLMEZ.

- [ ] **Step 5: Commit**

```bash
git add doc-intake-logic.js test/doc-intake-logic.test.js
git commit -m "feat: yonerge dosyasi alimi saf mantik katmani + testleri"
```

---

### Task 2: Dosya alanı ve metin çıkarma

Bu task sonunda dosya seçilebiliyor ve metni çıkarılıyor; analiz henüz yok, çıkarılan metnin uzunluğu ekranda görünüyor.

**Files:**
- Modify: `index_2.html` (CDN scriptleri, `tpl-chatbot` içine dosya alanı + zorunluluklar alanı)
- Create: `doc-intake.js`

**Interfaces:**
- Consumes: Task 1'den `fileKind`, `clampText`, `MAX_FILE_BYTES`. Bunlar `doc-intake-logic.js`'te
  top-level `const`/`function` olarak tanımlı; klasik `<script>` etiketleriyle yüklendikleri için global
  sözlükten erişilir ve `doc-intake.js` onlardan sonra yüklenir.
- Produces: `handleFileSelect(file)`, `extractText(file, kind)`, `setIntakeStatus(msg, type)`, `bindIntake()`

- [ ] **Step 1: CDN kütüphanelerini ve yeni scripti ekle**

`index_2.html` içinde `<script src="tasks-view.js"></script>` satırının ardına:

```html
<script src="https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js"></script>
<script src="doc-intake-logic.js"></script>
<script src="doc-intake.js"></script>
```

**pdf.js için ayrı `<script>` etiketi YOK.** ES modülü olarak dağıtıldığı için `doc-intake.js` içinde
dinamik `import()` ile, yalnızca ilk PDF yüklendiğinde çekilir (Step 4). Hem etiket hem dinamik import
koymak dosyayı iki kez indirir. `mammoth` ise klasik script olarak gelir ve `window.mammoth`'u tanımlar.

- [ ] **Step 2: `tpl-chatbot` içine dosya alanını ekle**

`index_2.html` içinde `tpl-chatbot` şablonunda, `<div class="relative group">` satırının HEMEN ÖNÜNE:

```html
      <label id="intake-drop" class="block border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
        <input type="file" id="intake-file" accept=".pdf,.docx" class="hidden">
        <span class="text-2xl">📄</span>
        <p class="text-sm font-semibold text-slate-600 mt-1">Yönerge dosyasını sürükle veya seç</p>
        <p class="text-[11px] text-slate-400">PDF veya Word (.docx) · en fazla 10 MB</p>
      </label>
      <p id="intake-status" class="hidden text-xs font-medium px-2"></p>
```

- [ ] **Step 3: Zorunluluklar alanını ve tarih kaynağı satırını ekle**

Aynı şablonda, `task-deadline` input'unu içeren `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">` bloğunun HEMEN ARDINA:

```html
      <div id="req-wrap" class="hidden space-y-1">
        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">Yönergeden çıkarılan zorunluluklar (her satır bir madde)</label>
        <textarea id="task-requirements" rows="4" class="w-full bg-white p-4 rounded-xl outline-none border-2 border-slate-100 focus:border-indigo-200 text-sm text-slate-600 transition-all" placeholder="Örn: 4 aşamalı çizim"></textarea>
        <p id="deadline-quote" class="hidden text-[11px] text-slate-400 italic px-2"></p>
      </div>
```

- [ ] **Step 4: `doc-intake.js` dosyasını yaz**

```js
/* ══════════════════════════════════════════════════════════════
   FocusAid — Yönerge dosyası alımı: DOM + metin çıkarma + analiz
   Saf hesaplar doc-intake-logic.js içinde.
   ══════════════════════════════════════════════════════════════ */

const IntakeState = { text: '', fileName: '', busy: false };

let _pdfjs = null;
async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  _pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs');
  _pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
  return _pdfjs;
}

function setIntakeStatus(msg, type = 'info') {
  const el = document.getElementById('intake-status');
  if (!el) return;
  const renk = { info: 'text-slate-500', error: 'text-red-500', success: 'text-emerald-600' };
  el.className = `text-xs font-medium px-2 ${renk[type] || renk.info}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

/** PDF'ten sayfa sayfa metin toplar. Şifreli/bozuk dosyada hata fırlatır. */
async function extractPdfText(file) {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const parcalar = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const sayfa = await pdf.getPage(i);
    const icerik = await sayfa.getTextContent();
    parcalar.push(icerik.items.map(x => x.str).join(' '));
  }
  return parcalar.join('\n');
}

async function extractDocxText(file) {
  const buf = await file.arrayBuffer();
  const sonuc = await mammoth.extractRawText({ arrayBuffer: buf });
  return sonuc.value || '';
}

async function extractText(file, kind) {
  return kind === 'pdf' ? extractPdfText(file) : extractDocxText(file);
}

async function handleFileSelect(file) {
  if (!file || IntakeState.busy) return;

  const kind = fileKind(file.name, file.type);
  if (!kind) { setIntakeStatus('Yalnızca PDF veya Word (.docx) yükleyebilirsin.', 'error'); return; }
  if (file.size > MAX_FILE_BYTES) {
    setIntakeStatus(`Dosya çok büyük (${Math.round(file.size / 1048576)} MB). Sınır 10 MB.`, 'error');
    return;
  }

  IntakeState.busy = true;
  setIntakeStatus('Yönerge okunuyor…', 'info');
  try {
    const ham = await extractText(file, kind);
    const { text, truncated } = clampText(ham);

    if (!text.trim()) {
      setIntakeStatus('Belgede metin bulunamadı — taranmış olabilir. Bilgileri elle girebilirsin.', 'error');
      return;
    }

    IntakeState.text = text;
    IntakeState.fileName = file.name;
    setIntakeStatus(
      truncated
        ? `${file.name} okundu (uzun olduğu için ilk 40.000 karakter alındı).`
        : `${file.name} okundu.`,
      'success'
    );
  } catch (e) {
    console.error('[Yönerge] metin çıkarılamadı:', e);
    const sifreli = String(e && e.name) === 'PasswordException';
    setIntakeStatus(
      sifreli ? 'Bu PDF şifreli. Şifresini kaldırıp tekrar dene.'
              : 'Dosya okunamadı. Bilgileri elle girebilirsin.',
      'error'
    );
  } finally {
    IntakeState.busy = false;
  }
}

// Dosya seçme + sürükle-bırak bağlantıları (şablon her yüklendiğinde kurulur)
function bindIntake() {
  const input = document.getElementById('intake-file');
  const drop = document.getElementById('intake-drop');
  if (!input || !drop) return;

  input.addEventListener('change', e => handleFileSelect(e.target.files && e.target.files[0]));

  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('border-indigo-400', 'bg-indigo-50/50');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('border-indigo-400', 'bg-indigo-50/50');
  }));
  drop.addEventListener('drop', e => handleFileSelect(e.dataTransfer && e.dataTransfer.files[0]));
}
```

- [ ] **Step 5: `loadPage` içinden `bindIntake`'i çağır**

`index_2.html` içindeki `loadPage` fonksiyonunda, chatbot için Enter desteğinin kurulduğu bloğu şu hale getir:

```js
  if (name === 'chatbot') {
    document.getElementById('task-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTaskToN8N(); } });
    if (typeof bindIntake === 'function') bindIntake();
  }
```

- [ ] **Step 6: Sözdizimi ve testleri doğrula**

Run: `node --check doc-intake.js` → hata yok
Run: `node --test` → 30 test PASS (regresyon)

- [ ] **Step 7: Tarayıcıda doğrula**

`http://localhost:3000/auth.html` → giriş → **Parçalayıcı**. Bırakma alanı görünmeli.
Gerçek bir PDF sürükle: `Desktop\Okul\TNCStaj\Proje\AutoCad\AutoCAD Ders Yönergesi.pdf`
Expected: "Yönerge okunuyor…" ardından "AutoCAD Ders Yönergesi.pdf okundu." Konsolda hata yok.
Bir `.png` sürükle → "Yalnızca PDF veya Word (.docx) yükleyebilirsin."

- [ ] **Step 8: Commit**

```bash
git add index_2.html doc-intake.js
git commit -m "feat: yonerge dosyasi birakma alani ve tarayicida metin cikarma"
```

---

### Task 3: Analiz workflow'u ve webhook yapılandırması

n8n tarafı. Bu task'ın çıktısı: çalışan bir `/webhook/focusaid-analyze` uç noktası.

**Files:**
- Create: `n8n-workflow-analyzer.json` (import edilecek workflow)
- Modify: `config.example.js`
- Modify: `config.js` (gitignored — elle)

**Interfaces:**
- Produces: `POST {N8N_ANALYZE_WEBHOOK}` → `{title, deadline, deadlineQuote, requirements}` JSON

- [ ] **Step 1: Analyzer workflow JSON'ını oluştur**

`n8n-workflow-analyzer.json`:

```json
{
  "name": "FocusAid Analyzer",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "focusaid-analyze",
        "responseMode": "responseNode",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [0, 0],
      "id": "analyze-webhook",
      "name": "Webhook",
      "webhookId": "focusaid-analyze-webhook"
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "=Sen bir proje yönergesi analiz asistanısın. Aşağıdaki belge metnini oku ve YALNIZCA JSON döndür.\n\nBUGÜNÜN TARİHİ: {{ $json.body.today }}\nDOSYA ADI: {{ $json.body.fileName }}\n\nBELGE METNİ:\n{{ $json.body.documentText }}\n\nİstenen JSON şeması:\n{\n  \"title\": \"projenin kısa adı (en fazla 60 karakter)\",\n  \"deadline\": \"ISO 8601 tarih, +03:00 ofsetiyle. Örn: 2026-08-15T23:59:00+03:00\",\n  \"deadlineQuote\": \"tarihin geçtiği cümlenin belgeden BİREBİR alıntısı\",\n  \"requirements\": [\"zorunluluk maddesi\", \"...\"]\n}\n\nKURALLAR:\n- Belgede net bir teslim tarihi YOKSA deadline ve deadlineQuote alanlarını null yap. ASLA tarih uydurma.\n- \"iki hafta içinde\" gibi göreli ifadeleri BUGÜNÜN TARİHİ'ne göre hesapla.\n- requirements: öğrencinin yapmak ZORUNDA olduğu somut çıktı ve kurallar. En fazla 12 madde, her biri tek satır, kısa.\n- Kapak sayfası, iletişim bilgisi, imza gibi bölümleri requirements'a KOYMA.\n- Yanıtın SADECE JSON olsun; markdown kod bloğu, açıklama, önsöz EKLEME.",
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.7,
      "position": [220, 0],
      "id": "analyze-agent",
      "name": "AI Agent"
    },
    {
      "parameters": {
        "respondWith": "text",
        "responseBody": "={{ $json.output }}",
        "options": {
          "responseHeaders": {
            "entries": [
              { "name": "Content-Type", "value": "application/json" },
              { "name": "Access-Control-Allow-Origin", "value": "*" }
            ]
          }
        }
      },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [440, 0],
      "id": "analyze-respond",
      "name": "Respond to Webhook"
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "AI Agent", "type": "main", "index": 0 }]] },
    "AI Agent": { "main": [[{ "node": "Respond to Webhook", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" }
}
```

- [ ] **Step 2: Workflow'u n8n'e import et ve modeli bağla**

n8n → sol üst menü → **Import from File** → `n8n-workflow-analyzer.json`.
Yeni bir workflow olduğu için mevcut `FocusAid Processor`'ın kimlik bilgileri ETKİLENMEZ.
İçe aktardıktan sonra **AI Agent** node'una bir **Google Gemini Chat Model** alt node'u bağla ve mevcut Gemini kimlik bilgisini seç (Processor'daki ile aynı).

- [ ] **Step 3: Her iki workflow'u da Active yap**

n8n'de `FocusAid Analyzer` ve `FocusAid Processor` workflow'larının sağ üstündeki **Active** anahtarını aç.

Gerekçe: `config.js` şu an `webhook-test` adresini kullanıyor ve n8n'de test webhook'u **tek seferliktir** — her istek öncesi editörde "Listen for test event" gerekir. Production adresi (`/webhook/…`) yalnızca workflow Active iken çalışır.

- [ ] **Step 4: `config.example.js`'i güncelle**

```js
    N8N_WEBHOOK:         'http://localhost:5678/webhook/focusaid-processor',
    N8N_ANALYZE_WEBHOOK: 'http://localhost:5678/webhook/focusaid-analyze',
```

(`webhook-test` → `webhook` değişikliğine dikkat.)

- [ ] **Step 5: `config.js`'i güncelle (gitignored, elle)**

Aynı iki satırı gerçek `config.js` dosyasına da uygula.

- [ ] **Step 6: Uç noktayı doğrula**

Run:
```bash
curl -s -X POST http://localhost:5678/webhook/focusaid-analyze \
  -H "Content-Type: application/json" \
  -d '{"documentText":"Bitirme projesi raporu 15 Agustos 2026 tarihine kadar teslim edilecektir. Rapor en az 20 sayfa olmali ve kaynakca icermelidir.","fileName":"test.txt","today":"2026-07-26"}'
```
Expected: `title`, `deadline` (2026-08-15…), `deadlineQuote` ve `requirements` alanlarını içeren JSON.

- [ ] **Step 7: Commit**

```bash
git add n8n-workflow-analyzer.json config.example.js
git commit -m "feat: FocusAid Analyzer workflowu ve production webhook adresleri"
```

---

### Task 4: Analizi bağla ve formu doldur

**Files:**
- Modify: `doc-intake.js`

**Interfaces:**
- Consumes: Task 1'den `validateAnalysis`, `toLocalDatetimeInput`; Task 3'ten `CONFIG.N8N_ANALYZE_WEBHOOK`
- Produces: `analyzeDocument(text, fileName)`, `fillFormFromAnalysis(data)`

- [ ] **Step 1: Analiz ve form doldurma fonksiyonlarını ekle**

`doc-intake.js` sonuna:

```js
/** Analiz webhook'unu çağırır. Ağ/JSON hatalarında null döner, throw ETMEZ. */
async function analyzeDocument(text, fileName) {
  const url = CONFIG.N8N_ANALYZE_WEBHOOK;
  if (!url) { console.warn('[Yönerge] N8N_ANALYZE_WEBHOOK tanımsız'); return null; }

  const bugun = localDayISO();   // tasks-logic.js'ten (yerel tarih, UTC değil)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentText: text, fileName, today: bugun })
  });
  if (!res.ok) throw new Error('analiz ' + res.status);

  const ham = await res.text();
  // Model bazen ```json ... ``` sarmalıyla döndürür; temizle.
  const temiz = ham.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(temiz);
}

function fillFormFromAnalysis(data) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('task-input', data.title);
  if (data.deadline) set('task-deadline', toLocalDatetimeInput(data.deadline));

  const wrap = document.getElementById('req-wrap');
  const alinti = document.getElementById('deadline-quote');
  set('task-requirements', data.requirements.join('\n'));
  if (wrap) wrap.classList.remove('hidden');

  if (alinti) {
    if (data.deadlineQuote) {
      alinti.textContent = `Yönergede geçen: "${data.deadlineQuote}"`;
      alinti.classList.remove('hidden');
    } else {
      alinti.classList.add('hidden');
    }
  }
}
```

- [ ] **Step 2: `handleFileSelect`'in başarı dalına analiz çağrısını ekle**

`handleFileSelect` içinde `setIntakeStatus(truncated ? … : …, 'success');` satırının HEMEN ARDINA:

```js
    setIntakeStatus('Yönerge inceleniyor…', 'info');
    try {
      const ham = await analyzeDocument(text, file.name);
      const dogrulama = validateAnalysis(ham);
      if (!dogrulama.ok) {
        setIntakeStatus(`${dogrulama.error} Bilgileri elle girebilirsin.`, 'error');
        return;
      }
      fillFormFromAnalysis(dogrulama.data);
      setIntakeStatus(
        dogrulama.data.deadline
          ? 'Yönerge okundu. Bilgileri kontrol edip Parçala\'ya bas.'
          : 'Yönerge okundu ama teslim tarihi bulunamadı — tarihi sen gir.',
        'success'
      );
    } catch (e) {
      console.error('[Yönerge] analiz hatası:', e);
      setIntakeStatus('Analiz edilemedi (n8n kapalı olabilir). Bilgileri elle girebilirsin.', 'error');
    }
```

- [ ] **Step 3: Sözdizimi ve testler**

Run: `node --check doc-intake.js` → hata yok
Run: `node --test` → 30 test PASS

- [ ] **Step 4: Mutlu yolu tarayıcıda doğrula**

Parçalayıcı → gerçek bir PDF yönerge yükle.
Expected: Başlık ve teslim tarihi alanları dolar, zorunluluklar textarea'sı görünür ve maddeler yazılır, tarihin altında `Yönergede geçen: "…"` satırı çıkar.

- [ ] **Step 5: Hata yollarını doğrula**

1. n8n'i durdur (`Stop-Process`), bir PDF yükle → "Analiz edilemedi (n8n kapalı olabilir)" çıkmalı, sayfa çalışır kalmalı, elle yazıp Parçala'ya basılabilmeli.
2. n8n'i başlat, taranmış/görüntü tabanlı bir PDF yükle → "Belgede metin bulunamadı — taranmış olabilir".
3. 10 MB'tan büyük bir dosya sürükle → boyut uyarısı, analiz denenmemeli.

- [ ] **Step 6: Commit**

```bash
git add doc-intake.js
git commit -m "feat: yonerge analizi ve formun otomatik doldurulmasi"
```

---

### Task 5: Zorunlulukları parçalamaya bağla

**Files:**
- Modify: `index_2.html` (`sendTaskToN8N`)
- n8n: `FocusAid Processor` → `Normalize & Calculate` ve `AI Agent` node'ları

**Interfaces:**
- Consumes: Task 1'den `parseRequirements`
- Produces: POST gövdesinde `requirements: string[]`

- [ ] **Step 1: `sendTaskToN8N`'e requirements ekle**

`index_2.html` içinde `sendTaskToN8N` fonksiyonundaki `fetch(CONFIG.N8N_WEBHOOK, …)` çağrısının gövdesini şununla değiştir:

```js
    const reqEl = document.getElementById('task-requirements');
    const requirements = typeof parseRequirements === 'function' ? parseRequirements(reqEl?.value) : [];
    const res = await fetch(CONFIG.N8N_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ taskTitle: task, taskDescription: descEl?.value?.trim() ?? '', deadline: dl, requirements, userId: currentUser?.id, supabaseToken: AppState.supabaseToken, userProfile: { focusPeriod: profile.focusPeriod ?? 25, energyPeak: profile.energyPeak ?? 'morning', medication: profile.medication ?? false, workHours: profile.workHours ?? {start:'09:00',end:'18:00'}, mainObstacle: profile.mainObstacle ?? 'paralysis', breakStyle: profile.breakStyle ?? 'long-break' } }) });
```

Not: `breakStyle` de eklendi. n8n'in `Normalize & Calculate` node'u bu alanı okuyup mola süresini hesaplıyordu, ama chatbot yolu onu göndermediği için mola hep varsayılana (15 dk) düşüyordu. Aynı satıra dokunuyoruz, burada düzeltmek doğru yer.

- [ ] **Step 2: `Normalize & Calculate` node'una requirements'ı ekle**

n8n → `FocusAid Processor` → `Normalize & Calculate`. `const deadlineRaw = body.deadline || body.targetDate;` satırının HEMEN ÖNÜNE:

```js
const requirements = Array.isArray(body.requirements) ? body.requirements.filter(Boolean) : [];
```

Ve aynı node'un `return` ettiği nesnede `profile` alanının yanına `requirements` ekle (nesne içinde `profile: {...}` satırının ardına):

```js
    requirements,
```

- [ ] **Step 3: `AI Agent` prompt'una zorunlulukları ekle**

n8n → `FocusAid Processor` → `AI Agent` → prompt metninin sonuna:

```
ZORUNLULUKLAR (yönergeden çıkarıldı):
{{ $json.requirements && $json.requirements.length ? $json.requirements.map(r => '- ' + r).join('\n') : '(belirtilmemiş)' }}

Ürettiğin mikro görevler bu maddelerin tamamını kapsamalı; her madde en az bir göreve karşılık gelmeli.
```

- [ ] **Step 4: Uçtan uca doğrula**

Parçalayıcı → PDF yönerge yükle → form dolsun → zorunluluklardan birini elle değiştir → **Parçala**.
Expected: Takvime bugünden itibaren görevler eklenir; `tasks` tablosuna hepsi yazılır; üretilen görev adları yüklenen yönergedeki maddelerle örtüşür (ör. "katman kuralları" maddesi varsa ona karşılık gelen bir görev bulunur).

Supabase kontrolü:
```sql
select name, day, start_time from public.tasks order by start_time;
```

- [ ] **Step 5: Commit**

```bash
git add index_2.html
git commit -m "feat: zorunluluk listesi parcalamaya gonderiliyor, breakStyle bugu duzeltildi"
```

---

### Task 6: İkiz dosya ve kapanış doğrulaması

**Files:**
- Modify: `index.html`

- [ ] **Step 1: `index.html`'i eşitle**

```bash
cp index_2.html index.html
diff index.html index_2.html && echo "IKIZ: FARK YOK"
```
Expected: `IKIZ: FARK YOK`

- [ ] **Step 2: Tüm birim testleri koştur**

Run: `node --test`
Expected: 30 test PASS.

- [ ] **Step 3: Regresyon — dosyasız yol hâlâ çalışıyor mu**

Parçalayıcı'da **hiç dosya yüklemeden** başlık + teslim tarihi yazıp Parçala'ya bas.
Expected: Eskisi gibi çalışır; `requirements` boş dizi gider, planlama bozulmaz.

- [ ] **Step 4: Regresyon — Bugün ekranı**

Bugün sekmesine geç, parçalanan görevler görünüyor mu, tamamlama ve erteleme çalışıyor mu.
Expected: Önceki özellik bozulmamış.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "chore: index.html ikizi esitlendi"
```
