import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`
for U in https://web.panelsu.ru/api/hy2/auth https://app.panelsu.ru/api/hy2/auth https://reality.panelsu.ru/api/hy2/auth; do
  echo "=== $U ==="
  curl -sS -o /dev/null -w 'HEAD code=%{http_code} redirect=%{redirect_url}\\n' -I "$U"
  curl -sS -o /tmp/body -w 'POST code=%{http_code} ct=%{content_type}\\n' -X POST -H 'Content-Type: application/json' -d '{"addr":"1.1.1.1:1","auth":"test","tx":0}' "$U"
  echo '-- body --'; head -c 300 /tmp/body; echo
done
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '87.121.105.143', port: 22, username: 'root', password: 'f4OQrEBYUQnEmwkgqPnwDD' });