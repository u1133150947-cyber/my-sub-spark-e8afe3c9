import { Client } from 'ssh2';

const c = new Client();
const cmd = `
set +e
printf '== time/host ==\n'; date -Is; hostname -f || hostname
printf '\n== services ==\n'; systemctl is-active hysteria-server 2>/dev/null || true; systemctl is-active x-ui 2>/dev/null || true; systemctl is-active warp-svc 2>/dev/null || true; systemctl is-active wg-quick@wgcf 2>/dev/null || true; systemctl is-active sing-box 2>/dev/null || true
printf '\n== listeners relevant ==\n'; ss -lntup | egrep '(:443|:8443|:44433|:40000|:2080)' || true
printf '\n== direct internet ==\n'; curl -4 -sS --max-time 8 https://www.cloudflare.com/cdn-cgi/trace/ | egrep 'ip=|warp=|colo=' || echo direct_failed
printf '\n== local warp socks 40000 ==\n'; curl -4 -sS --max-time 10 -x socks5h://127.0.0.1:40000 https://www.cloudflare.com/cdn-cgi/trace/ | egrep 'ip=|warp=|colo=' || echo warp_socks_failed
printf '\n== local warp socks ipify ==\n'; curl -4 -sS --max-time 10 -x socks5h://127.0.0.1:40000 https://api.ipify.org && echo || echo warp_ipify_failed
printf '\n== hysteria config outbound/masq/auth/tls ==\n'; sed -n '1,220p' /etc/hysteria/config.yaml 2>/dev/null | sed -E 's/(password:|token:|auth:).*/\\1 ***hidden***/g' || true
printf '\n== hy2 auth endpoint from CZ ==\n'; curl -k -sS --max-time 8 -X POST https://web.panelsu.ru/api/hy2/auth -H 'content-type: application/json' -d '{"auth":"TEST-KEY-REALITY-123","addr":"127.0.0.1:12345"}' || echo auth_endpoint_failed; echo
printf '\n== hysteria recent errors ==\n'; journalctl -u hysteria-server -n 120 --no-pager 2>/dev/null | egrep -i 'error|warn|failed|timeout|warp|socks|auth|quic|tls|reject|panic' || true
printf '\n== x-ui recent warp/errors ==\n'; journalctl -u x-ui -n 120 --no-pager 2>/dev/null | egrep -i 'error|warn|failed|timeout|warp|socks|hysteria|hy2|panic' || true
`;

c.on('ready', () => c.exec(cmd, (err, s) => {
  if (err) { console.error(err); c.end(); return; }
  s.on('close', () => c.end())
   .on('data', d => process.stdout.write(d.toString()))
   .stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('SSH error:', e.message))
.connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 15000 });
