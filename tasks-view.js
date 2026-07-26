/* ══════════════════════════════════════════════════════════════
   FocusAid — Bugün ekranı görünüm katmanı
   DOM render + Supabase/GAPI çağrıları. Saf hesaplar tasks-logic.js'te.
   ══════════════════════════════════════════════════════════════ */

const TodayState = { rows: [], today: [], carried: [], timer: null };

async function initToday() {
  stopTodayTimer();
  await loadTasks();
  renderToday();
  TodayState.timer = setInterval(renderToday, 60000);
}

function stopTodayTimer() {
  if (TodayState.timer) { clearInterval(TodayState.timer); TodayState.timer = null; }
}

async function loadTasks() {
  if (!currentUser) { console.log('[Bugün] oturum henüz hazır değil, yükleme atlandı'); return; }
  const todayISO = localDayISO();
  const baslangic = addDaysISO(todayISO, -CARRY_OVER_DAYS);

  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .gte('day', baslangic)
    .lte('day', todayISO)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[Bugün] sorgu hatası:', error);
    showToast('Görevler yüklenemedi.', 'error');
    return;
  }

  TodayState.rows = data || [];
  const { today, carried } = splitTasks(TodayState.rows, todayISO);
  TodayState.today = today;
  TodayState.carried = carried;

  console.log(`[Bugün] pencere ${baslangic} → ${todayISO} | gelen kayıt: ${TodayState.rows.length} | bugün: ${today.length} | devreden: ${carried.length}`);
  if (TodayState.rows.length === 0) {
    // Tablo boş mu, yoksa yalnızca bu tarih penceresi mi boş? Ayırt et.
    const { count, error: sayimHatasi } = await sb.from('tasks').select('*', { count: 'exact', head: true });
    console.log('[Bugün] tablodaki TOPLAM kayıt (tarih filtresiz):', count, sayimHatasi || '');
  }
}

function saatAralik(task) {
  const f = d => new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${f(task.start_time)} – ${f(task.end_time)}`;
}

const YUK_ETIKET = { low: 'Hafif', medium: 'Orta', high: 'Ağır' };

function taskRowHTML(task, todayISO) {
  const etiket = dayLabel(task.day, todayISO);
  const rozet = etiket
    ? `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${etiket}</span>`
    : '';
  return `
    <div class="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 ${task.completed ? 'opacity-50' : ''}">
      <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}')"
             class="w-5 h-5 accent-indigo-600 cursor-pointer shrink-0">
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-slate-700 truncate ${task.completed ? 'line-through' : ''}">${task.name || 'Görev'}</p>
        <p class="text-xs text-slate-400">${saatAralik(task)}</p>
      </div>
      ${rozet}
    </div>`;
}

function currentCardHTML(task) {
  if (!task) {
    return `<div class="glass-card p-10 bg-white text-center">
              <div class="text-4xl mb-3">🎉</div>
              <p class="font-bold text-slate-700">Bugünlük bu kadar!</p>
              <p class="text-slate-400 text-sm mt-1">Planladığın her şeyi bitirdin.</p>
            </div>`;
  }
  const yuk = YUK_ETIKET[task.cognitive_load] || '';
  const yukRozet = yuk
    ? `<span class="adhd-badge" style="background:#eef2ff;color:#4f46e5;border-color:#c7d2fe">${yuk}</span>`
    : '';
  return `
    <div class="glass-card p-10 bg-white shadow-2xl border-l-4 border-indigo-500 space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sırada</p>
          <h3 class="text-3xl font-extrabold text-slate-900 leading-tight">${task.name || 'Görev'}</h3>
          ${task.summary ? `<p class="text-slate-500 mt-2 leading-relaxed">${task.summary}</p>` : ''}
          <p class="text-sm font-bold text-indigo-600 mt-3">${saatAralik(task)}</p>
        </div>
        ${yukRozet}
      </div>
      <div class="flex gap-4">
        <button onclick="toggleTask('${task.id}')" class="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">✓ Tamamlandı</button>
        <button onclick="snoozeTask('${task.id}')" class="flex-1 bg-slate-50 text-slate-600 px-6 rounded-2xl font-bold border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all">Sonraya al</button>
      </div>
    </div>`;
}

function renderToday() {
  const emptyEl = document.getElementById('today-empty');
  const listEl = document.getElementById('today-list');
  const currentEl = document.getElementById('today-current');
  const barEl = document.getElementById('today-progress-bar');
  const textEl = document.getElementById('today-progress-text');
  if (!emptyEl || !listEl || !currentEl) return;

  const todayISO = localDayISO();
  const hepsi = [...TodayState.carried, ...TodayState.today];
  const bos = hepsi.length === 0;

  emptyEl.classList.toggle('hidden', !bos);
  listEl.classList.toggle('hidden', bos);
  currentEl.classList.toggle('hidden', bos);
  if (bos) { if (textEl) textEl.textContent = '0/0'; if (barEl) barEl.style.width = '0%'; return; }

  const { done, total } = computeProgress(TodayState.today, TodayState.carried);
  if (textEl) textEl.textContent = `${done}/${total}`;
  if (barEl) barEl.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';

  currentEl.innerHTML = currentCardHTML(pickCurrentTask(hepsi, new Date()));
  listEl.innerHTML = hepsi.map(t => taskRowHTML(t, todayISO)).join('');
}

// ── TAMAMLAMA ────────────────────────────────────────────────────────────────
function findTask(id) {
  return TodayState.rows.find(t => String(t.id) === String(id));
}

async function toggleTask(id) {
  const task = findTask(id);
  if (!task) return;

  const yeniDurum = !task.completed;
  task.completed = yeniDurum;   // iyimser: UI hemen güncellenir
  renderToday();

  const { error } = await sb.from('tasks').update({ completed: yeniDurum }).eq('id', task.id);
  if (error) {
    task.completed = !yeniDurum;   // geri al
    renderToday();
    showToast('Kaydedilemedi, tekrar dene.', 'error');
    return;
  }

  syncCalendarMark(task, yeniDurum);   // await YOK: ana akışı bekletmez
}

// ── TAKVİM SENKRONU (best-effort) ────────────────────────────────────────────
/** Takvim etkinliğini işaretler. Hata YUTULUR, çağıran akış bozulmaz. */
async function syncCalendarMark(task, done) {
  if (!task.calendar_event_id) return;
  if (!AppState.googleAccessToken || !AppState.gapiReady) {
    showToast('Görev kaydedildi, takvim bağlı değil.', 'info');
    return;
  }
  try {
    const temizAd = (task.name || 'Görev').replace(/^✓\s*/, '');
    await gapi.client.calendar.events.patch({
      calendarId: 'primary',
      eventId: task.calendar_event_id,
      resource: done
        ? { summary: '✓ ' + temizAd, colorId: '10' }   // 10 = yeşil
        : { summary: temizAd, colorId: null }
    });
    AppState.calendar?.refetchEvents();
  } catch (e) {
    console.warn('Takvim güncellenemedi:', e);
    showToast('Görev kaydedildi, takvim güncellenemedi.', 'info');
  }
}

// ── ERTELEME ─────────────────────────────────────────────────────────────────
async function snoozeTask(id) {
  const task = findTask(id);
  if (!task) return;

  const profile = JSON.parse(localStorage.getItem('focusaid_profile') || '{}');
  const yeni = computeSnooze(task, profile);

  const eski = { start_time: task.start_time, end_time: task.end_time, day: task.day };
  Object.assign(task, yeni);   // iyimser
  const todayISO = localDayISO();
  const g1 = splitTasks(TodayState.rows, todayISO);
  TodayState.today = g1.today; TodayState.carried = g1.carried;
  renderToday();

  const { error } = await sb.from('tasks')
    .update({ start_time: yeni.start_time, end_time: yeni.end_time, day: yeni.day })
    .eq('id', task.id);

  if (error) {
    Object.assign(task, eski);   // geri al
    const g2 = splitTasks(TodayState.rows, todayISO);
    TodayState.today = g2.today; TodayState.carried = g2.carried;
    renderToday();
    showToast('Ertelenemedi, tekrar dene.', 'error');
    return;
  }

  snoozeCalendarEvent(task, yeni);
  const dk = (profile.focusPeriod ?? 25) + (BREAK_MAP[profile.breakStyle] ?? 15);
  showToast(`${dk} dakika sonraya alındı.`, 'success');
}

/** Takvim etkinliğini kaydırır. Best-effort: hata YUTULUR. */
async function snoozeCalendarEvent(task, yeni) {
  if (!task.calendar_event_id) return;
  if (!AppState.googleAccessToken || !AppState.gapiReady) return;
  try {
    await gapi.client.calendar.events.patch({
      calendarId: 'primary',
      eventId: task.calendar_event_id,
      resource: {
        start: { dateTime: yeni.start_time, timeZone: CONFIG.TIMEZONE },
        end:   { dateTime: yeni.end_time,   timeZone: CONFIG.TIMEZONE }
      }
    });
    AppState.calendar?.refetchEvents();
  } catch (e) {
    console.warn('Takvim etkinliği kaydırılamadı:', e);
  }
}
