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
import datetime
import re
import threading
import time

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


def supabase_kullanicisi(token):
    """Supabase access token'ini dogrular; gecerliyse kullanici nesnesini doner."""
    base = os.environ.get('SUPABASE_URL')
    anon = os.environ.get('SUPABASE_ANON_KEY')
    if not base or not anon or not token or not isinstance(token, str):
        return None
    istek = urllib.request.Request(
        base.rstrip('/') + '/auth/v1/user',
        headers={'apikey': anon, 'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(istek, timeout=10) as yanit:
            kullanici = json.loads(yanit.read().decode('utf-8')) or {}
            return kullanici if kullanici.get('id') else None
    except Exception as e:
        print('[vekil] token dogrulanamadi:', type(e).__name__)
        return None


def dogrula_supabase_kullanicisi(token):
    """Supabase access token'ini dogrular; gecerliyse kullanici id'sini doner.

    Bu kontrol olmadan uca ulasan herkes payload'a istedigi userId'yi yazip
    BASKA bir kullanicinin takvimine gorev ekletebilirdi. Kimlik burada,
    sunucuda dogrulaniyor ve govdedeki userId bununla EZILIYOR.
    """
    kullanici = supabase_kullanicisi(token)
    return kullanici.get('id') if kullanici else None


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


# ── Google refresh token: sifreli saklama ────────────────────────
# Token profiles.google_refresh_token'da SIFRELI duruyor ve tarayiciya hic
# geri inmiyor: tarayici yalniz giris aninda /api/google/store'a yollar, yenilemeyi
# /api/google/refresh sunucuda yapar. Tek bir XSS ya da veritabani dokumu artik
# kullanicinin takvimine kalici erisim vermez; anahtar (GOOGLE_TOKEN_KEY) yalniz
# Render ortaminda, veriden ayri (KVKK 2018/10).
# Bicim: 'v1:' + base64url(12 bayt nonce + AES-256-GCM sifreli metin). AAD =
# kullanici id'si: baska bir satira kopyalanan sifreli metin cozulmez.
TOKEN_ONEK = 'v1:'


def _token_anahtari():
    """GOOGLE_TOKEN_KEY (base64, 32 bayt) -> bayt; tanimsiz/bozuksa None."""
    import base64
    ham = (os.environ.get('GOOGLE_TOKEN_KEY') or '').strip().replace('-', '+').replace('_', '/')
    try:
        anahtar = base64.b64decode(ham + '=' * (-len(ham) % 4), validate=True)
    except Exception:
        return None
    return anahtar if len(anahtar) == 32 else None


def token_sifrele(duz, kullanici_id):
    """Sifreli metin; anahtar ya da kutuphane yoksa None (cagiran 503 doner)."""
    anahtar = _token_anahtari()
    if not anahtar:
        return None
    try:
        import base64
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        return None
    nonce = os.urandom(12)
    sifreli = AESGCM(anahtar).encrypt(nonce, duz.encode('utf-8'), kullanici_id.encode('utf-8'))
    return TOKEN_ONEK + base64.urlsafe_b64encode(nonce + sifreli).decode('ascii')


def token_coz(saklanan, kullanici_id):
    """Saklanan degeri duz token'a cevirir. Doner: (duz, eski_bicim_mi).

    Onek yoksa bu, sifreleme oncesinden kalma DUZ METIN bir token'dir: oldugu
    gibi kullanilir ve cagiran onu sifreleyip geri yazar (kendiliginden tasima).
    Cozulemezse (anahtar degisti / satir kopyalandi) (None, False).
    """
    if not saklanan.startswith(TOKEN_ONEK):
        return saklanan, True
    anahtar = _token_anahtari()
    if not anahtar:
        return None, False
    try:
        import base64
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        ham = base64.urlsafe_b64decode(saklanan[len(TOKEN_ONEK):])
        duz = AESGCM(anahtar).decrypt(ham[:12], ham[12:], kullanici_id.encode('utf-8'))
        return duz.decode('utf-8'), False
    except Exception as e:
        print('[refresh] token cozulemedi:', type(e).__name__)
        return None, False


def _profil_istegi(token, kullanici_id, yontem='GET', govde=None):
    """profiles satirina KULLANICININ KENDI token'iyla erisim (RLS: yalniz kendi
    satiri) -- service_role gerekmiyor. Doner: (ok, satir_listesi)."""
    base = os.environ.get('SUPABASE_URL')
    anon = os.environ.get('SUPABASE_ANON_KEY')
    if not base or not anon:
        return False, None
    sorgu = urllib.parse.urlencode({'id': 'eq.' + kullanici_id, 'select': 'google_refresh_token'})
    basliklar = {'apikey': anon, 'Authorization': 'Bearer ' + token,
                 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}
    veri = json.dumps(govde).encode('utf-8') if govde is not None else None
    istek = urllib.request.Request(base.rstrip('/') + '/rest/v1/profiles?' + sorgu,
                                   data=veri, method=yontem, headers=basliklar)
    try:
        with urllib.request.urlopen(istek, timeout=10) as yanit:
            ham = yanit.read().decode('utf-8')
            return True, (json.loads(ham) if ham else [])
    except Exception as e:
        print('[refresh] profil erisimi basarisiz:', yontem, type(e).__name__)
        return False, None


def saklanan_tokeni_oku(token, kullanici_id):
    ok, satirlar = _profil_istegi(token, kullanici_id)
    if not ok:
        return False, None
    return True, ((satirlar or [{}])[0] or {}).get('google_refresh_token')


def saklanan_tokeni_yaz(token, kullanici_id, deger):
    return _profil_istegi(token, kullanici_id, 'PATCH', {'google_refresh_token': deger})[0]


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

# ── Canli calisma odalari (Daily.co) ─────────────────────────────
# Spec: docs/superpowers/specs/2026-10-13-canli-calisma-odalari-design.md
# DAILY_API_KEY tarayiciya HIC inmez; oda girisi icin kisa omurlu bir
# meeting token'i burada uretilir. Kotayi (ucretsiz dakika) SUNUCU korur:
# kisi basi gunluk ust sinir + token'daki eject_after_elapsed.

DAILY_API = 'https://api.daily.co/v1'
CANLI_ODALAR = ('canli-kutuphane', 'canli-sabah', 'canli-gece')
ODA_TOKEN_PATH = '/api/rooms/token'
ODA_PRESENCE_PATH = '/api/rooms/presence'
CANLI_MAKS_KISI = 6
PRESENCE_ONBELLEK_SN = 15
# Turkiye 2016'dan beri yaz saati uygulamiyor: sabit +03. zoneinfo Windows'ta
# tzdata paketi istiyor; bagimliliksiz kalmak icin sabit ofset.
_ISTANBUL = datetime.timezone(datetime.timedelta(hours=3))
_presence_onbellek = {'zaman': 0.0, 'veri': None}
_presence_kilit = threading.Lock()


def daily_istek(yontem, yol, govde=None):
    """Daily REST cagrisi. Donus: (http_durumu, sozluk). Anahtar loglanmaz."""
    anahtar = os.environ.get('DAILY_API_KEY')
    if not anahtar:
        return 503, {'error': 'not_configured'}
    veri = json.dumps(govde).encode('utf-8') if govde is not None else None
    istek = urllib.request.Request(DAILY_API + yol, data=veri, method=yontem, headers={
        'Authorization': 'Bearer ' + anahtar, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(istek, timeout=10) as yanit:
            return yanit.status, json.loads(yanit.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as e:
        print('[daily] reddetti:', e.code, yol.split('?')[0])
        return e.code, {'error': 'daily_error'}
    except Exception as e:
        print('[daily] ulasilamadi:', type(e).__name__)
        return 502, {'error': 'daily_unreachable'}


def daily_oda_url(oda):
    """DAILY_DOMAIN 'ornek', 'ornek.daily.co' ya da 'https://ornek.daily.co' olabilir."""
    alan = (os.environ.get('DAILY_DOMAIN') or '').strip().lower()
    alan = re.sub(r'^https?://', '', alan).strip('/')
    if alan.endswith('.daily.co'):
        alan = alan[:-len('.daily.co')]
    if not re.fullmatch(r'[a-z0-9-]+', alan) or oda not in CANLI_ODALAR:
        return None
    return 'https://%s.daily.co/%s' % (alan, oda)


def gunluk_limit_sn():
    try:
        dk = int(os.environ.get('GUNLUK_LIMIT_DK', '240'))
    except ValueError:
        dk = 240
    return max(1, min(1440, dk)) * 60


def bugun_baslangici_iso(simdi=None):
    simdi = simdi or datetime.datetime.now(_ISTANBUL)
    return simdi.astimezone(_ISTANBUL).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def bugunku_oda_saniyesi(token):
    """Bugun (Istanbul) odada gecen saniye — kullanicinin KENDI token'iyla; RLS
    yalniz kendi satirlarini verir. Okunamazsa None (cagiran karar verir)."""
    base = os.environ.get('SUPABASE_URL')
    anon = os.environ.get('SUPABASE_ANON_KEY')
    if not base or not anon:
        return None
    sorgu = urllib.parse.urlencode({'select': 'active_seconds,break_seconds',
                                    'joined_at': 'gte.' + bugun_baslangici_iso()})
    istek = urllib.request.Request(base.rstrip('/') + '/rest/v1/room_sessions?' + sorgu,
                                   headers={'apikey': anon, 'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(istek, timeout=10) as yanit:
            satirlar = json.loads(yanit.read().decode('utf-8')) or []
        return sum(int(r.get('active_seconds') or 0) + int(r.get('break_seconds') or 0) for r in satirlar)
    except Exception as e:
        print('[odalar] gunluk kullanim okunamadi:', type(e).__name__)
        return None


def gorunen_ad(kullanici):
    """Odadakilere gorunen ad: yalniz ilk ad. E-posta Daily'ye GITMEZ."""
    meta = (kullanici or {}).get('user_metadata') or {}
    ad = str(meta.get('full_name') or meta.get('name') or '').strip().split(' ')[0]
    ad = re.sub(r'[\x00-\x1f\x7f]', '', ad)[:40]
    return ad or 'FocusAid'


def oda_token_uret(kullanici, oda, kalan_sn):
    durum, yanit = daily_istek('POST', '/meeting-tokens', {'properties': {
        'room_name': oda,
        'user_name': gorunen_ad(kullanici),
        'user_id': kullanici['id'],
        # exp yalniz KATILMA suresi: eject_at_token_exp verilmedigi icin
        # odadaki kisi bu sure dolunca atilmaz.
        'exp': int(time.time()) + 600,
        'eject_after_elapsed': int(kalan_sn),
        'start_audio_off': True,
    }})
    if durum != 200 or not isinstance(yanit, dict) or not yanit.get('token'):
        return None
    return yanit['token']


def oda_doluluklari():
    """{oda: kisi_sayisi}; Daily /presence 15 sn onbellekli. Okunamazsa None."""
    with _presence_kilit:
        if _presence_onbellek['veri'] is not None and time.time() - _presence_onbellek['zaman'] < PRESENCE_ONBELLEK_SN:
            return _presence_onbellek['veri']
    durum, yanit = daily_istek('GET', '/presence')
    if durum != 200 or not isinstance(yanit, dict):
        return None
    veri = {}
    for oda in CANLI_ODALAR:
        kisiler = yanit.get(oda)
        veri[oda] = min(CANLI_MAKS_KISI, len(kisiler)) if isinstance(kisiler, list) else 0
    with _presence_kilit:
        _presence_onbellek.update(zaman=time.time(), veri=veri)
    return veri


# ── Istek siniri (kullanici basina) ──────────────────────────────
# Vekil uclar kimlik istiyor ama giris yapmis TEK bir kullanici dongu ile istek
# atip Gemini kotasini/faturasini tuketebilirdi (OWASP LLM10). Sinir kimlik
# dogrulandiktan SONRA, dogrulanan kullanici id'sine gore sayiliyor.
# Bellekte tutuluyor: Render tek ornek calisiyor; uyuyup uyaninca sayac sifirlanir
# (kabul edilen takas — amac kotu niyetli donguyu kesmek, muhasebe degil).
# n8n kovasi split + analyze ORTAK: bir yonerge = 1 analyze + 1 split.
ISTEK_SINIRLARI = {
    'n8n': ((60, 5), (86400, 50)),        # dakikada 5, gunde 50
    'google': ((60, 10),),
    'oda': ((60, 10),),
}
_istek_kaydi = {}
_istek_kilit = threading.Lock()


def sinir_asildi(kova, kullanici_id, simdi=None):
    """Sinir asildiysa beklenecek saniyeyi (>=1) doner; asilmadiysa istegi
    sayar ve None doner. Reddedilen istek SAYILMAZ (bekleyen tekrar deneyebilsin)."""
    simdi = time.time() if simdi is None else simdi
    kurallar = ISTEK_SINIRLARI[kova]
    en_uzun = max(p for p, _ in kurallar)
    with _istek_kilit:
        kayit = [t for t in _istek_kaydi.get((kova, kullanici_id), []) if simdi - t < en_uzun]
        for pencere, limit in kurallar:
            icindekiler = [t for t in kayit if simdi - t < pencere]
            if len(icindekiler) >= limit:
                _istek_kaydi[(kova, kullanici_id)] = kayit
                return max(1, int(icindekiler[0] + pencere - simdi) + 1)
        kayit.append(simdi)
        _istek_kaydi[(kova, kullanici_id)] = kayit
    return None


# ── Guvenlik basliklari ──────────────────────────────────────────
# CSP bir beyaz liste: sayfalarin gercekten yukledigi dis kaynaklar disinda hicbir
# yere script yuklenemez, istek atilamaz, resim cekilemez. Bir XSS olsa bile veriyi
# fetch/img ile disari tasimak boylece kapanir. Yeni bir CDN/servis eklersen buraya
# da ekle — yoksa o kaynak sessizce engellenir (konsolda "Refused to load ...").
#
# script-src'te 'unsafe-inline' YOK (2026-10-27): enjekte edilmis <img onerror> /
# <script> calismaz. Bunun iki sarti var:
#   - inline on*="..." handler yok; handler'lar olay.js ile data-* uzerinden
#     (bekcisi test/olay-baglama.test.js),
#   - sayfanin KENDI inline <script> bloklari {inline} yerine, servis edilen
#     dosyadan o an hesaplanan sha256 ozetleriyle izinli (inline_script_ozetleri).
#     Blogu degistirince ozet kendiliginden degisir; elle bir sey yapma.
# style-src 'unsafe-inline' kaliyor: style="" oznitelikleri her yerde ve CSS
# enjeksiyonu kod calistirmaz.
CSP_SABLON = '; '.join((
    "default-src 'self'",
    "script-src 'self' {inline} https://cdn.jsdelivr.net https://apis.google.com"
    " https://accounts.google.com https://unpkg.com https://*.daily.co",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://i.ytimg.com https://cdn.jsdelivr.net",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.googleapis.com"
    " https://content.googleapis.com https://accounts.google.com https://cdn.jsdelivr.net"
    " https://*.daily.co wss://*.daily.co",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://accounts.google.com"
    " https://content.googleapis.com https://*.daily.co",
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
))
# HTML olmayan yanitlar (JS, JSON, resim) inline script tasimaz.
CSP = CSP_SABLON.replace(' {inline}', '')

_INLINE_SCRIPT = re.compile(rb'<script(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script\s*>', re.S | re.I)
_ozet_onbellek = {}


def inline_script_ozetleri(dosya):
    """HTML dosyasindaki inline <script> bloklarinin CSP ozetleri ('sha256-...').

    Tarayici ozeti blogun METNI uzerinden hesaplar ve HTML ayristirici satir
    sonlarini once LF'ye cevirir; Windows'ta CRLF ile kaydedilmis dosyada da ayni
    ozet ciksin diye burada da cevriliyor. (yol, mtime) ile onbellekli."""
    import base64
    import hashlib
    try:
        damga = os.path.getmtime(dosya)
    except OSError:
        return []
    kayit = _ozet_onbellek.get(dosya)
    if kayit and kayit[0] == damga:
        return kayit[1]
    with open(dosya, 'rb') as f:
        ham = f.read()
    ozetler = []
    for m in _INLINE_SCRIPT.finditer(ham):
        metin = m.group(1).replace(b'\r\n', b'\n').replace(b'\r', b'\n')
        ozet = "'sha256-" + base64.b64encode(hashlib.sha256(metin).digest()).decode() + "'"
        if ozet not in ozetler:
            ozetler.append(ozet)
    _ozet_onbellek[dosya] = (damga, ozetler)
    return ozetler
# Kamera/mikrofon yalniz kendi sayfamiza (Jitsi yeni sekmede aciliyor, ihtiyaci yok).
# ⚠️ Daily yolu (iframe) yeniden acilirsa Daily alan adini buraya eklemek gerekir.
PERMISSIONS_POLICY = 'camera=(self), microphone=(self), display-capture=(), geolocation=(), payment=(), usb=()'


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def _sinirla(self, kova, kullanici_id):
        """Sinir asildiysa 429 yazar ve True doner (cagiran hemen cikmali)."""
        self._kullanici = kullanici_id        # erisim loguna (log_request)
        bekle = sinir_asildi(kova, kullanici_id)
        if bekle is None:
            return False
        self._json_yanit(429, {'error': 'rate_limited', 'retryAfter': bekle},
                         {'Retry-After': str(bekle)})
        return True

    def log_request(self, code='-', size='-'):
        """Erisim logu + kimligi dogrulanmis isteklerde kullanici id'si (KVKK 2018/10:
        kisisel veri uzerindeki islemler kayit altinda). Yalniz UUID; e-posta, token,
        govde ASLA loglanmaz. Render loglari kisa omurlu — kalici denetim izi degil."""
        kim = getattr(self, '_kullanici', None)
        self.log_message('"%s" %s %s%s', self.requestline, str(getattr(code, 'value', code)), str(size),
                         (' kullanici=' + kim) if kim else '')

    def _json_yanit(self, durum, govde, ek_basliklar=None):
        cikti = json.dumps(govde).encode('utf-8')
        self.send_response(durum)
        for ad, deger in (ek_basliklar or {}).items():
            self.send_header(ad, deger)
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
        if self.path == ODA_TOKEN_PATH:
            self._oda_token()
            return
        if self.path in (N8N_SPLIT_PATH, N8N_ANALYZE_PATH):
            self._n8n_vekil()
            return
        if self.path not in ('/api/google/refresh', '/api/google/store'):
            self._json_yanit(404, {'error': 'not_found'})
            return
        try:
            uzunluk = int(self.headers.get('Content-Length') or 0)
            if uzunluk <= 0 or uzunluk > 8192:      # refresh token birkac yuz bayt
                self._json_yanit(400, {'error': 'bad_request'})
                return
            govde = json.loads(self.rfile.read(uzunluk).decode('utf-8')) or {}
        except Exception:
            self._json_yanit(400, {'error': 'bad_request'})
            return

        # Bu uclar GOOGLE_CLIENT_SECRET ile token uretiyor; kimliksiz birakilirsa
        # herkese acik bir "token yenileme servisi" olur ve Google kotasi/Render
        # kaynagi somurulebilir. n8n vekilindeki ayni kontrol burada da olmali.
        sb_token = govde.get('supabaseToken')
        kullanici_id = dogrula_supabase_kullanicisi(sb_token)
        if not kullanici_id:
            self._json_yanit(401, {'error': 'unauthorized'})
            return
        if self._sinirla('google', kullanici_id):
            return

        if self.path == '/api/google/store':
            self._google_store(sb_token, kullanici_id, govde.get('refresh_token'))
        else:
            self._google_refresh(sb_token, kullanici_id)

    def _google_store(self, sb_token, kullanici_id, refresh_token):
        """Giris aninda gelen refresh token'i sifreleyip kullanicinin satirina yazar."""
        if not refresh_token or not isinstance(refresh_token, str):
            self._json_yanit(400, {'error': 'refresh_token_required'})
            return
        sifreli = token_sifrele(refresh_token, kullanici_id)
        if not sifreli:
            self._json_yanit(503, {'error': 'not_configured'})
            return
        if not saklanan_tokeni_yaz(sb_token, kullanici_id, sifreli):
            self._json_yanit(502, {'error': 'store_failed'})
            return
        self._json_yanit(200, {'ok': True})

    def _google_refresh(self, sb_token, kullanici_id):
        """Token'i istemciden ALMAZ: kullanicinin kendi satirindan okur, cozer,
        Google'a yeniletir. Istemci yalniz kisa omurlu access token'i gorur."""
        ok, saklanan = saklanan_tokeni_oku(sb_token, kullanici_id)
        if not ok:
            self._json_yanit(502, {'error': 'upstream_failure'})
            return
        if not saklanan:
            self._json_yanit(404, {'error': 'no_token'})       # hic izin alinmamis
            return
        refresh_token, eski_bicim = token_coz(saklanan, kullanici_id)
        if not refresh_token:
            self._json_yanit(503, {'error': 'not_configured'})
            return

        durum, yanit = refresh_google_access_token(refresh_token)
        if durum == 400 and yanit.get('error') == 'invalid_grant':
            # Kullanici izni geri almis ya da token iptal olmus: olu anahtari
            # temizle ki her acilista bosuna denenmesin.
            saklanan_tokeni_yaz(sb_token, kullanici_id, None)
        elif durum == 200 and eski_bicim:
            # Sifreleme oncesinden kalan duz metin token: simdi sifrele.
            sifreli = token_sifrele(refresh_token, kullanici_id)
            if sifreli:
                saklanan_tokeni_yaz(sb_token, kullanici_id, sifreli)
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
        if self._sinirla('n8n', kullanici_id):
            return

        if self.path == N8N_SPLIT_PATH:
            hedef = os.environ.get('N8N_WEBHOOK',
                                   'http://localhost:5678/webhook/focusaid-processor')
        else:
            hedef = os.environ.get('N8N_ANALYZE_WEBHOOK',
                                   'http://localhost:5678/webhook/focusaid-analyze')

        durum, ctype, ham = n8n_ilet(hedef, govde)
        self._ham_yanit(durum, ctype, ham)

    def _oda_token(self):
        """Canli odaya giris: kimlik -> oda beyaz listesi -> gunluk sinir -> Daily token."""
        try:
            uzunluk = int(self.headers.get('Content-Length') or 0)
            if uzunluk <= 0 or uzunluk > 8192:
                self._json_yanit(400, {'error': 'bad_request'})
                return
            govde = json.loads(self.rfile.read(uzunluk).decode('utf-8')) or {}
        except Exception:
            self._json_yanit(400, {'error': 'bad_request'})
            return

        token = govde.get('supabaseToken')
        kullanici = supabase_kullanicisi(token)
        if not kullanici:
            self._json_yanit(401, {'error': 'unauthorized'})
            return
        if self._sinirla('oda', kullanici['id']):
            return
        oda = govde.get('room')
        if oda not in CANLI_ODALAR:            # serbest metin Daily'ye gitmez
            self._json_yanit(400, {'error': 'unknown_room'})
            return
        url = daily_oda_url(oda)
        if not url or not os.environ.get('DAILY_API_KEY'):
            self._json_yanit(503, {'error': 'not_configured'})
            return

        # Okunamazsa acik birak: token'daki eject_after_elapsed yine tam
        # gunluk sinirla keser. Tablo yokken odalarin tamamen kapanmasindansa bu.
        kullanilan = bugunku_oda_saniyesi(token) or 0
        kalan = gunluk_limit_sn() - kullanilan
        if kalan < 60:
            self._json_yanit(429, {'error': 'daily_limit', 'kalanDk': 0})
            return

        oda_token = oda_token_uret(kullanici, oda, kalan)
        if not oda_token:
            self._json_yanit(502, {'error': 'daily_error'})
            return
        self._json_yanit(200, {'url': url, 'token': oda_token, 'kalanDk': kalan // 60})

    def _oda_presence(self):
        """Lobi icin oda doluluklari. Kimliksiz isteğe 401 (Daily anahtari kullaniliyor)."""
        baslik = self.headers.get('Authorization') or ''
        token = baslik[7:] if baslik.startswith('Bearer ') else None
        if not dogrula_supabase_kullanicisi(token):
            self._json_yanit(401, {'error': 'unauthorized'})
            return
        if not os.environ.get('DAILY_API_KEY'):
            self._json_yanit(503, {'error': 'not_configured'})
            return
        veri = oda_doluluklari()
        if veri is None:
            self._json_yanit(502, {'error': 'daily_error'})
            return
        self._json_yanit(200, {'rooms': veri})

    def do_GET(self):
        # 1. Güvenlik: Hassas dosyalara (kod, ortam değişkenleri, veritabanı şemaları) erişimi engelle
        clean_path = self.path.split('?')[0].split('#')[0]
        if clean_path == ODA_PRESENCE_PATH:
            self._oda_presence()
            return
        blocked_exts = ('.py', '.sql', '.env', '.md', '.bak')
        # '.yedek': yerel yedek HTML'ler (gitignored, canlıda yok) yerelde de servis edilmesin.
        if (clean_path.startswith('/.') or clean_path.endswith(blocked_exts) or '.yedek' in clean_path
                or (clean_path.endswith('.json') and clean_path != '/manifest.json')):
            self.send_error(403, "Forbidden")
            return

        # Kök adres tanitim sayfasini acar.
        if self.path == '/':
            self.path = '/landing.html'

        # HTML sayfasi: kendi inline <script> bloklarina izin veren CSP (bkz. CSP_SABLON).
        dosya = self.translate_path(self.path)
        self._csp = None
        if dosya.endswith('.html'):
            ozetler = ' '.join(inline_script_ozetleri(dosya))
            self._csp = CSP_SABLON.replace(' {inline}', (' ' + ozetler) if ozetler else '')

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
        # Güvenlik Başlıkları (Security Headers)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Content-Security-Policy', getattr(self, '_csp', None) or CSP)
        # HTTP uzerinden (localhost) tarayici bunu yok sayar; yalniz HTTPS'te etkili.
        self.send_header('Strict-Transport-Security', 'max-age=31536000')
        self.send_header('Permissions-Policy', PERMISSIONS_POLICY)
        super().end_headers()


if __name__ == '__main__':
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('', PORT), NoCacheHandler) as httpd:
        httpd.daemon_threads = True
        print(f'FocusAid gelistirme sunucusu (onbelleksiz, cok is parcali): http://localhost:{PORT}/auth.html')
        print('Durdurmak icin Ctrl+C')
        httpd.serve_forever()
