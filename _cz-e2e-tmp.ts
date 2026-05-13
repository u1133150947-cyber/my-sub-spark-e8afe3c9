import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
set -e
# Pick first valid client_uuid from local panel db (sub-manager not here, just use any UUID — auth goes via web.panelsu.ru/api/hy2/auth)
# Use known active sub from panel - need to grab one. Try test password matching some real user.
# Better: hit /api/hy2/auth manually with known sub uuid
echo '=== test auth endpoint ==='
curl -s -X POST https://web.panelsu.ru/api/hy2/auth -H 'content-type: application/json' -d '{"addr":"1.2.3.4:1234","auth":"INVALID","tx":0}' --max-time 10
echo
# Build a hysteria client config with known good sub. We need a real auth key.
echo '=== need real key from db ==='
