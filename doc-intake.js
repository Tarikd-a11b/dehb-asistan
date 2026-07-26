/* ══════════════════════════════════════════════════════════════
   FocusAid — Yönerge dosyası alımı: DOM + metin çıkarma + analiz
   Saf hesaplar doc-intake-logic.js içinde.
   ══════════════════════════════════════════════════════════════ */

const IntakeState = { text: '', fileName: '', busy: false };

const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build';

let _pdfjs = null;
/** pdf.js ES modülü; yalnızca ilk PDF yüklendiğinde indirilir. */
async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  _pdfjs = await import(`${PDFJS_BASE}/pdf.min.mjs`);
  _pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
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

/** Analiz webhook'unu çağırır. Model bazen ```json sarmalıyla döndürür, temizlenir. */
async function analyzeDocument(text, fileName) {
  const url = CONFIG.N8N_ANALYZE_WEBHOOK;
  if (!url) throw new Error('N8N_ANALYZE_WEBHOOK tanimsiz');

  const bugun = localDayISO();   // tasks-logic.js — yerel tarih, UTC değil
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentText: text, fileName, today: bugun })
  });
  if (!res.ok) throw new Error('analiz ' + res.status);

  const ham = await res.text();
  const temiz = ham.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(temiz);
}

function fillFormFromAnalysis(data) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('task-input', data.title);
  if (data.deadline) set('task-deadline', toLocalDatetimeInput(data.deadline));

  set('task-requirements', data.requirements.join('\n'));
  document.getElementById('req-wrap')?.classList.remove('hidden');

  const alinti = document.getElementById('deadline-quote');
  if (alinti) {
    if (data.deadlineQuote) {
      alinti.textContent = `Yönergede geçen: "${data.deadlineQuote}"`;
      alinti.classList.remove('hidden');
    } else {
      alinti.classList.add('hidden');
    }
  }
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
    if (truncated) {
      setIntakeStatus(`${file.name} okundu (uzun olduğu için ilk 40.000 karakter alındı). İnceleniyor…`, 'info');
    } else {
      setIntakeStatus(`${file.name} okundu. İnceleniyor…`, 'info');
    }

    // ── Analiz ──
    try {
      const cevap = await analyzeDocument(text, file.name);
      const dogrulama = validateAnalysis(cevap);
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

/** Dosya seçme + sürükle-bırak bağlantıları; şablon her yüklendiğinde kurulur. */
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
