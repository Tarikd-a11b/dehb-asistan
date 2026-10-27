#!/usr/bin/env bash
# n8n yedeği — VM'de, docker-compose.yml'nin olduğu klasörde çalışır.
#   ./yedekle.sh                 # elle
#   crontab -e  →  30 3 * * * cd /home/ubuntu/n8n && ./yedekle.sh >> yedek.log 2>&1
#
# Ne alıyor: n8n'in SQLite veritabanı (workflow'lar, credential'lar ŞİFRELİ, ayarlar).
# sqlite3 ".backup" ile alınıyor: n8n çalışırken dosyayı düz kopyalamak yarım yazılmış
# bir sayfayı yakalayıp bozuk yedek üretebilir.
#
# ⚠️ Yedek, .env'deki N8N_ENCRYPTION_KEY OLMADAN işe yaramaz (credential'lar onunla
# şifreli). Anahtar bilerek yedeğin YANINA konmuyor (KVKK 2018/10: anahtar veriden
# ayrı) — parola yöneticisinde tut.
# ⚠️ Yedek VM'de kalırsa VM'le birlikte kaybolur: haftada bir bilgisayarına çek
#   scp -i ~/.ssh/oracle_n8n ubuntu@138.2.171.36:n8n/yedek/n8n-SON.sqlite.gz .
# Geri yüklenebildiğini ayda bir ./geri-yukle-dene.sh ile DENE — denenmemiş yedek yedek değildir.
set -euo pipefail

HEDEF="${YEDEK_KLASORU:-$PWD/yedek}"
SAKLA_GUN="${YEDEK_SAKLA_GUN:-14}"
mkdir -p "$HEDEF"

HACIM=$(docker volume ls --format '{{.Name}}' | grep -E '_n8n_data$' | head -1)
[ -n "$HACIM" ] || { echo "n8n_data hacmi bulunamadı"; exit 1; }

DAMGA=$(date +%Y%m%d-%H%M)
docker run --rm -v "$HACIM:/data:ro" -v "$HEDEF:/yedek" alpine:3.20 sh -c "
  apk add --no-cache sqlite >/dev/null &&
  sqlite3 /data/database.sqlite \".backup /yedek/n8n-$DAMGA.sqlite\" &&
  sqlite3 /yedek/n8n-$DAMGA.sqlite 'PRAGMA integrity_check;' | grep -qx ok"
gzip -f "$HEDEF/n8n-$DAMGA.sqlite"
ln -sf "n8n-$DAMGA.sqlite.gz" "$HEDEF/n8n-SON.sqlite.gz"

find "$HEDEF" -name 'n8n-2*.sqlite.gz' -mtime +"$SAKLA_GUN" -delete
echo "$(date -Is) yedek tamam: $HEDEF/n8n-$DAMGA.sqlite.gz ($(du -h "$HEDEF/n8n-$DAMGA.sqlite.gz" | cut -f1))"
