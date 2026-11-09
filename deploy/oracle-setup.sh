#!/usr/bin/env bash
# Proje Arkadaşım — Oracle Cloud Always Free (Ubuntu 22.04/24.04) tek komutluk kurulum.
# Kullanım (VM'de):  curl -fsSL https://raw.githubusercontent.com/nazmiefearmutcu/proje-arkadasim/main/deploy/oracle-setup.sh -o setup.sh && bash setup.sh
# Tekrar çalıştırmak güvenlidir: kodu günceller, ayarları korur, yeniden derler.
set -euo pipefail

REPO="https://github.com/nazmiefearmutcu/proje-arkadasim.git"
DIR="$HOME/proje-arkadasim"

echo "==> Paketler (Docker, git)"
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 git openssl iptables-persistent || \
  sudo apt-get install -y docker.io docker-compose-plugin git openssl iptables-persistent
sudo systemctl enable --now docker

echo "==> Takas alanı (küçük VM'lerde derleme belleği için 2 GB)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Güvenlik duvarı: 80 ve 443 (Oracle Ubuntu imajları varsayılan olarak kapatır)"
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 6 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
done
sudo netfilter-persistent save >/dev/null 2>&1 || true

echo "==> Kod"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
cd "$DIR"

ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
  echo "==> İlk kurulum ayarları"
  PUBLIC_IP="$(curl -fsS https://api.ipify.org || true)"
  DEFAULT_SITE="${PUBLIC_IP//./-}.sslip.io"
  read -r -p "Alan adı (boş bırakırsan ${DEFAULT_SITE}): " SITE
  SITE="${SITE:-$DEFAULT_SITE}"
  read -r -s -p "OpenAI API anahtarı (boş bırakırsan belgeler manuel incelemeye düşer): " OPENAI_KEY; echo
  read -r -p "SMTP adresi (smtps://kullanici:sifre@sunucu:465, boş bırakılabilir): " SMTP
  umask 077
  cat > "$ENV_FILE" <<CONF
SITE_ADDRESS=${SITE}
APP_URL=https://${SITE}
NODE_ENV=production
VERIFIER_PROVIDER=openai
OPENAI_API_KEY=${OPENAI_KEY}
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=low
DOC_HASH_PEPPER=$(openssl rand -hex 32)
SMTP_URL=${SMTP}
LOGIN_LOG_RETENTION_DAYS=365
CONF
  echo "Ayarlar $DIR/$ENV_FILE dosyasına yazıldı (yalnız sen okuyabilirsin)."
fi

echo "==> Derleme ve başlatma (ilk seferde birkaç dakika sürer)"
sudo docker compose --env-file "$ENV_FILE" up -d --build

SITE_NOW="$(grep '^SITE_ADDRESS=' "$ENV_FILE" | cut -d= -f2-)"
echo
echo "Hazır: https://${SITE_NOW}  (HTTPS sertifikası ilk istekte birkaç saniyede alınır)"
echo "İlk yönetici: sitede /kayit ile hesap aç, sonra:"
echo "  cd $DIR && sudo docker compose --env-file $ENV_FILE exec app npm run make-admin -- <e-posta>"
echo "Güncelleme: bash $DIR/deploy/oracle-setup.sh"
