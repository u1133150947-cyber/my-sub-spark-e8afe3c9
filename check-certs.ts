import { Client } from 'ssh2';
async function listCerts(ip: string, pwd: string) {
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec('ls -la /root/.acme.sh/*_ecc/', (err, stream) => {
        let out = '';
        stream.on('close', () => { conn.end(); resolve(out); })
          .on('data', d => out += d).stderr.on('data', d => out += d);
      });
    }).connect({ host: ip, port: 22, username: 'root', password: pwd });
  });
}
async function main() {
  console.log("CZ:");
  console.log(await listCerts("185.87.148.138", "hf6Ka8viMl"));
  console.log("RU:");
  console.log(await listCerts("82.202.128.147", "K!E2QAGrxYFx"));
}
main();
