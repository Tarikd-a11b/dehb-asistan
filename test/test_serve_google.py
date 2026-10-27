"""serve.py — Google refresh token uclari (/api/google/store, /api/google/refresh)
ve guvenlik basliklari.

    python -m unittest discover -s test -p "test_*.py"

Supabase profil satiri ve Google token ucu sahteyle degistirilir (ag yok).
Dogrulanan: kimliksiz 401, token istemciden ALINMIYOR, saklanan deger sifreli
ve kullaniciya bagli, duz metin eski token kendiliginden sifreleniyor,
invalid_grant'te satir temizleniyor, anahtar yoksa 503.
"""
import base64
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import serve  # noqa: E402

A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
ANAHTAR = base64.b64encode(bytes(range(32))).decode()


class GoogleUclari(unittest.TestCase):
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
                       ('dogrula_supabase_kullanicisi', '_profil_istegi', 'refresh_google_access_token')}
        self._env = dict(os.environ)
        os.environ['GOOGLE_TOKEN_KEY'] = ANAHTAR
        serve._istek_kaydi.clear()
        # token 'A' -> kullanici A, 'B' -> B; RLS gibi: her token yalniz kendi satiri
        serve.dogrula_supabase_kullanicisi = lambda t: {'A': A, 'B': B}.get(t)
        self.satirlar = {A: None, B: None}
        self.google_gelen = []
        self.google_cevap = (200, {'access_token': 'kisa-omurlu', 'expires_in': 3600})

        def sahte_profil(token, kid, yontem='GET', govde=None):
            self.assertEqual({'A': A, 'B': B}[token], kid)   # sunucu baskasinin satirini istemiyor
            if yontem == 'PATCH':
                self.satirlar[kid] = govde['google_refresh_token']
                return True, []
            return True, [{'google_refresh_token': self.satirlar[kid]}]
        serve._profil_istegi = sahte_profil

        def sahte_google(rt):
            self.google_gelen.append(rt)
            return self.google_cevap
        serve.refresh_google_access_token = sahte_google

    def tearDown(self):
        for k, v in self._yedek.items():
            setattr(serve, k, v)
        os.environ.clear()
        os.environ.update(self._env)

    def post(self, yol, govde):
        istek = urllib.request.Request(self.taban + yol, data=json.dumps(govde).encode(),
                                       headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(istek) as y:
                return y.status, json.loads(y.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_kimliksiz_401(self):
        for yol in ('/api/google/store', '/api/google/refresh'):
            self.assertEqual(self.post(yol, {'refresh_token': 'x'})[0], 401)
            self.assertEqual(self.post(yol, {'refresh_token': 'x', 'supabaseToken': 'sahte'})[0], 401)
        self.assertEqual(self.google_gelen, [])

    def test_store_sifreli_yaziyor(self):
        self.assertEqual(self.post('/api/google/store', {'supabaseToken': 'A', 'refresh_token': '1//gizli'}),
                         (200, {'ok': True}))
        saklanan = self.satirlar[A]
        self.assertTrue(saklanan.startswith('v1:'))
        self.assertNotIn('gizli', saklanan)
        self.assertEqual(serve.token_coz(saklanan, A), ('1//gizli', False))
        self.assertEqual(serve.token_coz(saklanan, B), (None, False))   # baska satira kopyalanirsa cozulmez

    def test_refresh_tokeni_istemciden_almiyor(self):
        self.post('/api/google/store', {'supabaseToken': 'A', 'refresh_token': '1//gercek'})
        durum, govde = self.post('/api/google/refresh', {'supabaseToken': 'A', 'refresh_token': '1//saldirgan'})
        self.assertEqual((durum, govde['access_token']), (200, 'kisa-omurlu'))
        self.assertEqual(self.google_gelen, ['1//gercek'])
        self.assertNotIn('refresh_token', govde)

    def test_a_b_nin_tokenini_kullanamaz(self):
        self.post('/api/google/store', {'supabaseToken': 'B', 'refresh_token': '1//b-nin'})
        self.assertEqual(self.post('/api/google/refresh', {'supabaseToken': 'A'}), (404, {'error': 'no_token'}))
        self.assertEqual(self.google_gelen, [])

    def test_eski_duz_metin_kendiliginden_sifreleniyor(self):
        self.satirlar[A] = '1//eski-duz'
        self.assertEqual(self.post('/api/google/refresh', {'supabaseToken': 'A'})[0], 200)
        self.assertEqual(self.google_gelen, ['1//eski-duz'])
        self.assertTrue(self.satirlar[A].startswith('v1:'))
        self.assertEqual(serve.token_coz(self.satirlar[A], A)[0], '1//eski-duz')

    def test_invalid_grant_satiri_temizliyor(self):
        self.post('/api/google/store', {'supabaseToken': 'A', 'refresh_token': '1//olu'})
        self.google_cevap = (400, {'error': 'invalid_grant'})
        self.assertEqual(self.post('/api/google/refresh', {'supabaseToken': 'A'}), (400, {'error': 'invalid_grant'}))
        self.assertIsNone(self.satirlar[A])

    def test_anahtarsiz_503(self):
        os.environ.pop('GOOGLE_TOKEN_KEY')
        self.assertEqual(self.post('/api/google/store', {'supabaseToken': 'A', 'refresh_token': 'x'}),
                         (503, {'error': 'not_configured'}))
        self.assertIsNone(self.satirlar[A])                           # duz metin YAZILMADI
        os.environ['GOOGLE_TOKEN_KEY'] = 'kisa'
        self.assertIsNone(serve.token_sifrele('x', A))                # 32 bayt olmayan anahtar

    def test_google_istek_siniri_429(self):
        self.post('/api/google/store', {'supabaseToken': 'A', 'refresh_token': '1//x'})
        for _ in range(9):
            self.assertEqual(self.post('/api/google/refresh', {'supabaseToken': 'A'})[0], 200)
        durum, govde = self.post('/api/google/refresh', {'supabaseToken': 'A'})
        self.assertEqual((durum, govde['error']), (429, 'rate_limited'))
        self.assertEqual(len(self.google_gelen), 9)                  # 11. istek Google'a gitmedi
        self.assertEqual(self.post('/api/google/refresh', {'supabaseToken': 'B'})[0], 404)  # B etkilenmez

    def test_guvenlik_basliklari(self):
        with urllib.request.urlopen(self.taban + '/manifest.json') as y:
            csp = y.headers['Content-Security-Policy']
            self.assertIn("object-src 'none'", csp)
            self.assertIn("frame-ancestors 'self'", csp)
            self.assertIn('max-age=', y.headers['Strict-Transport-Security'])
            self.assertIn('geolocation=()', y.headers['Permissions-Policy'])


if __name__ == '__main__':
    unittest.main()
