#!/usr/bin/env bash
# FocusAid — 1 GB RAM'lik bir Ubuntu/Debian VM'e n8n kurar (HTTPS dahil).
# GCP e2-micro, Oracle E2.1.Micro, ya da herhangi bir 1 GB VPS'te aynı şekilde çalışır.
#
# Kullanım (VM'e ssh ile girdikten sonra):
#   sudo bash kur.sh
#
# Öncesinde .env dosyasını doldurmuş olman gerekir (bkz. env.ornek).
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
	echo "HATA: .env yok. env.ornek dosyasını .env olarak kopyalayıp doldur." >&2
	exit 1
fi
# shellcheck disable=SC1091
source .env
: "${DOMAIN:?.env icinde DOMAIN bos}"
: "${DUCKDNS_TOKEN:?.env icinde DUCKDNS_TOKEN bos}"

DUCK_SUB="${DOMAIN%%.duckdns.org}"

echo "==> 1/6  2 GB swap (1 GB RAM tek başına n8n'e dar gelir)"
if ! swapon --show | grep -q '/swapfile'; then
	fallocate -l 2G /swapfile
	chmod 600 /swapfile
	mkswap /swapfile
	swapon /swapfile
	grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
	# Swap'e erken kaçmasın, ama gerekince kullansın.
	sysctl -w vm.swappiness=10
	grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >>/etc/sysctl.conf
	echo "    swap acildi"
else
	echo "    swap zaten var, atlandi"
fi

echo "==> 2/6  Docker"
if ! command -v docker >/dev/null 2>&1; then
	export DEBIAN_FRONTEND=noninteractive
	apt-get update -qq
	apt-get install -y -qq ca-certificates curl gnupg
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
		gpg --dearmor -o /etc/apt/keyrings/docker.gpg
	chmod a+r /etc/apt/keyrings/docker.gpg
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
		>/etc/apt/sources.list.d/docker.list
	apt-get update -qq
	apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
	echo "    docker kuruldu"
else
	echo "    docker zaten var, atlandi"
fi

echo "==> 3/6  Guvenlik duvari (80/443)"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
	ufw allow 80/tcp && ufw allow 443/tcp
fi
# Oracle imajlarinda iptables varsayilan olarak kapali gelir:
if command -v iptables >/dev/null 2>&1; then
	iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null ||
		iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT || true
	iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null ||
		iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT || true
	command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save || true
fi
echo "    80/443 acildi"

echo "==> 4/6  DuckDNS (ucretsiz alan adi -> bu makinenin IP'si)"
cat >/usr/local/bin/duckdns-guncelle <<DUCK
#!/bin/sh
curl -fsS "https://www.duckdns.org/update?domains=${DUCK_SUB}&token=${DUCKDNS_TOKEN}&ip=" >/var/log/duckdns.log 2>&1
DUCK
chmod +x /usr/local/bin/duckdns-guncelle
/usr/local/bin/duckdns-guncelle
if ! grep -q duckdns-guncelle /etc/crontab; then
	echo '*/5 * * * * root /usr/local/bin/duckdns-guncelle' >>/etc/crontab
fi
echo "    ${DOMAIN} -> $(curl -fsS ifconfig.me || echo '?') olarak ayarlandi"

echo "==> 5/6  n8n + Caddy ayaga kalkiyor"
docker compose pull
docker compose up -d

echo "==> 6/6  Bekleniyor (ilk HTTPS sertifikasi ~30 sn surer)"
for i in $(seq 1 30); do
	if curl -fsS -o /dev/null "https://${DOMAIN}/healthz" 2>/dev/null; then
		echo
		echo "TAMAM. n8n hazir: https://${DOMAIN}"
		echo "Webhook adresleri:"
		echo "  https://${DOMAIN}/webhook/focusaid-processor"
		echo "  https://${DOMAIN}/webhook/focusaid-analyze"
		exit 0
	fi
	sleep 5
done

echo
echo "Henuz cevap vermiyor. Loglara bak:" >&2
echo "  docker compose logs -f --tail=100" >&2
exit 1
