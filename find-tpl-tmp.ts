import { Client } from 'ssh2';
const c = new Client();
c.on('ready', () => c.exec(`grep -r "blackhole" /usr/local/x-ui/ 2>/dev/null | grep -v binary | head; echo ==; find /usr/local/x-ui -name '*.go' -o -name '*.json' 2>/dev/null | xargs grep -l 'xrayTemplateConfig\\|outbounds' 2>/dev/null | head; echo ==; ls /usr/local/x-ui/`, (e, s) => {
  s.on('close', () => c.end()).on('data', d => process.stdout.write(d.toString())).stderr.on('data', d => process.stderr.write(d.toString()));
})).connect({ host: '185.87.148.138', port: 22, username: 'root', password: 'hf6Ka8viMl' });
