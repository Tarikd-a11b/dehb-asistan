const test = require('node:test');
const assert = require('node:assert/strict');

// Mock localStorage
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  clear() { this.store = {}; }
};
global.document = {
  getElementById() { return null; }
};

const {
  BrainDumpState, addThought, toggleThought, deleteThought, clearCompletedThoughts,
  convertThoughtToTask, syncBrainDump, senkronHazirla, sunucuIleBirlestir, dusunceSatiri
} = require('../brain-dump.js');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Sahte Supabase: yalnız brain-dump.js'in kullandığı zincirler. `tablo` sunucudaki satırlar.
function sahteSb({ tablo = [], yazmaHatasi = null } = {}) {
  const kayit = { upsert: [], delete: [] };
  return {
    kayit, tablo,
    from(ad) {
      assert.equal(ad, 'brain_dump');
      return {
        async upsert(satirlar) {
          if (yazmaHatasi) return { error: yazmaHatasi };
          kayit.upsert.push(...satirlar);
          for (const s of satirlar) {
            const i = tablo.findIndex(x => x.id === s.id);
            if (i >= 0) tablo[i] = s; else tablo.push(s);
          }
          return { error: null };
        },
        delete() {
          return { async in(_, ids) { kayit.delete.push(...ids); return { error: null }; } };
        },
        select() {
          const zincir = {
            _uid: null,
            eq(_, uid) { this._uid = uid; return this; },
            async order() {
              return { data: tablo.filter(s => s.user_id === this._uid)
                .sort((a, b) => b.created_at.localeCompare(a.created_at)), error: null };
            }
          };
          return zincir;
        }
      };
    }
  };
}
const bekle = () => new Promise(r => setImmediate(r));
function oturumuKapat() { delete global.sb; delete global.currentUser; }

test('addThought adds clean thought to list and saves', () => {
  BrainDumpState.thoughts = [];
  const item = addThought('  Kedinin mamasını al  ');
  assert.ok(item);
  assert.equal(item.text, 'Kedinin mamasını al');
  assert.equal(item.completed, false);
  assert.equal(BrainDumpState.thoughts.length, 1);
});

test('addThought ignores empty or whitespace string', () => {
  BrainDumpState.thoughts = [];
  const item = addThought('   ');
  assert.equal(item, null);
  assert.equal(BrainDumpState.thoughts.length, 0);
});

test('toggleThought changes completed flag', () => {
  BrainDumpState.thoughts = [];
  const item = addThought('Faturayı öde');
  assert.equal(item.completed, false);
  toggleThought(item.id);
  assert.equal(item.completed, true);
  toggleThought(item.id);
  assert.equal(item.completed, false);
});

test('deleteThought removes item by id', () => {
  BrainDumpState.thoughts = [];
  const item1 = addThought('Düşünce 1');
  const item2 = addThought('Düşünce 2');
  assert.equal(BrainDumpState.thoughts.length, 2);
  deleteThought(item1.id);
  assert.equal(BrainDumpState.thoughts.length, 1);
  assert.equal(BrainDumpState.thoughts[0].id, item2.id);
});

test('clearCompletedThoughts purges completed items only', () => {
  BrainDumpState.thoughts = [];
  const item1 = addThought('Bitmemiş 1');
  const item2 = addThought('Bitecek 2');
  toggleThought(item2.id);
  clearCompletedThoughts();
  assert.equal(BrainDumpState.thoughts.length, 1);
  assert.equal(BrainDumpState.thoughts[0].text, 'Bitmemiş 1');
});

// ── Bulut senkronu ───────────────────────────────────────────────────────────

test('yeni düşünce UUID alır (tablo satırıyla aynı kimlik)', () => {
  BrainDumpState.thoughts = [];
  assert.match(addThought('Kimlik').id, UUID);
});

test('senkronHazirla: eski bd_ kimlikli düşünce yeni UUID ve bekliyor alır, UUID olan dokunulmaz', () => {
  const yeni = { id: '6f1c2b1e-1d2a-4c3b-9a8b-7c6d5e4f3a2b', text: 'a', createdAt: '2026-10-01T10:00:00Z', completed: false };
  const eski = { id: 'bd_1700000000000_abcd', text: 'b', createdAt: '2026-09-01T10:00:00Z', completed: true };
  const { thoughts, gidecek } = senkronHazirla([yeni, eski]);
  assert.equal(thoughts[0], yeni);
  assert.match(thoughts[1].id, UUID);
  assert.equal(thoughts[1].bekliyor, true);
  assert.equal(thoughts[1].text, 'b');
  assert.equal(thoughts[1].completed, true);
  assert.deepEqual(gidecek, [thoughts[1]]);
  assert.equal(eski.id, 'bd_1700000000000_abcd', 'girdi değişmemeli');
});

test('sunucuIleBirlestir: sunucu esas, yazılamamış yerel düşünce kaybolmaz, yeniden eskiye sıralı', () => {
  const satirlar = [{ id: 'a', text: 'sunucu', completed: true, created_at: '2026-10-02T00:00:00Z' }];
  const bekleyen = { id: 'b', text: 'yerel', completed: false, createdAt: '2026-10-03T00:00:00Z', bekliyor: true };
  const sonuc = sunucuIleBirlestir(satirlar, [bekleyen, { ...bekleyen, id: 'a' }]);
  assert.deepEqual(sonuc.map(t => t.id), ['b', 'a']);
  assert.deepEqual(sonuc[1], { id: 'a', text: 'sunucu', createdAt: '2026-10-02T00:00:00Z', completed: true });
});

test('dusunceSatiri tablo sütunlarına çevirir', () => {
  assert.deepEqual(dusunceSatiri({ id: 'x', text: 't', createdAt: 'z', completed: 1, bekliyor: true }, 'u1'),
    { id: 'x', user_id: 'u1', text: 't', completed: true, created_at: 'z' });
});

test('oturum yokken (misafir/çıkış) buluta hiçbir şey gitmez', async () => {
  oturumuKapat();
  BrainDumpState.thoughts = [];
  addThought('yalnız yerel');
  await syncBrainDump();
  assert.equal(BrainDumpState.thoughts.length, 1);
});

test('misafir modunda sb ve currentUser olsa bile buluta yazılmaz', async () => {
  const s = sahteSb();
  global.sb = s; global.currentUser = { id: 'misafir' }; global.isGuestMode = true;
  BrainDumpState.thoughts = [];
  addThought('demo');
  await bekle();
  assert.equal(s.kayit.upsert.length, 0);
  delete global.isGuestMode; oturumuKapat();
});

test('syncBrainDump: eski yerel düşünceler taşınır, sonra sunucu listesi gelir', async () => {
  localStorage.clear();
  const s = sahteSb({ tablo: [{ id: '11111111-1111-4111-8111-111111111111', user_id: 'u1', text: 'telefondan', completed: false, created_at: '2026-10-05T00:00:00Z' }] });
  global.sb = s; global.currentUser = { id: 'u1' };
  BrainDumpState.thoughts = [{ id: 'bd_1_x', text: 'eski yerel', createdAt: '2026-09-01T00:00:00Z', completed: false }];
  await syncBrainDump();
  assert.deepEqual(BrainDumpState.thoughts.map(t => t.text), ['telefondan', 'eski yerel']);
  assert.ok(BrainDumpState.thoughts.every(t => !t.bekliyor));
  assert.equal(s.kayit.upsert[0].user_id, 'u1');
  assert.equal(localStorage.getItem('focusaid_brain_dump_sahip'), 'u1');
  oturumuKapat();
});

test('syncBrainDump: başka hesabın önbelleği yeni hesaba YÜKLENMEZ', async () => {
  localStorage.clear();
  localStorage.setItem('focusaid_brain_dump_sahip', 'eski-hesap');
  const s = sahteSb();
  global.sb = s; global.currentUser = { id: 'yeni-hesap' };
  BrainDumpState.thoughts = [{ id: 'bd_1_x', text: 'eski hesabın sırrı', createdAt: '2026-09-01T00:00:00Z', completed: false }];
  await syncBrainDump();
  assert.equal(s.kayit.upsert.length, 0);
  assert.equal(BrainDumpState.thoughts.length, 0);
  oturumuKapat();
});

test('yazma hatasında düşünce silinmez, bekliyor işaretiyle önbellekte kalır', async () => {
  localStorage.clear();
  global.sb = sahteSb({ yazmaHatasi: { code: 'PGRST205', message: 'tablo yok' } });
  global.currentUser = { id: 'u1' };
  const uyari = console.warn; console.warn = () => {};
  BrainDumpState.thoughts = [];
  const item = addThought('ağ yok');
  await bekle();
  console.warn = uyari;
  assert.equal(item.bekliyor, true);
  assert.equal(JSON.parse(localStorage.getItem('focusaid_brain_dump'))[0].bekliyor, true);
  oturumuKapat();
});

test('silme ve tamamlananları temizleme buluta da gider', async () => {
  const s = sahteSb();
  global.sb = s; global.currentUser = { id: 'u1' };
  BrainDumpState.thoughts = [];
  const a = addThought('a'); const b = addThought('b'); const c = addThought('c');
  deleteThought(a.id);
  toggleThought(b.id);
  clearCompletedThoughts();
  await bekle();
  assert.deepEqual(s.kayit.delete, [a.id, b.id]);
  assert.deepEqual(BrainDumpState.thoughts.map(t => t.id), [c.id]);
  oturumuKapat();
});

test("convertThoughtToTask kesme işaretli metinde çalışır (Ali'yi ara)", () => {
  oturumuKapat();
  BrainDumpState.thoughts = [];
  const item = addThought("Ali'yi ara");
  convertThoughtToTask(item.id);
  assert.equal(BrainDumpState.thoughts.length, 0);
});
