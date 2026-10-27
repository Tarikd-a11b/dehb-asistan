#!/usr/bin/env bash
# Yedeğin GERÇEKTEN geri yüklenebildiğini dener — canlı n8n'e DOKUNMADAN.
#   ./geri-yukle-dene.sh                       # en son yedek
#   ./geri-yukle-dene.sh yedek/n8n-20261027-0330.sqlite.gz
#
# Ne yapıyor: yedeği geçici bir Docker hacmine açar, AYNI sürüm ve AYNI
# N8N_ENCRYPTION_KEY ile geçici bir n8n konteynerinde workflow listesini ve
# credential'ların çözülebildiğini kontrol eder, sonra her şeyi siler.
# Port açmaz, webhook çalıştırmaz, canlı hacme bağlanmaz.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
YEDEK="${1:-yedek/n8n-SON.sqlite.gz}"
[ -f "$YEDEK" ] || { echo "yedek yok: $YEDEK"; exit 1; }

GECICI="n8n-geri-yukle-deneme-$$"
docker volume create "$GECICI" >/dev/null
trap 'docker volume rm -f "$GECICI" >/dev/null' EXIT

gunzip -c "$YEDEK" | docker run --rm -i -v "$GECICI:/data" alpine:3.20 sh -c \
  'cat > /data/database.sqlite && chown -R 1000:1000 /data'

calistir() {
  docker run --rm --network none -v "$GECICI:/home/node/.n8n" \
    -e DB_TYPE=sqlite -e N8N_ENCRYPTION_KEY="$N8N_ENCRYPTION_KEY" \
    -e N8N_DIAGNOSTICS_ENABLED=false -e N8N_RUNNERS_ENABLED=false \
    "n8nio/n8n:$N8N_VERSION" "$@"
}

echo "== workflow'lar (FocusAid Weekly Processor vb. görünmeli)"
calistir n8n list:workflow
echo "== credential'lar şifresi çözülerek dışa aktarılabiliyor mu"
SAYI=$(calistir n8n export:credentials --all --decrypted 2>/dev/null | grep -c '"name"' || true)
[ "$SAYI" -gt 0 ] || { echo "HATA: credential çözülemedi (yanlış N8N_ENCRYPTION_KEY?)"; exit 1; }
echo "credential sayısı: $SAYI"
echo "GERİ YÜKLEME DENEMESİ BAŞARILI — tarihi KURULUM.md'deki tabloya yaz."
