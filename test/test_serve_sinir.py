"""serve.py — kullanici basina istek siniri (n8n vekili, OWASP LLM10).

    python -m unittest discover -s test -p "test_*.py"

Dogrulanan: dakikada 5 / gunde 50, 429 + Retry-After, reddedilen istek
sayilmiyor, kullanicilar birbirini etkilemiyor, kimliksiz istek sayaci
doldurmuyor (sinir kimlikten SONRA), n8n'e sinir asiminda hic gidilmiyor.
"""
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import serve  # noqa: E402


class SinirMantigi(unittest.TestCase):
    def setUp(self):
        serve._istek_kaydi.clear()

    def test_dakikada_bes(self):
        for i in range(5):
            self.assertIsNone(serve.sinir_asildi('n8n', 'u', simdi=1000 + i))
        self.assertEqual(serve.sinir_asildi('n8n', 'u', simdi=1010), 51)   # ilk istek 1000'de, 1060'ta acilir
        self.assertIsNone(serve.sinir_asildi('n8n', 'u', simdi=1061))
        self.assertIsNone(serve.sinir_asildi('n8n', 'baska', simdi=1010))

    def test_reddedilen_sayilmiyor(self):
        for i in range(5):
            serve.sinir_asildi('n8n', 'u', simdi=1000)
        for _ in range(20):
            serve.sinir_asildi('n8n', 'u', simdi=1030)
        self.assertIsNone(serve.sinir_asildi('n8n', 'u', simdi=1061))

    def test_gunde_elli(self):
        t = 0
        for _ in range(50):
            self.assertIsNone(serve.sinir_asildi('n8n', 'u', simdi=t))
            t += 61                                     # dakika sinirina hic takilmadan
        bekle = serve.sinir_asildi('n8n', 'u', simdi=t)
        self.assertIsNotNone(bekle)
        self.assertGreater(bekle, 3600)                 # gunluk pencere: saatlerce bekle
        self.assertIsNone(serve.sinir_asildi('n8n', 'u', simdi=86400 + 1))


class VekilSiniri(unittest.TestCase):
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
        serve._istek_kaydi.clear()
        self._yedek = (serve.dogrula_supabase_kullanicisi, serve.n8n_ilet)
        serve.dogrula_supabase_kullanicisi = lambda t: {'A': 'kullanici-a', 'B': 'kullanici-b'}.get(t)
        self.n8n_gelen = []

        def sahte_n8n(hedef, govde):
            self.n8n_gelen.append(govde['userId'])
            return 200, 'application/json', b'{"ok":true}'
        serve.n8n_ilet = sahte_n8n

    def tearDown(self):
        serve.dogrula_supabase_kullanicisi, serve.n8n_ilet = self._yedek

    def post(self, yol, govde):
        istek = urllib.request.Request(self.taban + yol, data=json.dumps(govde).encode(),
                                       headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(istek) as y:
                return y.status, dict(y.headers), json.loads(y.read())
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), json.loads(e.read())

    def test_altinci_istek_429_ve_n8ne_gitmiyor(self):
        # split + analyze ortak kova
        for yol in ['/api/n8n/split', '/api/n8n/analyze'] * 2 + ['/api/n8n/split']:
            self.assertEqual(self.post(yol, {'supabaseToken': 'A'})[0], 200)
        durum, basliklar, govde = self.post('/api/n8n/analyze', {'supabaseToken': 'A'})
        self.assertEqual((durum, govde['error']), (429, 'rate_limited'))
        self.assertGreaterEqual(int(basliklar['Retry-After']), 1)
        self.assertEqual(self.n8n_gelen, ['kullanici-a'] * 5)
        self.assertEqual(self.post('/api/n8n/split', {'supabaseToken': 'B'})[0], 200)

    def test_kimliksiz_istek_sayaci_doldurmuyor(self):
        for _ in range(10):
            self.assertEqual(self.post('/api/n8n/split', {'supabaseToken': 'sahte'})[0], 401)
        self.assertEqual(serve._istek_kaydi, {})


if __name__ == '__main__':
    unittest.main()
