import { Client } from 'ssh2';

async function fixConfig(ip: string, domain: string, pwd: string) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      const config = `
listen: :443
tls:
  cert: /root/.acme.sh/${domain}_ecc/fullchain.cer
  key: /root/.acme.sh/${domain}_ecc/${domain}.key
auth:
  type: http
  http:
    url: https://web.panelsu.ru/api/hy2/auth
masquerade:
  type: proxy
  proxy:
    url: https://bing.com
    rewriteHost: true
`;
      const cmd = `cat << 'YAMLEOF' > /etc/hysteria/config.yaml\n${config.trim()}\nYAMLEOF\nsystemctl restart hysteria-server.service && sleep 1 && systemctl status hysteria-server.service --no-pager`;
      conn.exec(cmd, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        let out = '';
        stream.on('close', () => { conn.end(); resolve(out); })
          .on('data', d => out += d).stderr.on('data', d => out += d);
      });
    }).connect({ host: ip, port: 22, username: 'root', password: pwd });
  });
}

async function main() {
  console.log("Fixing CZ...");
  console.log(await fixConfig("185.87.148.138", "reality.panelsu.ru", "hf6Ka8viMl"));
  
  console.log("Fixing RU...");
  console.log(await fixConfig("82.202.128.147", "realityru.panelsu.ru", "K!E2QAGrxYFx"));
}

main();
