import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`
echo '== from SE with real UUID =='
curl -sS -w '\\nHTTP=%{http_code}\\n' -X POST https://web.panelsu.ru/api/hy2/auth \\
  -H 'Content-Type: application/json' \\
  -d '{"addr":"127.0.0.1:1","auth":"c92866b0-40bd-4e2e-ad0f-3dfdd90332e6","tx":0}'
echo
echo '== verbose for redirect chain =='
curl -v -sS -o /dev/null -X POST https://web.panelsu.ru/api/hy2/auth \\
  -H 'Content-Type: application/json' \\
  -d '{"addr":"127.0.0.1:1","auth":"x","tx":0}' 2>&1 | grep -E '< HTTP|< Location|< Server|HTTP/' | head
`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '87.121.105.143', port: 22, username: 'root', password: 'f4OQrEBYUQnEmwkgqPnwDD' });