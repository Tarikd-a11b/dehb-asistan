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

PORT = 3000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
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
