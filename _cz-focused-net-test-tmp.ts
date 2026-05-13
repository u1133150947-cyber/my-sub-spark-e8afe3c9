import { Client } from 'ssh2';

const c = new Client();
const cmd = `
set +e
printf '== WARP SOCKS detailed ==\n'
for u in \
  https://api.ipify.org \
  https://icanhazip.com \
  https://www.gstatic.com/generate_204 \
  https://cp.cloudflare.com/generate_204 \
  https://www.google.com/generate_204 \
  https://www.cloudflare.com/cdn-cgi/trace/; do
  printf '\n-- %s --\n' "$u"
  curl -4 -v --max-time 12 -x socks5h://127.0.0.1:40000 "$u" -o /tmp/curl.out 2>/tmp/curl.err
  rc=$?
  printf 'rc=%s\n' "$rc"
  head -c 220 /tmp/curl.out; echo
  tail -20 /tmp/curl.err | sed -E 's/(Authorization:|token=|password=).*/\\1 ***hidden***/g'
done
printf '\n== direct detailed small ==\n'
for u in https://api.ipify.org https://www.gstatic.com/generate_204; do
  printf '\n-- %s --\n' "$u"
  curl -4 -v --max-time 8 "$u" -o /tmp/curl.out 2>/tmp/curl.err
  printf 'rc=%s\n' "$?"
  head -c 120 /tmp/curl.out; echo
  tail -12 /tmp/curl.err
done
printf '\n== routes/dns ==\n'; ip route; resolvectl status 2>/dev/null | sed -n '1,90p' || cat /etc/resolv.conf
printf '\n== warp status/account ==\n'; warp-cli status 2>/dev/null || true; warp-cli settings 2>/dev/null | sed -n '1,120p' || true
`;

c.on('ready', () => c.exec(cmd, (err, s) => {
  if (err) { console.error(err); c.end(); return; }
  s.on('close', () => c.end())
   .on('data', d => process.stdout.write(d.toString()))
   .stderr.on('data', d => process.stderr.write(d.toString()));
})).on('error', e => console.error('SSH error:', e.message))
.connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl', readyTimeout: 15000 });
