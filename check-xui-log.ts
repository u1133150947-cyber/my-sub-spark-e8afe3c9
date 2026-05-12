import { Client } from 'ssh2';
import * as fs from 'fs';
const CZ_IP = '45.142.122.90';
const RU_IP = '176.108.163.93';
const key = fs.readFileSync('/root/.ssh/id_rsa');

function checkLog(ip: string, name: string) {
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec('journalctl -u x-ui -n 50 --no-pager', (err, stream) => {
        let out = '';
        if (err) return resolve(name + ' error');
        stream.on('data', (d: any) => out += d).on('close', () => {
          conn.end();
          resolve(name + ' logs:\n' + out);
        });
      });
    }).connect({ host: ip, port: 22, username: 'root', privateKey: key });
  });
}
async function main() {
  console.log(await checkLog(CZ_IP, 'CZ'));
  console.log(await checkLog(RU_IP, 'RU'));
}
main();
