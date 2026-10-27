/**
 * Supabase RLS matris testi — CANLI veritabanında, iki gerçek test kullanıcısıyla.
 *
 *   node --test scripts/rls-matris.mjs
 *
 * Ortam (hiçbiri tanımlı değilse test ATLANIR, CI kırmızıya dönmez):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   RLS_A_EMAIL, RLS_A_PASSWORD, RLS_B_EMAIL, RLS_B_PASSWORD
 *     → Supabase Dashboard → Authentication → Users → "Add user" ile iki TEST hesabı
 *       (Email provider açık olmalı; gerçek hesabını KULLANMA, test satır yazıp siler).
 *
 * ⚠️ service_role anahtarı burada YOK ve olmamalı: RLS'yi atladığı için her test
 * geçer, hiçbir şey öğrenilmez. Yalnız anon anahtar + kullanıcı JWT'si.
 *
 * Neyi kanıtlıyor: anon hiçbir tabloyu okuyamaz/yazamaz; B, A'nın satırını
 * göremez/değiştiremez/silemez; A satırını B'ye devredemez ve B adına satır
 * ekleyemez; room_reports'u kimse okuyamaz; B, A'nın google_refresh_token'ını
 * göremez. "Boş sonuç" iddiaları satırın GERÇEKTEN var olduğu (A görüyor)
 * doğrulandıktan sonra yapılır — yoksa test hiçbir şey kanıtlamaz.
 * Red ayrımı: 42501 + "row-level security" = RLS reddi; "permission denied for
 * table" = GRANT eksik (RLS hiç devreye girmemiş) → ikisi ayrı raporlanır.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert';

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const GEREKLI = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'RLS_A_EMAIL', 'RLS_A_PASSWORD', 'RLS_B_EMAIL', 'RLS_B_PASSWORD'];
const eksik = GEREKLI.filter(k => !process.env[k]);
const atla = eksik.length ? `ortam eksik: ${eksik.join(', ')}` : false;

const kisiler = {};
const temizlenecek = [];   // [tablo, id] — A'nın yazdığı test satırları

async function giris(email, sifre) {
  const y = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: sifre })
  });
  const g = await y.json();
  if (!y.ok) throw new Error(`giriş başarısız (${email}): ${g.error_description || g.msg || y.status}`);
  return { token: g.access_token, id: g.user.id };
}

/** PostgREST çağrısı. kim: null = anon. Dönüş: { durum, govde }. */
async function rest(kim, yontem, yol, govde) {
  const y = await fetch(`${URL_}/rest/v1/${yol}`, {
    method: yontem,
    headers: {
      apikey: ANON, Authorization: 'Bearer ' + (kim ? kim.token : ANON),
      'Content-Type': 'application/json', Prefer: 'return=representation'
    },
    body: govde === undefined ? undefined : JSON.stringify(govde)
  });
  const metin = await y.text();
  let g; try { g = metin ? JSON.parse(metin) : null; } catch (e) { g = metin; }
  return { durum: y.status, govde: g };
}

/** Yazma reddi: RLS (42501 + row-level security) mi, GRANT eksiği mi? */
function rlsReddi(sonuc, baglam) {
  const kod = sonuc.govde && sonuc.govde.code, mesaj = String(sonuc.govde && sonuc.govde.message || '');
  assert.ok(sonuc.durum >= 400, `${baglam}: REDDEDİLMEDİ (HTTP ${sonuc.durum}) ${JSON.stringify(sonuc.govde).slice(0, 200)}`);
  assert.ok(!/permission denied for table/i.test(mesaj),
    `${baglam}: reddedildi ama GRANT eksikliğinden ("${mesaj}") — RLS sınanmadı`);
  assert.ok(kod === '42501' || /row-level security/i.test(mesaj),
    `${baglam}: beklenmeyen ret ${kod} "${mesaj}"`);
}
/** anon için: GRANT yokluğu da (permission denied) güvenli sonuçtur. */
function anonOkuyamaz(sonuc, baglam) {
  if (sonuc.durum >= 400) return;
  assert.deepStrictEqual(sonuc.govde, [], `${baglam}: anon satır gördü`);
}
function anonYazamaz(sonuc, baglam) {
  assert.ok(sonuc.durum >= 400, `${baglam}: anon YAZDI (HTTP ${sonuc.durum})`);
}
const bos = (sonuc, baglam) => {
  assert.strictEqual(sonuc.durum < 300, true, `${baglam}: HTTP ${sonuc.durum} ${JSON.stringify(sonuc.govde).slice(0, 200)}`);
  assert.deepStrictEqual(sonuc.govde, [], `${baglam}: boş olmalıydı`);
};

// Her tablo için A'nın yazabileceği en küçük geçerli satır.
const TABLOLAR = {
  tasks: a => ({ user_id: a.id, name: 'rls-matris test', completed: false }),
  brain_dump: a => ({ user_id: a.id, text: 'rls-matris test' }),
  room_sessions: a => ({ user_id: a.id, room: 'canli-gece' }),
};

before(async () => {
  if (atla) return;
  kisiler.A = await giris(process.env.RLS_A_EMAIL, process.env.RLS_A_PASSWORD);
  kisiler.B = await giris(process.env.RLS_B_EMAIL, process.env.RLS_B_PASSWORD);
  assert.notStrictEqual(kisiler.A.id, kisiler.B.id, 'A ve B aynı kullanıcı');
});

after(async () => {
  if (atla) return;
  for (const [tablo, id] of temizlenecek) await rest(kisiler.A, 'DELETE', `${tablo}?id=eq.${id}`);
});

for (const [tablo, satir] of Object.entries(TABLOLAR)) {
  test(`${tablo}: anon / B / sahiplik devri`, { skip: atla }, async () => {
    const { A, B } = kisiler;
    // anon
    anonOkuyamaz(await rest(null, 'GET', `${tablo}?select=id&limit=5`), `anon SELECT ${tablo}`);
    anonYazamaz(await rest(null, 'POST', tablo, satir(A)), `anon INSERT ${tablo}`);

    // A kendi satırını yazar; gerçekten var mı?
    const yaz = await rest(A, 'POST', tablo, satir(A));
    assert.strictEqual(yaz.durum, 201, `A INSERT ${tablo}: ${JSON.stringify(yaz.govde).slice(0, 200)}`);
    const id = yaz.govde[0].id;
    temizlenecek.push([tablo, id]);
    assert.strictEqual((await rest(A, 'GET', `${tablo}?id=eq.${id}&select=id`)).govde.length, 1, 'A kendi satırını görmeli');

    // B: gör / değiştir / sil → hiçbiri satıra dokunmaz
    bos(await rest(B, 'GET', `${tablo}?id=eq.${id}&select=id`), `B SELECT A'nın ${tablo}`);
    const degistir = tablo === 'tasks' ? { completed: true } : tablo === 'brain_dump' ? { completed: true } : { active_seconds: 999 };
    bos(await rest(B, 'PATCH', `${tablo}?id=eq.${id}`, degistir), `B UPDATE A'nın ${tablo}`);
    bos(await rest(B, 'DELETE', `${tablo}?id=eq.${id}`), `B DELETE A'nın ${tablo}`);
    assert.strictEqual((await rest(A, 'GET', `${tablo}?id=eq.${id}&select=id`)).govde.length, 1, 'B silememeli');

    // A satırını B'ye devredemez, B adına satır ekleyemez
    rlsReddi(await rest(A, 'PATCH', `${tablo}?id=eq.${id}`, { user_id: B.id }), `A ${tablo} sahipliğini B'ye devretti`);
    rlsReddi(await rest(A, 'POST', tablo, satir(B)), `A, B adına ${tablo} ekledi`);
  });
}

test('profiles: B, A\'nın profilini ve refresh token\'ını göremez / değiştiremez', { skip: atla }, async () => {
  const { A, B } = kisiler;
  assert.strictEqual((await rest(A, 'GET', `profiles?id=eq.${A.id}&select=id`)).govde.length, 1, 'A profili yok (trigger?)');
  anonOkuyamaz(await rest(null, 'GET', 'profiles?select=id&limit=5'), 'anon SELECT profiles');
  bos(await rest(B, 'GET', `profiles?id=eq.${A.id}&select=id,google_refresh_token`), "B SELECT A'nın profili");
  bos(await rest(B, 'PATCH', `profiles?id=eq.${A.id}`, { google_refresh_token: 'B-yazdi' }), "B UPDATE A'nın profili");
  rlsReddi(await rest(B, 'POST', 'profiles', { id: A.id }), "B, A adına profil ekledi");
});

test('room_reports: kimse okuyamaz, başkası adına eklenemez', { skip: atla }, async () => {
  const { A, B } = kisiler;
  // Gerçek satır EKLENMİYOR: silme politikası yok, test kalıntı bırakırdı.
  bos(await rest(A, 'GET', 'room_reports?select=id&limit=5'), 'A SELECT room_reports');
  anonOkuyamaz(await rest(null, 'GET', 'room_reports?select=id&limit=5'), 'anon SELECT room_reports');
  rlsReddi(await rest(A, 'POST', 'room_reports', { reporter_id: B.id, room: 'canli-gece', reason: 'rls-matris' }),
    'A, B adına bildirim ekledi');
});
