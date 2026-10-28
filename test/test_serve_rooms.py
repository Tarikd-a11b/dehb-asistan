"""serve.py — canli oda uclari (/api/rooms/token, /api/rooms/presence, /api/rooms/jitsi).

    python -m unittest discover -s test -p "test_*.py"

Gercek sunucu bos bir portta acilir; Supabase ve Daily cagrilari sahteyle
degistirilir (ag yok). Dogrulanan: kimliksiz 401, bilinmeyen oda 400,
anahtarsiz 503, gunluk sinir 429, basarida token + kalan dakika,
presence onbellegi ve tek oda sayisinin 6 ile sinirlanmasi.
"""
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import serve  # noqa: E402

KULLANICI = {'id': '11111111-1111-1111-1111-111111111111',
             'email': 'gizli@ornek.com',
             'user_metadata': {'full_name': 'Ayşe Yılmaz'}}


class OdaUclari(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        serve.socketserver.ThreadingTCPServer.allow_reuse_address = True
        cls.sunucu = serve.socketserver.ThreadingTCPServer(('127.0.0.1', 0), serve.NoCacheHandler)
        cls.taban = 'http://127.0.0.1:%d' % cls.sunucu.server_address[1]
        threading.Thread(target=cls.sunucu.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.sunucu.shutdown()
        cls.sunucu.server_close()

    def setUp(self):
        self._yedek = {k: getattr(serve, k) for k in
                       ('supabase_kullanicisi', 'daily_istek', 'bugunku_oda_saniyesi')}
        self._env = dict(os.environ)
        os.environ.update(DAILY_API_KEY='test-anahtar', DAILY_DOMAIN='https://focusaid.daily.co/')
        os.environ.pop('GUNLUK_LIMIT_DK', None)
        serve.supabase_kullanicisi = lambda t: KULLANICI if t == 'iyi' else None
        serve.bugunku_oda_saniyesi = lambda t: 0
        self.daily_cagrilari = []

        def sahte_daily(yontem, yol, govde=None):
            self.daily_cagrilari.append((yontem, yol, govde))
            if yol == '/meeting-tokens':
                return 200, {'token': 'daily-token'}
            if yol == '/presence':
                return 200, {'canli-gece': [{}] * 9, 'canli-sabah': [{}], 'baska-oda': [{}]}
            return 404, {}
        serve.daily_istek = sahte_daily
        serve._presence_onbellek.update(zaman=0.0, veri=None)
        serve._istek_kaydi.clear()          # istek siniri testler arasinda tasinmasin

    def tearDown(self):
        for k, v in self._yedek.items():
            setattr(serve, k, v)
        os.environ.clear()
        os.environ.update(self._env)

    def post(self, govde):
        istek = urllib.request.Request(self.taban + '/api/rooms/token', data=json.dumps(govde).encode(),
                                       headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(istek) as y:
                return y.status, json.loads(y.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def get(self, token=None, yol='/api/rooms/presence'):
        h = {'Authorization': 'Bearer ' + token} if token else {}
        try:
            with urllib.request.urlopen(urllib.request.Request(self.taban + yol, headers=h)) as y:
                return y.status, json.loads(y.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    # ── token ──
    def test_kimliksiz_401(self):
        self.assertEqual(self.post({'room': 'canli-gece'})[0], 401)
        self.assertEqual(self.post({'supabaseToken': 'kotu', 'room': 'canli-gece'})[0], 401)
        self.assertEqual(self.daily_cagrilari, [])

    def test_bilinmeyen_oda_400(self):
        self.assertEqual(self.post({'supabaseToken': 'iyi', 'room': '../rooms'})[0], 400)
        self.assertEqual(self.daily_cagrilari, [])

    def test_anahtarsiz_503(self):
        os.environ.pop('DAILY_API_KEY')
        self.assertEqual(self.post({'supabaseToken': 'iyi', 'room': 'canli-gece'}), (503, {'error': 'not_configured'}))

    def test_gunluk_sinir_429(self):
        serve.bugunku_oda_saniyesi = lambda t: 240 * 60 - 30
        durum, govde = self.post({'supabaseToken': 'iyi', 'room': 'canli-gece'})
        self.assertEqual((durum, govde['error']), (429, 'daily_limit'))
        self.assertEqual(self.daily_cagrilari, [])

    def test_basari_token_ve_kalan(self):
        serve.bugunku_oda_saniyesi = lambda t: 40 * 60
        durum, govde = self.post({'supabaseToken': 'iyi', 'room': 'canli-gece'})
        self.assertEqual(durum, 200)
        self.assertEqual(govde, {'url': 'https://focusaid.daily.co/canli-gece', 'token': 'daily-token', 'kalanDk': 200})
        props = self.daily_cagrilari[0][2]['properties']
        self.assertEqual(props['room_name'], 'canli-gece')
        self.assertEqual(props['user_id'], KULLANICI['id'])
        self.assertEqual(props['user_name'], 'Ayşe')          # yalniz ilk ad
        self.assertNotIn('gizli@ornek.com', json.dumps(props))  # e-posta Daily'ye gitmez
        self.assertEqual(props['eject_after_elapsed'], 200 * 60)
        self.assertNotIn('eject_at_token_exp', props)        # odadaki kisi atilmaz

    def test_kullanim_okunamazsa_tam_sinirla_acik(self):
        serve.bugunku_oda_saniyesi = lambda t: None
        os.environ['GUNLUK_LIMIT_DK'] = '120'
        durum, govde = self.post({'supabaseToken': 'iyi', 'room': 'canli-sabah'})
        self.assertEqual((durum, govde['kalanDk']), (200, 120))

    def test_daily_hata_502(self):
        serve.daily_istek = lambda *a, **k: (500, {'error': 'daily_error'})
        self.assertEqual(self.post({'supabaseToken': 'iyi', 'room': 'canli-gece'})[0], 502)

    # ── presence ──
    def test_presence_kimliksiz_401(self):
        self.assertEqual(self.get()[0], 401)
        self.assertEqual(self.get('kotu')[0], 401)

    def test_presence_sayilar_ve_onbellek(self):
        durum, govde = self.get('iyi')
        self.assertEqual(durum, 200)
        self.assertEqual(govde['rooms'], {'canli-kutuphane': 0, 'canli-sabah': 1, 'canli-gece': 6})
        self.get('iyi')
        self.assertEqual(len(self.daily_cagrilari), 1)   # ikinci istek onbellekten

    # ── jitsi oda adlari ──
    def test_jitsi_kimliksiz_401(self):
        self.assertEqual(self.get(yol='/api/rooms/jitsi'), (401, {'error': 'unauthorized'}))
        self.assertEqual(self.get('kotu', '/api/rooms/jitsi')[0], 401)

    def test_jitsi_sirli_adlar(self):
        os.environ['JITSI_ODA_SIRRI'] = 'test-sirri'
        durum, govde = self.get('iyi', '/api/rooms/jitsi')
        self.assertEqual(durum, 200)
        adlar = govde['rooms']
        self.assertEqual(set(adlar), set(serve.CANLI_ODALAR))
        self.assertEqual(len(set(adlar.values())), 3)
        for oda, ad in adlar.items():
            self.assertRegex(ad, r'^FocusAid-[A-Za-z]+-[0-9a-f]{16}$')
            self.assertNotEqual(ad, serve.JITSI_SABIT_ADLAR[oda], 'sir varken eski ad kullanilmamali')
        os.environ['JITSI_ODA_SIRRI'] = 'baska-sir'
        self.assertNotEqual(self.get('iyi', '/api/rooms/jitsi')[1]['rooms'], adlar, 'ad sirdan turemeli')

    def test_jitsi_sirsiz_sabit_adlar(self):
        os.environ.pop('JITSI_ODA_SIRRI', None)
        self.assertEqual(self.get('iyi', '/api/rooms/jitsi'), (200, {'rooms': serve.JITSI_SABIT_ADLAR}))

    def test_jitsi_istek_siniri_429(self):
        for _ in range(10):
            self.assertEqual(self.get('iyi', '/api/rooms/jitsi')[0], 200)
        self.assertEqual(self.get('iyi', '/api/rooms/jitsi')[0], 429)

    def test_jitsi_haftalik_degisim(self):
        os.environ['JITSI_ODA_SIRRI'] = 'test-sirri'
        ist = serve._ISTANBUL
        pzt_03 = datetime.datetime(2026, 11, 2, 3, 59, tzinfo=ist)    # Pazartesi 03:59: hala onceki hafta
        pzt_04 = datetime.datetime(2026, 11, 2, 4, 0, tzinfo=ist)
        cuma = datetime.datetime(2026, 10, 30, 15, 0, tzinfo=ist)
        self.assertEqual(serve.jitsi_hafta(pzt_03), serve.jitsi_hafta(cuma))
        self.assertNotEqual(serve.jitsi_hafta(pzt_04), serve.jitsi_hafta(cuma))
        self.assertEqual(serve.jitsi_oda_adlari(pzt_03), serve.jitsi_oda_adlari(cuma))
        self.assertNotEqual(serve.jitsi_oda_adlari(pzt_04), serve.jitsi_oda_adlari(cuma))
        utc = datetime.datetime(2026, 11, 2, 0, 30, tzinfo=datetime.timezone.utc)   # Istanbul 03:30
        self.assertEqual(serve.jitsi_hafta(utc), serve.jitsi_hafta(cuma))

    # ── yardimcilar ──
    def test_daily_oda_url(self):
        for alan in ('focusaid', 'focusaid.daily.co', 'HTTPS://focusaid.daily.co/'):
            os.environ['DAILY_DOMAIN'] = alan
            self.assertEqual(serve.daily_oda_url('canli-gece'), 'https://focusaid.daily.co/canli-gece')
        os.environ['DAILY_DOMAIN'] = 'kotu.example.com/x'
        self.assertIsNone(serve.daily_oda_url('canli-gece'))
        os.environ['DAILY_DOMAIN'] = 'focusaid'
        self.assertIsNone(serve.daily_oda_url('baska'))

    def test_bugun_baslangici_istanbul(self):
        utc_gece = datetime.datetime(2026, 10, 13, 22, 30, tzinfo=datetime.timezone.utc)  # Istanbul 14 Ekim 01:30
        self.assertEqual(serve.bugun_baslangici_iso(utc_gece), '2026-10-14T00:00:00+03:00')

    def test_gorunen_ad(self):
        self.assertEqual(serve.gorunen_ad({'user_metadata': {}}), 'FocusAid')
        self.assertEqual(serve.gorunen_ad({'user_metadata': {'full_name': 'A\x00li Veli'}}), 'Ali')


if __name__ == '__main__':
    unittest.main()
