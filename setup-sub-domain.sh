#!/bin/bash
# Запусти на сервере: sudo bash setup-sub-domain.sh
# Перед запуском: пропиши A-запись sub.panelsu.ru → IP сервера

set -e
DOMAIN="sub.panelsu.ru"
SUPA="tyflywtpmeaqldzaoraj.supabase.co"

# 1) nginx конфиг с проксированием на edge function + переписыванием Content-Type
cat > /etc/nginx/sites-available/$DOMAIN <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        # Проксируем на edge function /sub
        proxy_pass https://$SUPA/functions/v1/sub\$request_uri;
        proxy_set_header Host $SUPA;
        proxy_set_header Accept "text/html";
        proxy_ssl_server_name on;
        proxy_http_version 1.1;

        # Убираем CSP/sandbox от supabase и фиксируем Content-Type
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Content-Type;
        proxy_hide_header X-Content-Type-Options;
        add_header Content-Type "text/html; charset=utf-8" always;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t && systemctl reload nginx

# 2) SSL
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect

echo ""
echo "✅ Готово! Открой: https://$DOMAIN/<slug>"
echo "Например: https://$DOMAIN/e5c3vxysl07o"
