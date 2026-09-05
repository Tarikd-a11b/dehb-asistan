/* ══════════════════════════════════════════════════════════════
   FocusAid — 🧠 Düşünce Parkı (Brain Dump Drawer)
   Odak seansı sırasında akla takılan ani düşünceleri 3 saniyede
   park edip odağı kaybetmeden çalışma ekranına dönmeyi sağlar.
   ══════════════════════════════════════════════════════════════ */

const BrainDumpState = {
  thoughts: [],
  isOpen: false
};

const BRAIN_DUMP_STORAGE_KEY = 'focusaid_brain_dump';

function loadBrainDump() {
  try {
    const raw = localStorage.getItem(BRAIN_DUMP_STORAGE_KEY);
    BrainDumpState.thoughts = raw ? JSON.parse(raw) : [];
  } catch (e) {
    BrainDumpState.thoughts = [];
  }
  updateBrainDumpBadge();
}

function saveBrainDump() {
  try {
    localStorage.setItem(BRAIN_DUMP_STORAGE_KEY, JSON.stringify(BrainDumpState.thoughts));
  } catch (e) {}
  updateBrainDumpBadge();
}

function addThought(text) {
  const clean = String(text ?? '').trim();
  if (!clean) return null;

  const item = {
    id: 'bd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    text: clean,
    createdAt: new Date().toISOString(),
    completed: false
  };

  BrainDumpState.thoughts.unshift(item);
  saveBrainDump();
  renderBrainDumpList();
  return item;
}

function toggleThought(id) {
  const item = BrainDumpState.thoughts.find(t => t.id === id);
  if (item) {
    item.completed = !item.completed;
    saveBrainDump();
    renderBrainDumpList();
  }
}

function deleteThought(id) {
  BrainDumpState.thoughts = BrainDumpState.thoughts.filter(t => t.id !== id);
  saveBrainDump();
  renderBrainDumpList();
}

function clearCompletedThoughts() {
  BrainDumpState.thoughts = BrainDumpState.thoughts.filter(t => !t.completed);
  saveBrainDump();
  renderBrainDumpList();
}

function updateBrainDumpBadge() {
  const badge = document.getElementById('brain-dump-badge');
  const count = BrainDumpState.thoughts.filter(t => !t.completed).length;
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
}

function _escapeBd(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function getBrainDumpDrawer() {
  let drawer = document.getElementById('brain-dump-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'brain-dump-drawer';
    drawer.className = 'fixed inset-0 z-50 overflow-hidden pointer-events-none transition-all duration-300';
    drawer.innerHTML = `
      <div id="bd-backdrop" onclick="closeBrainDump()" class="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 transition-opacity duration-300 pointer-events-none"></div>
      <div id="bd-panel" class="absolute inset-y-0 right-0 max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-100 dark:border-slate-800 p-6 flex flex-col justify-between translate-x-full transition-transform duration-300 ease-out pointer-events-auto">
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">🧠</span>
              <div>
                <h3 class="font-extrabold text-base text-slate-900 dark:text-white">Düşünce Parkı</h3>
                <p class="text-[11px] text-slate-400">Aklına takılanı buraya yaz, unutma kaygısını sil.</p>
              </div>
            </div>
            <button onclick="closeBrainDump()" class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center text-xs font-bold transition">✕</button>
          </div>

          <!-- Hızlı Düşünce Girişi -->
          <div class="relative">
            <input type="text" id="bd-input" placeholder="Aklına ne takıldı? (Örn: Faturayı öde, Kedinin maması...)" 
                   onkeydown="if(event.key==='Enter') submitBrainDumpInput()"
                   class="w-full pl-3.5 pr-20 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner">
            <button onclick="submitBrainDumpInput()" class="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95">
              Ekle
            </button>
          </div>

          <!-- Düşünce Listesi -->
          <div id="bd-list" class="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1"></div>
        </div>

        <!-- Alt Bilgi & Temizleme -->
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>💡 Kısayol: <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold">Alt + D</kbd></span>
            <button onclick="clearCompletedThoughts()" class="hover:text-red-500 transition">Tamamlananları Temizle</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);
  }
  return drawer;
}

function submitBrainDumpInput() {
  const input = document.getElementById('bd-input');
  if (!input) return;
  const val = input.value.trim();
  if (val) {
    addThought(val);
    input.value = '';
  }
}

function renderBrainDumpList() {
  const list = document.getElementById('bd-list');
  if (!list) return;

  if (BrainDumpState.thoughts.length === 0) {
    list.innerHTML = `
      <div class="p-8 text-center text-slate-400 space-y-2">
        <div class="text-4xl">🍃</div>
        <p class="text-xs font-medium">Zihnin şu an tamamen berrak!</p>
        <p class="text-[11px] text-slate-500">Çalışırken aklına alakasız bir düşünce geldiğinde buraya yazarak zihninden atabilirsin.</p>
      </div>`;
    return;
  }

  list.innerHTML = BrainDumpState.thoughts.map(t => {
    return `
      <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 group transition hover:shadow-sm ${t.completed ? 'opacity-40 grayscale' : ''}">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleThought('${t.id}')"
                 class="w-4 h-4 rounded-md accent-indigo-600 cursor-pointer shrink-0">
          <span class="text-xs text-slate-800 dark:text-slate-200 font-medium truncate ${t.completed ? 'line-through text-slate-400' : ''}">${_escapeBd(t.text)}</span>
        </div>
        <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
          <button onclick="convertThoughtToTask('${_escapeBd(t.text)}', '${t.id}')" title="Bu düşünceyi AI Görev Parçalayıcıya aktar" class="p-1 text-xs hover:text-indigo-600 text-slate-400 transition">🧩</button>
          <button onclick="deleteThought('${t.id}')" title="Sil" class="p-1 text-xs hover:text-red-500 text-slate-400 transition">✕</button>
        </div>
      </div>`;
  }).join('');
}

function convertThoughtToTask(text, id) {
  deleteThought(id);
  closeBrainDump();
  if (typeof loadPage === 'function') {
    loadPage('chatbot');
    setTimeout(() => {
      const taskInput = document.getElementById('task-input');
      if (taskInput) {
        taskInput.value = text;
        taskInput.focus();
      }
    }, 200);
  }
}

function openBrainDump() {
  const drawer = getBrainDumpDrawer();
  const backdrop = document.getElementById('bd-backdrop');
  const panel = document.getElementById('bd-panel');

  drawer.classList.remove('pointer-events-none');
  backdrop.classList.remove('opacity-0', 'pointer-events-none');
  backdrop.classList.add('opacity-100');
  panel.classList.remove('translate-x-full');
  BrainDumpState.isOpen = true;

  renderBrainDumpList();
  setTimeout(() => {
    document.getElementById('bd-input')?.focus();
  }, 100);
}

function closeBrainDump() {
  const drawer = document.getElementById('brain-dump-drawer');
  const backdrop = document.getElementById('bd-backdrop');
  const panel = document.getElementById('bd-panel');

  if (drawer && backdrop && panel) {
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
      drawer.classList.add('pointer-events-none');
    }, 300);
  }
  BrainDumpState.isOpen = false;
}

function toggleBrainDump() {
  if (BrainDumpState.isOpen) closeBrainDump();
  else openBrainDump();
}

// Global Kısayol: Alt + D (veya Option + D)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      toggleBrainDump();
    }
    if (e.key === 'Escape' && BrainDumpState.isOpen) {
      closeBrainDump();
    }
  });

  document.addEventListener('DOMContentLoaded', loadBrainDump);
}

// Node.js test dışa aktarma
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BrainDumpState,
    addThought,
    toggleThought,
    deleteThought,
    clearCompletedThoughts
  };
}
