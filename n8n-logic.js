/**
 * FocusAid — n8n-logic.js
 * Chatbot parçalayıcı mantığı. app-core.js'deki CONFIG ve AppState'i kullanır.
 */

// ─────────────────────────────────────────────
// CHATBOT PARÇALAYICI
// ─────────────────────────────────────────────
async function sendTaskToN8N() {
    const taskInput     = document.getElementById('task-input');
    const descInput     = document.getElementById('task-desc');
    const deadlineInput = document.getElementById('task-deadline');

    const taskVal    = taskInput?.value?.trim();
    const deadlineVal = deadlineInput?.value;

    // Validasyon
    if (!taskVal || !deadlineVal) {
        addMessageToChat('⚠️ Planlama yapabilmem için bir görev adı ve teslim tarihi girmelisin kral!', 'error');
        return;
    }

    // Kullanıcı mesajını göster
    const deadlineFormatted = new Date(deadlineVal).toLocaleString('tr-TR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    addMessageToChat(
        `🚀 <b>Proje:</b> ${taskVal}<br>📅 <b>Hedef:</b> ${deadlineFormatted}`,
        'user'
    );

    // Loading göster
    setLoading(true);

    // Profil verilerini al
    const profile = JSON.parse(localStorage.getItem('focusaid_profile') || '{}');

    const payload = {
        taskTitle:       taskVal,
        taskDescription: descInput?.value?.trim() ?? '',
        deadline:        deadlineVal,
        userProfile: {
            focusPeriod:  profile.focusPeriod  ?? 25,
            energyPeak:   profile.energyPeak   ?? 'morning',
            medication:   profile.medication   ?? false,
            workHours:    profile.workHours    ?? { start: '09:00', end: '18:00' },
            mainObstacle: profile.mainObstacle ?? 'paralysis'
        }
    };

    try {
        const res = await fetch(CONFIG.N8N_WEBHOOK, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);

        const result    = await res.json().catch(() => ({}));
        const firstStep = result.firstStep || 'İlk mikro görevin takviminde hazır!';

        addMessageToChat(
            `✅ <b>Sis dağıtıldı!</b> n8n asistanın takvimini senin verimlilik saatlerine göre düzenledi.<br><br>` +
            `🎯 <b>Hadi şu ilk adıma odaklanalım:</b><br>"<i>${firstStep}</i>"`,
            'ai'
        );

        // Formu temizle
        if (taskInput)     taskInput.value     = '';
        if (descInput)     descInput.value     = '';
        if (deadlineInput) deadlineInput.value = '';

        // Takvimi yenile
        AppState.calendar?.refetchEvents();

    } catch (err) {
        console.error('n8n hatası:', err);
        addMessageToChat(
            '❌ n8n bağlantısı kurulamadı. n8n\'in açık olduğundan ve webhook URL\'inin doğru olduğundan emin ol kral.',
            'error'
        );
    } finally {
        setLoading(false);
    }
}

// ─────────────────────────────────────────────
// YARDIMCI: Mesaj baloncuğu ekle
// ─────────────────────────────────────────────
function addMessageToChat(text, type = 'ai') {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const typeClasses = {
        user:  'user-bubble ml-auto',
        ai:    'ai-bubble shadow-md',
        error: 'bg-red-50 text-red-700 mx-auto border border-red-200 rounded-2xl p-4 text-sm'
    };

    const div = document.createElement('div');
    div.className = `message-pop max-w-[85%] animate-slide-in ${typeClasses[type] ?? typeClasses.ai}`;
    div.innerHTML  = text;

    // Loading metninin üstüne ekle
    const loading = document.getElementById('loading-text');
    loading ? chatBox.insertBefore(div, loading) : chatBox.appendChild(div);

    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// YARDIMCI: Loading durumu
// ─────────────────────────────────────────────
function setLoading(visible) {
    const el = document.getElementById('loading-text');
    if (el) el.classList.toggle('hidden', !visible);
}

// ─────────────────────────────────────────────
// Enter tuşu desteği
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('task-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendTaskToN8N();
        }
    });
});
