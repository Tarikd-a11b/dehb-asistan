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
