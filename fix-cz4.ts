import { Client } from 'ssh2';

async function updateHysteria(ip: string, domain: string, pwd: string) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      const config = `
listen: :443
tls:
  cert: /root/.acme.sh/reality.panelsu.ru_ecc/fullchain.cer
  key: /root/.acme.sh/reality.panelsu.ru_ecc/reality.panelsu.ru.key
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
      const cmd = `cat << 'YAMLEOF' > /etc/hysteria/config.yaml
${config.trim()}
YAMLEOF
systemctl restart hysteria-server.service && systemctl status hysteria-server.service --no-pager
`;
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let out = '';
        stream.on('close', () => { conn.end(); resolve(out); })
              .on('data', d => out += d).stderr.on('data', d => out += d);
      });
    }).on('error', reject).connect({ host: ip, port: 22, username: 'root', password: pwd, readyTimeout: 10000 });
  });
}

async function main() {
  try {
    console.log(await updateHysteria('185.87.148.138', 'reality.panelsu.ru', 'ZSLFw8KE'));
  } catch (e: any) { console.error('CZ fail:', e.message); }
}
main();
