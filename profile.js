/**
 * FocusAid — profile.js
 * DEHB dostu profil yönetimi. LocalStorage ile senkronize.
 */

const DEFAULT_PROFILE = {
    medication:       false,
    focusPeriod:      25,
    workHours:        { start: '09:00', end: '18:00' },
    social:           'solo',
    energyPeak:       'morning',
    focusTrigger:     'silence',
    motivationNote:   '',
    mainObstacle:     'paralysis',
    breakStyle:       'pomodoro',
    todayMood:        '',
    hyperfocusLimit:  'none',
    lightSensitivity: 2,
    soundSensitivity: 2,
    envPref:          'minimal',
    rsdLevel:         2,
    regulationMethod: 'breathing',
    stimPref:         'fidget',
    superpowers:      []
};

let userProfile = {
    ...DEFAULT_PROFILE,
    ...JSON.parse(localStorage.getItem('focusaid_profile') || '{}')
};

// ─────────────────────────────────────────────
// MOD SEÇİCİ
// ─────────────────────────────────────────────
function setMood(mood) {
    userProfile.todayMood = mood;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mood-' + mood)?.classList.add('active');
}

// ─────────────────────────────────────────────
// HASSAS SLIDER ETİKETİ
// ─────────────────────────────────────────────
function updateSensLabel(displayId, val) {
    const el = document.getElementById(displayId);
    if (el) el.textContent = ['', 'Düşük', 'Orta', 'Yüksek'][parseInt(val)] || 'Orta';
}

// ─────────────────────────────────────────────
// İLAÇ DURUMU
// ─────────────────────────────────────────────
function setMed(active) {
    userProfile.medication = !!active;
    const btnYes = document.getElementById('med-yes');
    const btnNo  = document.getElementById('med-no');
    if (!btnYes || !btnNo) return;

    if (active) {
        btnYes.className = 'flex-1 p-3 border-2 border-purple-600 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-lg';
        btnNo.className  = 'flex-1 p-3 border rounded-xl text-xs font-bold bg-slate-50 text-slate-400 opacity-60';
    } else {
        btnYes.className = 'flex-1 p-3 border rounded-xl text-xs font-bold bg-slate-50 text-slate-400 opacity-60';
        btnNo.className  = 'flex-1 p-3 border-2 border-slate-300 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 shadow-inner';
    }
}

// ─────────────────────────────────────────────
// PROFİLİ KAYDET
// ─────────────────────────────────────────────
function saveProfile() {
    try {
        const safeGet = (id, fallback) => {
            const el = document.getElementById(id);
            return el ? el.value : fallback;
        };
        const energyEl = document.querySelector('input[name="energy-peak"]:checked');

        userProfile = {
            medication:       userProfile.medication,
            focusPeriod:      Number(safeGet('focus-period', userProfile.focusPeriod)) || 25,
            workHours: {
                start: safeGet('work-start', userProfile.workHours.start),
                end:   safeGet('work-end',   userProfile.workHours.end)
            },
            social:           safeGet('social-mode',       userProfile.social),
            energyPeak:       energyEl ? energyEl.value : userProfile.energyPeak,
            focusTrigger:     safeGet('focus-trigger',     userProfile.focusTrigger),
            motivationNote:   safeGet('motivation-note',   userProfile.motivationNote),
            mainObstacle:     safeGet('main-obstacle',     userProfile.mainObstacle),
            breakStyle:       safeGet('break-style',       userProfile.breakStyle),
            todayMood:        userProfile.todayMood,
            hyperfocusLimit:  safeGet('hyperfocus-limit',  userProfile.hyperfocusLimit),
            lightSensitivity: Number(safeGet('light-sensitivity', userProfile.lightSensitivity)),
            soundSensitivity: Number(safeGet('sound-sensitivity', userProfile.soundSensitivity)),
            envPref:          safeGet('env-pref',          userProfile.envPref),
            rsdLevel:         Number(safeGet('rsd-level',  userProfile.rsdLevel)),
            regulationMethod: safeGet('regulation-method', userProfile.regulationMethod),
            stimPref:         safeGet('stim-pref',         userProfile.stimPref),
            superpowers:      ['creativity','hyperfocus','energy','empathy','crisis','connections']
                                .filter(k => document.getElementById('sp-' + k)?.checked)
        };

        localStorage.setItem('focusaid_profile', JSON.stringify(userProfile));
        showSaveSuccess();

    } catch (err) {
        console.error('Kaydetme hatası:', err);
        alert('Kayıt sırasında bir hata oluştu. Konsolu kontrol et.');
    }
}

// ─────────────────────────────────────────────
// KAYDETME GERİ BİLDİRİMİ
// ─────────────────────────────────────────────
function showSaveSuccess() {
    const btn = document.getElementById('save-profile-btn');
    if (!btn) return;

    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '✅ Profil Güncellendi!';
    btn.style.background = 'linear-gradient(135deg,#059669,#047857)';

    setTimeout(() => {
        btn.innerHTML = orig;
        btn.style.background = '';
        btn.disabled = false;
    }, 2500);
}

// ─────────────────────────────────────────────
// UI'YA VERİ DOLDUR
// ─────────────────────────────────────────────
function loadProfileToUI() {
    const focusEl = document.getElementById('focus-period');
    if (!focusEl) return;

    const safeSet = (id, value) => {
        if (value === undefined || value === null) return;
        const el = document.getElementById(id);
        if (el) el.value = value;
    };

    safeSet('focus-period',      userProfile.focusPeriod);
    const fd = document.getElementById('focus-display');
    if (fd) fd.textContent = (userProfile.focusPeriod || 25) + ' dk';

    safeSet('work-start',        userProfile.workHours?.start);
    safeSet('work-end',          userProfile.workHours?.end);
    safeSet('social-mode',       userProfile.social);
    safeSet('focus-trigger',     userProfile.focusTrigger);
    safeSet('break-style',       userProfile.breakStyle);
    safeSet('motivation-note',   userProfile.motivationNote);
    safeSet('main-obstacle',     userProfile.mainObstacle);
    safeSet('hyperfocus-limit',  userProfile.hyperfocusLimit);
    safeSet('light-sensitivity', userProfile.lightSensitivity);
    safeSet('sound-sensitivity', userProfile.soundSensitivity);
    safeSet('env-pref',          userProfile.envPref);
    safeSet('rsd-level',         userProfile.rsdLevel);
    safeSet('regulation-method', userProfile.regulationMethod);
    safeSet('stim-pref',         userProfile.stimPref);

    updateSensLabel('light-display', userProfile.lightSensitivity || 2);
    updateSensLabel('sound-display', userProfile.soundSensitivity || 2);
    updateSensLabel('rsd-display',   userProfile.rsdLevel || 2);

    const radio = document.querySelector(`input[name="energy-peak"][value="${userProfile.energyPeak}"]`);
    if (radio) radio.checked = true;

    setMed(userProfile.medication);

    if (userProfile.todayMood) setMood(userProfile.todayMood);

    (userProfile.superpowers || []).forEach(k => {
        const cb = document.getElementById('sp-' + k);
        if (cb) cb.checked = true;
    });
}
