import { Client } from 'ssh2';
const c = new Client();
const cmd = `
cat > /etc/nginx/sites-available/xhttp-cdn.conf <<'NGINX'
server {
    listen 443 ssl http2 default_server;
    server_name _;
    ssl_certificate     /etc/ssl/xhttp/fullchain.pem;
    ssl_certificate_key /etc/ssl/xhttp/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    location /twcdn-xhttp {
        proxy_pass http://127.0.0.1:10444;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
}
NGINX
nginx -t && systemctl reload nginx && echo OK
echo
echo '=== last nginx access ==='
tail -20 /var/log/nginx/access.log 2>/dev/null
echo
echo '=== last nginx errors ==='
tail -20 /var/log/nginx/error.log 2>/dev/null
echo
curl -k -sS -m 5 -H 'Host: kclxvgxzs7.cdn.twcstorage.ru' https://127.0.0.1/ -w '\nlocal w/CDN host -> %{http_code}\n'
`;
c.on('ready',()=>c.exec(cmd,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
