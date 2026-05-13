import { Client } from 'ssh2';

async function checkCert(ip: string, domain: string, pwd: string) {
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(`openssl x509 -in /root/.acme.sh/${domain}_ecc/fullchain.cer -text -noout | grep -E "Issuer:|Subject:"`, (err, stream) => {
        let out = '';
        stream.on('close', () => { conn.end(); resolve(out); })
          .on('data', d => out += d).stderr.on('data', d => out += d);
      });
    }).connect({ host: ip, port: 22, username: 'root', password: pwd });
  });
}

async function main() {
  console.log("CZ:");
  console.log(await checkCert("185.87.148.138", "reality.panelsu.ru", "hf6Ka8viMl"));
  console.log("RU:");
  console.log(await checkCert("82.202.128.147", "realityru.panelsu.ru", "K!E2QAGrxYFx"));
}

main();
