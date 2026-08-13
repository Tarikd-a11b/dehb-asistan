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
        'N8N_WEBHOOK': os.environ.get('N8N_WEBHOOK', 'http://localhost:5678/webhook/focusaid-processor'),
        'N8N_ANALYZE_WEBHOOK': os.environ.get('N8N_ANALYZE_WEBHOOK', 'http://localhost:5678/webhook/focusaid-analyze'),
        'TIMEZONE': os.environ.get('TIMEZONE', 'Europe/Istanbul')
    }

    js_content = '// Auto-generated from environment variables\n'
    js_content += 'const FOCUSAID_CONFIG = ' + json.dumps(config, indent=4) + ';\n'
    return js_content.encode('utf-8')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/config.js':
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
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
        print(f'FocusAid gelistirme sunucusu (onbelleksiz): http://localhost:{PORT}/auth.html')
        print('Durdurmak icin Ctrl+C')
        httpd.serve_forever()
