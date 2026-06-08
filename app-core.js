/**
 * FocusAid — app-core.js
 * Tüm JS modülleri (calender.js + script.js + app.js) buraya birleştirildi.
 * Çakışan değişkenler, tekrar eden fonksiyonlar temizlendi.
 */

// ─────────────────────────────────────────────
// 1. GLOBAL YAPILANDIRMA
// ─────────────────────────────────────────────
// config.js sayfaya script tag ile yüklendikten sonra FOCUSAID_CONFIG hazır olur.
const CONFIG = FOCUSAID_CONFIG;

// ─────────────────────────────────────────────
// 2. DURUM YÖNETİMİ (Tek kaynak, çakışma yok)
// ─────────────────────────────────────────────
const AppState = {
    calendar:    null,
    tokenClient: null,
    gapiReady:   false,
    gisReady:    false
};

// ─────────────────────────────────────────────
// 3. GOOGLE AUTH
// ─────────────────────────────────────────────
function gapiLoaded() {
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey:        CONFIG.GOOGLE_API_KEY,
                discoveryDocs: [CONFIG.DISCOVERY_DOC]
            });
            AppState.gapiReady = true;
            console.log('✅ Google API hazır.');
        } catch (err) {
            console.error('❌ Google API başlatılamadı:', err);
        }
    });
}

function gisLoaded() {
    AppState.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope:     CONFIG.SCOPES,
        callback:  ''
    });
    AppState.gisReady = true;
    console.log('✅ Google Identity hazır.');
}

function handleAuthClick() {
    if (!AppState.gisReady || !AppState.tokenClient) {
        alert('Google kimlik servisi henüz hazır değil, birkaç saniye bekle.');
        return;
    }
    AppState.tokenClient.callback = async (resp) => {
        if (resp.error) {
            console.error('Auth hatası:', resp.error);
            return;
        }
        const btn = document.getElementById('auth-btn');
        if (btn) {
            btn.textContent  = '✓ Google Bağlandı';
            btn.classList.add('text-emerald-600');
        }
        if (AppState.calendar) AppState.calendar.refetchEvents();
    };
    const prompt = gapi.client.getToken() === null ? 'consent' : '';
    AppState.tokenClient.requestAccessToken({ prompt });
}

// ─────────────────────────────────────────────
// 4. TAKVİM (FullCalendar)
// ─────────────────────────────────────────────
function initCalendar() {
    const el = document.getElementById('calendar');
    if (!el) return;

    AppState.calendar = new FullCalendar.Calendar(el, {
        initialView:  'dayGridMonth',
        locale:       'tr',
        headerToolbar: {
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek'
        },
        selectable: true,
        editable:   true,

        // Google'ın "summary" → FullCalendar'ın "title" dönüşümü
        eventDataTransform(eventData) {
            const isBreak = (eventData.summary || '').includes('Mola');
            return {
                id:              eventData.id,
                title:           eventData.summary || 'Başlıksız Görev',
                start:           eventData.start?.dateTime || eventData.start?.date,
                end:             eventData.end?.dateTime   || eventData.end?.date,
                description:     eventData.description || '',
                backgroundColor: isBreak ? '#10b981' : '#6366f1',
                borderColor:     'transparent'
            };
        },

        dateClick(info)  { openTaskForm(info.dateStr); },
        eventClick(info) { openTaskForm(info.event.startStr.split('T')[0], info.event); },

        googleCalendarApiKey: CONFIG.GOOGLE_API_KEY,
        events: { googleCalendarId: 'primary' }
    });

    AppState.calendar.render();
}

// ─────────────────────────────────────────────
// 5. GÖREV FORMU UI
// ─────────────────────────────────────────────
function openTaskForm(date, existingEvent = null) {
    const panel = document.getElementById('task-form-panel');
    if (!panel) return;

    // Alanları doldur
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
    };

    const now = new Date();
    setVal('task-date',  date);
    setVal('task-title', existingEvent?.title ?? '');
    setVal('task-desc',  existingEvent?.extendedProps?.description ?? '');
    setVal('task-start', existingEvent
        ? existingEvent.startStr.split('T')[1]?.slice(0,5)
        : `${String(now.getHours()).padStart(2,'0')}:00`
    );
    updateEndTime();

    panel.classList.remove('hidden');
    panel.classList.add('animate-slide-in');
    document.getElementById('task-title')?.focus();
}

function closeForm() {
    document.getElementById('task-form-panel')?.classList.add('hidden');
}

function updateEndTime() {
    const start = document.getElementById('task-start')?.value;
    if (!start) return;
    const [h, m] = start.split(':').map(Number);
    const endEl  = document.getElementById('task-end');
    if (endEl) endEl.value = `${String((h + 1) % 24).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────
// 6. GOOGLE TAKVİME KAYIT
// ─────────────────────────────────────────────
async function saveTaskToGoogle() {
    const title = document.getElementById('task-title')?.value?.trim();
    const date  = document.getElementById('task-date')?.value;
    const start = document.getElementById('task-start')?.value;
    const end   = document.getElementById('task-end')?.value;
    const desc  = document.getElementById('task-desc')?.value ?? '';

    if (!title) { alert('Kral, bir başlık girmelisin! ⚠️'); return; }
    if (!date || !start || !end) { alert('Tarih ve saat alanlarını doldur!'); return; }

    const event = {
        summary:     title,
        description: desc,
        start: { dateTime: `${date}T${start}:00`, timeZone: CONFIG.TIMEZONE },
        end:   { dateTime: `${date}T${end}:00`,   timeZone: CONFIG.TIMEZONE }
    };

    const saveBtn = document.querySelector('button[onclick="saveTaskToGoogle()"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Kaydediliyor...'; }

    try {
        await gapi.client.calendar.events.insert({ calendarId: 'primary', resource: event });
        AppState.calendar?.refetchEvents();
        closeForm();
        showToast('✅ Görev takvime işlendi!', 'success');
    } catch (err) {
        console.error('Google Calendar hatası:', err);
        showToast('❌ Google bağlantısını kontrol et kral!', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Takvime İşle'; }
    }
}

// ─────────────────────────────────────────────
// 7. n8n TAKVİM FORMU PARÇALAYICI
// ─────────────────────────────────────────────
async function triggerN8N_Split() {
    const title = document.getElementById('task-title')?.value?.trim();
    const desc  = document.getElementById('task-desc')?.value ?? '';
    const date  = document.getElementById('task-date')?.value;

    if (!title) { alert('Parçalamak için bir başlık girmelisin kral! ⚠️'); return; }

    const splitBtn = document.querySelector('button[onclick="triggerN8N_Split()"]');
    const origHTML = splitBtn?.innerHTML;
    if (splitBtn) { splitBtn.innerHTML = '⏳ Sherlock Analiz Ediyor...'; splitBtn.disabled = true; }

    const userProfile = JSON.parse(localStorage.getItem('focusaid_profile') || '{}');

    try {
        const res = await fetch(CONFIG.N8N_WEBHOOK, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ taskTitle: title, taskDescription: desc, targetDate: date, userProfile })
        });

        if (res.ok) {
            showToast('🧩 Görev parçalandı ve takvime yerleştirildi!', 'success');
            AppState.calendar?.refetchEvents();
            closeForm();
        } else {
            throw new Error(`n8n ${res.status}`);
        }
    } catch (err) {
        console.error('n8n hatası:', err);
        showToast('❌ n8n ulaşılamadı. Webhook\'un açık olduğundan emin ol kral!', 'error');
    } finally {
        if (splitBtn) { splitBtn.innerHTML = origHTML; splitBtn.disabled = false; }
    }
}

// ─────────────────────────────────────────────
// 8. SAYFA YÜKLEYİCİ (app.js mantığı)
// ─────────────────────────────────────────────
async function loadPage(pageName) {
    const main = document.getElementById('main-content');
    if (!main) return;

    main.innerHTML = `
        <div class="flex items-center justify-center h-64 text-slate-400">
            <div class="text-center">
                <div class="animate-spin text-3xl mb-3">⚙️</div>
                <p class="text-sm italic">Yükleniyor...</p>
            </div>
        </div>`;

    try {
        const res = await fetch(`./Html/${pageName}.html`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        main.innerHTML = await res.text();

        // Sayfa başlatıcıları
        const initializers = {
            calendar: () => typeof initCalendar     === 'function' && initCalendar(),
            profile:  () => typeof loadProfileToUI  === 'function' && loadProfileToUI()
        };
        initializers[pageName]?.();

        // Sidebar aktif durumu
        document.querySelectorAll('.sidebar-item').forEach(b =>
            b.classList.remove('active-link','bg-indigo-50','text-indigo-600','shadow-sm')
        );
        document.getElementById(`nav-${pageName}`)
            ?.classList.add('active-link','bg-indigo-50','text-indigo-600','shadow-sm');

        // Giriş animasyonu
        main.classList.remove('animate-slide-in');
        void main.offsetWidth;
        main.classList.add('animate-slide-in');

    } catch (err) {
        console.error('Sayfa yükleme hatası:', err);
        main.innerHTML = `
            <div class="p-12 glass-card border-2 border-dashed border-red-200 bg-red-50/50 text-center animate-slide-in">
                <span class="text-5xl mb-4 block">⚠️</span>
                <h3 class="text-xl font-bold text-red-700 mb-2">Modül Yüklenemedi</h3>
                <p class="text-slate-600 mb-4 italic">"${pageName}" sayfasına ulaşılamıyor.</p>
                <p class="text-xs text-slate-400 bg-white p-3 rounded-xl inline-block border">
                    Beklenen yol: ./Html/${pageName}.html
                </p>
                <br>
                <button onclick="location.reload()" class="mt-6 bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700 transition">
                    Yeniden Başlat
                </button>
            </div>`;
    }
}

// ─────────────────────────────────────────────
// 9. TOAST BİLDİRİM (alert() yerine)
// ─────────────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.getElementById('focusaid-toast');
    existing?.remove();

    const colors = {
        success: 'bg-emerald-600',
        error:   'bg-red-600',
        info:    'bg-indigo-600'
    };

    const toast = document.createElement('div');
    toast.id        = 'focusaid-toast';
    toast.className = `fixed bottom-6 right-6 z-50 ${colors[type] ?? colors.info} text-white px-6 py-3 rounded-2xl shadow-xl font-semibold text-sm animate-slide-in`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ─────────────────────────────────────────────
// 10. BAŞLATICI
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 FocusAid başlatılıyor...');
    loadPage('calendar');
});
