import { Client } from 'ssh2';
import { db, decodeRow } from './server/db.ts';

const RU_IP = '82.202.128.147';
const CZ_IP = '185.87.148.138';

function getPanelPassword(host: string) {
  const panel = db.queryEntries('SELECT password FROM panels WHERE host = ? OR public_host = ?', [host, host])[0] as any;
  if (!panel) return null;
  return panel.password;
}

const yamlConfig = `
listen: :443
tls:
  cert: /root/.acme.sh/fullchain.cer
  key: /root/.acme.sh/reality.key
auth:
  type: http
  http:
    endpoint: https://web.panelsu.ru/api/hy2/auth
masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
`;

async function updateServer(host: string, certDirName: string) {
  // Try decrypting if possible, but actually we can just use the environment variable if needed. 
  // Wait, I can just use the DB directly if I use the built-in decrypt. Let's just use the Deno decrypt.
}
