# n8n'i canlıya alma — 1 GB'lık ücretsiz VM

Render'ın 512 MB'ı n8n'e yetmiyor (`JavaScript heap out of memory`). Çözüm:
**gerçek bir 1 GB VM.** Bu klasördeki dosyalar hem GCP e2-micro'da hem Oracle
E2.1.Micro'da hem de herhangi bir 1 GB VPS'te aynı şekilde çalışır.

## Neden bu kurulum Render'dakinden farklı

| | Render'daki (çöken) | Buradaki |
|---|---|---|
| RAM | 512 MB | 1 GB + 2 GB swap |
| Veritabanı | Supabase Postgres (bağlanamıyordu) | Yerel SQLite — dış bağımlılık yok |
| Node heap | ~245 MB'da patlıyordu | `--max-old-space-size=640` |
| Task runner | ayrı süreç, ~100 MB | kapalı |
| HTTPS | Render veriyordu | Caddy + Let's Encrypt (ücretsiz) |
| CORS | — | Caddy'de preflight çözülü |

## Senin yapman gerekenler (ben yapamam: hesap açma + kart)

### 1. VM al
**GCP (önerilen):** console.cloud.google.com → Compute Engine → Create instance
- Region: **us-central1** / us-west1 / us-east1 (başkasında always-free geçmez)
- Machine type: **e2-micro**
- Boot disk: **Ubuntu 24.04 LTS**, 30 GB standard persistent disk
- Firewall: **Allow HTTP** ve **Allow HTTPS** kutularını işaretle
- ⚠️ 90 günlük deneme bitince hesabı "Pay as you go"a yükseltmezsen makine kapanır.
  Yükseltince always-free sınırında kaldığın sürece **ücret çıkmaz**.

**Oracle E2.1.Micro:** aslında bu da 1 GB. VCN/subnet/SSH anahtarın hazır duruyor
(`~/.ssh/oracle_n8n`). O geceki kilitlenme swap'siz `dnf` yüzündeydi — bu script
swap'i ilk adımda açtığı için aynı hataya düşmez.

### 2. Ücretsiz alan adı al
https://duckdns.org → Google ile gir → bir alt alan adı ekle (ör. `focusaid-n8n`)
→ sayfanın üstündeki **token**'ı kopyala.

### 3. Dosyaları VM'e at ve çalıştır
```bash
scp -r gcp/* KULLANICI@VM_IP:~/n8n/
ssh KULLANICI@VM_IP
cd ~/n8n
cp env.ornek .env
nano .env            # DOMAIN, DUCKDNS_TOKEN ve N8N_ENCRYPTION_KEY doldur
openssl rand -hex 32 # cikan degeri N8N_ENCRYPTION_KEY'e yapistir
sudo bash kur.sh
```
Script swap'i açar, Docker'ı kurar, 80/443'ü açar, DuckDNS'i bağlar, n8n + Caddy'yi
kaldırır ve HTTPS sertifikasını alır. Bitince adresi ekrana yazar.

### 4. n8n'i ilk kez aç
`https://<alanadin>.duckdns.org` → sahip hesabını oluştur (kendi e-postan).

**Workflow'ları içe aktar** (`DehbProject/FocusAid/` altında):
| Dosya | Ne yapar | Gereken credential |
|---|---|---|
| `n8n-workflow-focusaid.json` | **Parçala** (`/webhook/focusaid-processor`) | **hiçbiri** ✅ |
| `n8n-workflow-analyzer.json` | Yönerge analizi (`/webhook/focusaid-analyze`) | Google Gemini API |
| `n8n-workflow-report.json` | Haftalık rapor (zamanlanmış) | Gemini + Gmail OAuth2 |

Her birini import ettikten sonra **Active** anahtarını aç.

> İşin kolay tarafı: asıl özellik olan **Parçala workflow'u hiçbir credential
> istemiyor**. Google Takvim'e kullanıcının kendi token'ıyla `httpRequest` ile
> yazıyor. Yani tek bir n8n kurulumu bütün kullanıcılara hizmet ediyor —
> kullanıcı başına ayar yok.

### 5. Render'daki FocusAid'i yeni adrese bağla
dashboard.render.com → **dehb-asistan** → Environment → şu ikisini güncelle:
```
N8N_WEBHOOK          = https://<alanadin>.duckdns.org/webhook/focusaid-processor
N8N_ANALYZE_WEBHOOK  = https://<alanadin>.duckdns.org/webhook/focusaid-analyze
```
Kaydet → servis kendiliğinden yeniden başlar. `serve.py` bu değerleri
`/config.js` içine enjekte ediyor, kod değişikliği gerekmiyor.

Yerelde geliştirirken `config.js`'teki `localhost:5678` kalabilir.

## ⚠️ Canlıya almadan önce kapatılması gereken güvenlik açığı

`/webhook/focusaid-processor` internete açık bir uç nokta olacak ve tarayıcı ona
**kullanıcının Google access token'ını** gönderiyor. Şu an önünde hiçbir doğrulama yok.

Yapılması gereken: webhook node'una **Header Auth** ekleyip ön yüzün
(`n8n-logic.js`) aynı gizli anahtarı `X-Focusaid-Secret` başlığında yollaması.
Caddy bu başlığa CORS'ta zaten izin veriyor. Bu ayrı bir iş — kurulum bitince
üstünden geçelim.

## Editöre erişim: yalnız SSH tüneli (2026-10-27'den beri)

Caddy internete **yalnız `/webhook/*` ve `/healthz`** geçiriyor; `/signin`, `/rest`,
`/api/v1` dışarıdan 404. Editörü açmak ya da `scripts/n8n-senkron.mjs` çalıştırmak için:

```bash
ssh -i ~/.ssh/oracle_n8n -N -L 5678:localhost:5678 ubuntu@138.2.171.36
# tarayıcıda: http://localhost:5678   (Chrome localhost'u güvenli sayar, giriş çerezi çalışır)
```

Webhook'lar `X-Focusaid-Secret` Header Auth ile korunuyor (yanlış/eksik başlık → 403,
2026-10-27'de dışarıdan doğrulandı).

## Sürüm güncelleme

İmaj `.env`'deki `N8N_VERSION` ile sabit. Ayda bir (ya da bülten çıkınca)
community.n8n.io → *Security Advisories*'e bak:

```bash
docker compose exec n8n n8n --version          # çalışan sürüm
nano .env                               # N8N_VERSION'ı yükselt (ASLA düşürme)
docker compose pull n8n && docker compose up -d
docker compose exec n8n n8n --version          # doğrula
```

⚠️ `env.ornek`'teki `N8N_VERSION`'ı sunucudaki `.env` ile **aynı** tut: CI'daki haftalık
Trivy taraması (`.github/workflows/guvenlik.yml`) sürümü oradan okuyor.

## Yedekleme ve geri yükleme denemesi

```bash
chmod +x yedekle.sh geri-yukle-dene.sh
./yedekle.sh                          # yedek/n8n-<tarih>.sqlite.gz (sqlite .backup + integrity_check)
crontab -e                            # 30 3 * * * cd /home/ubuntu/n8n && ./yedekle.sh >> yedek.log 2>&1
./geri-yukle-dene.sh                  # canlıya dokunmadan geçici konteynerde açıp dener
```

- Yedek `N8N_ENCRYPTION_KEY` olmadan işe yaramaz; anahtar **bilerek** yedeğin yanında
  değil (KVKK 2018/10: anahtar veriden ayrı). Parola yöneticisinde tut.
- VM'deki yedek VM'le birlikte gider: haftada bir bilgisayarına çek
  (`scp -i ~/.ssh/oracle_n8n ubuntu@138.2.171.36:n8n/yedek/n8n-SON.sqlite.gz .`).
- **Supabase** (ücretsiz planda indirilebilir yedek yok): ayda bir
  `npx supabase db dump --db-url "<Dashboard → Connect → Session pooler URI>" -f focusaid-<tarih>.sql`
  — URI veritabanı parolasını içerir, dosyaya/repoya yazma.

| tarih | ne denendi | sonuç |
|---|---|---|
| — | ilk geri yükleme denemesi henüz yapılmadı | — |

## Sertleştirme kontrol listesi (KVKK 2018/10: uzaktan erişimde iki aşamalı doğrulama)

VM'de:
```bash
sudo sshd -T | grep -E '^(passwordauthentication|permitrootlogin|kbdinteractiveauthentication)'
# beklenen: passwordauthentication no · permitrootlogin no · kbdinteractiveauthentication no
```
Değilse `/etc/ssh/sshd_config.d/99-focusaid.conf` içine bu üç satırı `no` olarak yaz,
`sudo sshd -t && sudo systemctl reload ssh` (açık oturumu kapatmadan yeni bir terminalden
girişi dene).

Hesaplarda 2FA: Supabase · Render · Oracle Cloud · GitHub · Google Cloud (Gemini anahtarı
aynı hesapta) · DuckDNS'e bağlı Google hesabı.

## Sorun çıkarsa
```bash
docker compose logs -f --tail=100   # n8n + caddy loglari
free -m                             # RAM/swap durumu
docker stats --no-stream            # konteyner bellek kullanimi
```
- **n8n açılmıyor, logda "task runners are required"** → `docker-compose.yml`'den
  `N8N_RUNNERS_ENABLED=false` satırını sil, `docker compose up -d`.
- **Sertifika alınamıyor** → DuckDNS kaydı henüz yayılmamıştır; 2 dk bekleyip
  `docker compose restart caddy`.
- **Yine OOM** → `NODE_OPTIONS=--max-old-space-size=512`'ye düşür, swap'i 4 GB yap.
