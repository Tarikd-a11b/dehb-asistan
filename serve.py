"""
FocusAid — geliştirme sunucusu (önbelleksiz).

    python serve.py          → http://localhost:3000

Neden gerekli: `python -m http.server` hiçbir önbellek başlığı göndermiyor,
tarayıcı da config.js / *.js dosyalarını saklıyor. Bu yüzden kod değiştiğinde
sayfa eski sürümü çalıştırmaya devam ediyor (Ctrl+Shift+R bile yetmeyebiliyor).
Bu sunucu her yanıta `Cache-Control: no-store` ekleyerek sorunu kökten çözer.

Uygulamayı DAİMA http://localhost:3000/auth.html üzerinden aç — 127.0.0.1 ile
değil. Supabase PKCE akışı, girişin başladığı origin'de bitmesini bekliyor.
"""
import http.server
import socketserver
import os
import json
import urllib.request
import urllib.error
import urllib.parse

PORT = int(os.environ.get('PORT', 3000))


def generate_config_js():
    """Generate config.js from environment variables."""
    config = {
        'SUPABASE_URL': os.environ.get('SUPABASE_URL', 'https://PROJE_ID.supabase.co'),
        'SUPABASE_ANON_KEY': os.environ.get('SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY_BURAYA'),
        'GOOGLE_API_KEY': os.environ.get('GOOGLE_API_KEY', 'GOOGLE_API_KEY_BURAYA'),
        'GOOGLE_CLIENT_ID': os.environ.get('GOOGLE_CLIENT_ID', 'CLIENT_ID.apps.googleusercontent.com'),
        'DISCOVERY_DOC': 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
        'SCOPES': 'https://www.googleapis.com/auth/calendar.events',
        # n8n'in GERCEK adresi tarayiciya verilmiyor. Istek bu sunucudaki vekil
        # uclara gidiyor; gizli anahtar orada, sunucu tarafinda ekleniyor. Boylece
        # webhook internete acik olsa da yalnizca buradan gelen istekler gecerli.
        'N8N_WEBHOOK': N8N_SPLIT_PATH,
        'N8N_ANALYZE_WEBHOOK': N8N_ANALYZE_PATH,
        'TIMEZONE': os.environ.get('TIMEZONE', 'Europe/Istanbul')
    }

    js_content = '// Auto-generated from environment variables\n'
    js_content += 'const FOCUSAID_CONFIG = ' + json.dumps(config, indent=4) + ';\n'
    return js_content.encode('utf-8')


GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

# Tarayicinin gordugu (ve config.js'e yazilan) vekil uclar.
N8N_SPLIT_PATH = '/api/n8n/split'
N8N_ANALYZE_PATH = '/api/n8n/analyze'


def dogrula_supabase_kullanicisi(token):
    """Supabase access token'ini dogrular; gecerliyse kullanici id'sini doner.

    Bu kontrol olmadan uca ulasan herkes payload'a istedigi userId'yi yazip
    BASKA bir kullanicinin takvimine gorev ekletebilirdi. Kimlik burada,
    sunucuda dogrulaniyor ve govdedeki userId bununla EZILIYOR.
    """
    base = os.environ.get('SUPABASE_URL')
    anon = os.environ.get('SUPABASE_ANON_KEY')
    if not base or not anon or not token or not isinstance(token, str):
        return None
    istek = urllib.request.Request(
        base.rstrip('/') + '/auth/v1/user',
        headers={'apikey': anon, 'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(istek, timeout=10) as yanit:
            return (json.loads(yanit.read().decode('utf-8')) or {}).get('id')
    except Exception as e:
        print('[n8n-vekil] token dogrulanamadi:', type(e).__name__)
        return None


def n8n_ilet(hedef, govde):
    """Istegi n8n'e sunucudan iletir, cevabi OLDUGU GIBI geri verir.

    Cevap ayristirilmiyor: analyze ucu markdown citleriyle sarilmis ham metin
    donebiliyor ve onu doc-intake.js kendisi temizliyor. Burada JSON'a
    cevirmeye kalkarsak o akisi bozariz.

    Donus: (http_durumu, content_type, ham_bayt)
    """
    basliklar = {'Content-Type': 'application/json'}
    gizli = os.environ.get('N8N_SECRET')
    if gizli:
        basliklar['X-Focusaid-Secret'] = gizli   # n8n tarafinda Header Auth

    istek = urllib.request.Request(hedef, data=json.dumps(govde).encode('utf-8'),
                                   headers=basliklar)
    try:
        # Gemini'nin parcalamasi uzun surebiliyor; kisa timeout kullaniciya
        # sebepsiz hata olarak yansiyordu.
        with urllib.request.urlopen(istek, timeout=120) as yanit:
            return 200, yanit.headers.get('Content-Type', 'application/json'), yanit.read()
    except urllib.error.HTTPError as e:
        print('[n8n-vekil] n8n reddetti:', e.code)
        return (502 if e.code >= 500 else e.code), 'application/json',                json.dumps({'error': 'n8n_error', 'status': e.code}).encode('utf-8')
    except Exception as e:
        print('[n8n-vekil] ulasilamadi:', type(e).__name__)
        return 502, 'application/json', json.dumps({'error': 'n8n_unreachable'}).encode('utf-8')


def refresh_google_access_token(refresh_token):
    """Refresh token'i yeni bir access token'a cevirir.

    Client secret SUNUCUDA kaliyor -- bu ucun tek varlik sebebi bu. Tarayici
    secret'i tutamayacagi icin yenilemeyi kendi basina yapamaz.

    Donus: (http_durumu, govde_sozlugu). Token'lar LOGLANMAZ.
    """
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    if not client_id or not client_secret:
        # Yapilandirma eksik: uygulama bunu gorup "Takvimi Bagla" butonuna dusuyor.
        return 503, {'error': 'not_configured',
                     'message': 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET tanimli degil'}

    veri = urllib.parse.urlencode({
        'client_id': client_id,
        'client_secret': client_secret,
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token',
    }).encode('utf-8')

    istek = urllib.request.Request(GOOGLE_TOKEN_URL, data=veri,
                                   headers={'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(istek, timeout=10) as yanit:
            sonuc = json.loads(yanit.read().decode('utf-8'))
        return 200, {'access_token': sonuc.get('access_token'),
                     'expires_in': sonuc.get('expires_in', 3600)}
    except urllib.error.HTTPError as e:
        # Google'in gerekcesini gecir (invalid_grant = kullanici izni geri aldi
        # ya da token suresi doldu) ama govdeyi oldugu gibi yansitma.
        try:
            ayrinti = json.loads(e.read().decode('utf-8')).get('error', 'unknown')
        except Exception:
            ayrinti = 'unknown'
        print('[refresh] Google reddetti:', e.code, ayrinti)
        return 400, {'error': ayrinti}
    except Exception as e:
        print('[refresh] istek basarisiz:', type(e).__name__)
        return 502, {'error': 'upstream_failure'}


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def _json_yanit(self, durum, govde):
        cikti = json.dumps(govde).encode('utf-8')
        self.send_response(durum)
        self.send_header('Content-type', 'application/json')
        self.send_header('Content-Length', str(len(cikti)))
        self.end_headers()
        self.wfile.write(cikti)

    def _ham_yanit(self, durum, content_type, govde):
        self.send_response(durum)
        self.send_header('Content-type', content_type)
        self.send_header('Content-Length', str(len(govde)))
        self.end_headers()
        self.wfile.write(govde)

    def do_POST(self):
        if self.path in (N8N_SPLIT_PATH, N8N_ANALYZE_PATH):
            self._n8n_vekil()
            return
        if self.path != '/api/google/refresh':
            self._json_yanit(404, {'error': 'not_found'})
            return
        try:
            uzunluk = int(self.headers.get('Content-Length') or 0)
            if uzunluk <= 0 or uzunluk > 8192:      # refresh token birkac yuz bayt
                self._json_yanit(400, {'error': 'bad_request'})
                return
            govde = json.loads(self.rfile.read(uzunluk).decode('utf-8'))
            refresh_token = (govde or {}).get('refresh_token')
            if not refresh_token or not isinstance(refresh_token, str):
                self._json_yanit(400, {'error': 'refresh_token_required'})
                return
        except Exception:
            self._json_yanit(400, {'error': 'bad_request'})
            return

        durum, yanit = refresh_google_access_token(refresh_token)
        self._json_yanit(durum, yanit)

    def _n8n_vekil(self):
        """Tarayici -> (bu sunucu) -> n8n.

        Iki is yapiyor: (1) kullaniciyi Supabase token'iyla dogrulayip userId'yi
        sunucu tarafinda sabitliyor, (2) n8n'in gizli anahtarini ekliyor. Ikisi de
        tarayiciya guvenmeden yapilmali -- istemciye konan anahtar sir degildir.
        """
        try:
            uzunluk = int(self.headers.get('Content-Length') or 0)
            # 256 KB: yonerge belgesinin metni buyuk olabiliyor.
            if uzunluk <= 0 or uzunluk > 262144:
                self._json_yanit(400, {'error': 'bad_request'})
                return
            govde = json.loads(self.rfile.read(uzunluk).decode('utf-8')) or {}
        except Exception:
            self._json_yanit(400, {'error': 'bad_request'})
            return

        kullanici_id = dogrula_supabase_kullanicisi(govde.get('supabaseToken'))
        if not kullanici_id:
            self._json_yanit(401, {'error': 'unauthorized'})
            return
        govde['userId'] = kullanici_id      # istemcinin yolladigina guvenme

        if self.path == N8N_SPLIT_PATH:
            hedef = os.environ.get('N8N_WEBHOOK',
                                   'http://localhost:5678/webhook/focusaid-processor')
        else:
            hedef = os.environ.get('N8N_ANALYZE_WEBHOOK',
                                   'http://localhost:5678/webhook/focusaid-analyze')

        durum, ctype, ham = n8n_ilet(hedef, govde)
        self._ham_yanit(durum, ctype, ham)

    def do_GET(self):
        # Kök adres tanitim sayfasini acar. Uygulamanin kendisi /index.html'de
        # duruyor; oraya giren oturumsuz kullanici zaten auth.html'e yonlenir,
        # oturumlusu uygulamayi gorur. Tanitim sayfasindaki "Google ile basla"
        # da auth.html'e gider ve auth.html oturum varsa uygulamaya atar --
        # yani bu satir giris akisinin hicbir adimina dokunmuyor.
        if self.path == '/':
            self.path = '/landing.html'

        # Render'da SUPABASE_URL env var'ı tanımlı olduğu için config.js oradan
        # üretilir. Yerelde bu env var yok — o zaman diskteki gerçek config.js
        # (gitignored, kişisel anahtarları içeren) olduğu gibi sunulmalı,
        # yoksa her zaman PROJE_ID placeholder'ı dönüp yerel girişi kırıyordu.
        if self.path == '/config.js' and os.environ.get('SUPABASE_URL'):
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.end_headers()
            self.wfile.write(generate_config_js())
        else:
            super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('', PORT), NoCacheHandler) as httpd:
        httpd.daemon_threads = True
        print(f'FocusAid gelistirme sunucusu (onbelleksiz, cok is parcali): http://localhost:{PORT}/auth.html')
        print('Durdurmak icin Ctrl+C')
        httpd.serve_forever()
