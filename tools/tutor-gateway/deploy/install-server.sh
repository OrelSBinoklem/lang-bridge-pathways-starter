#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/langbridge-pathways.com/current"
GATEWAY_DIR="$APP_DIR/tools/tutor-gateway"
FRONTEND_ENV="$APP_DIR/frontend/.env.production"
NGINX_SITE="/etc/nginx/sites-available/langbridge-pathways.com"

if [[ ! -f "$NGINX_SITE" ]]; then
  NGINX_SITE="/etc/nginx/sites-enabled/langbridge-pathways.com"
fi

cd "$GATEWAY_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if grep -q '^TUTOR_GATEWAY_HOST=' .env; then
  sed -i 's#^TUTOR_GATEWAY_HOST=.*#TUTOR_GATEWAY_HOST=127.0.0.1#' .env
else
  printf '\nTUTOR_GATEWAY_HOST=127.0.0.1\n' >> .env
fi

if grep -q '^TUTOR_GATEWAY_PORT=' .env; then
  sed -i 's#^TUTOR_GATEWAY_PORT=.*#TUTOR_GATEWAY_PORT=8788#' .env
else
  printf 'TUTOR_GATEWAY_PORT=8788\n' >> .env
fi

if grep -q '^NEXT_PUBLIC_TUTOR_WS_URL=' "$FRONTEND_ENV"; then
  sed -i 's#^NEXT_PUBLIC_TUTOR_WS_URL=.*#NEXT_PUBLIC_TUTOR_WS_URL=wss://langbridge-pathways.com/tutor-ws/ws#' "$FRONTEND_ENV"
else
  printf '\nNEXT_PUBLIC_TUTOR_WS_URL=wss://langbridge-pathways.com/tutor-ws/ws\n' >> "$FRONTEND_ENV"
fi

npm install --omit=dev

cp "$GATEWAY_DIR/deploy/tutor-gateway.service" /etc/systemd/system/tutor-gateway.service
systemctl daemon-reload
systemctl enable tutor-gateway
systemctl restart tutor-gateway

if ! grep -q 'location \^~ /tutor-ws/' "$NGINX_SITE"; then
  cp "$NGINX_SITE" "$NGINX_SITE.bak.$(date +%Y%m%d%H%M%S)"
  awk '
    NR == FNR {
      snippet = snippet $0 ORS
      next
    }
    /    location \/ \{/ && !inserted {
      printf "%s", snippet
      inserted = 1
    }
    { print }
  ' "$GATEWAY_DIR/deploy/nginx-tutor-ws-location.conf" "$NGINX_SITE" > "$NGINX_SITE.tmp"
  mv "$NGINX_SITE.tmp" "$NGINX_SITE"
fi

nginx -t
systemctl reload nginx

cd "$APP_DIR/frontend"
npm run build
systemctl restart langbridge-next

systemctl is-active tutor-gateway
systemctl is-active langbridge-next
