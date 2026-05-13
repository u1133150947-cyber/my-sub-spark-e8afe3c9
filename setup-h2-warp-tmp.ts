import { Client } from 'ssh2';
const c = new Client();
const cmd = `set -e
cp /etc/hysteria/config.yaml /etc/hysteria/config.yaml.bak.$(date +%s)
# Strip any existing outbounds: block, then append fresh one
python3 - <<'PY'
import re, pathlib
p = pathlib.Path('/etc/hysteria/config.yaml')
t = p.read_text()
# Remove existing outbounds: ... block (top-level key until next top-level key or EOF)
t = re.sub(r'(?ms)^outbounds:.*?(?=^\\S|\\Z)', '', t)
t = t.rstrip() + '\\n\\noutbounds:\\n  - name: warp\\n    type: socks5\\n    socks5:\\n      addr: 127.0.0.1:40000\\n'
p.write_text(t)
PY
echo '--- new config ---'
cat /etc/hysteria/config.yaml
systemctl restart hysteria-server.service
sleep 2
systemctl is-active hysteria-server.service
journalctl -u hysteria-server.service -n 15 --no-pager
`;
c.on('ready', () => c.exec(cmd, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
