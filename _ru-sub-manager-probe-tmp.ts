import { Client } from 'ssh2';
const c = new Client();
const script = `
echo '== /opt/sub-manager =='
ls -la /opt/sub-manager 2>/dev/null | head -40
echo '---'
find /opt/sub-manager -maxdepth 3 -type f \\( -name 'README*' -o -name '*.md' -o -name 'docker-compose*' -o -name 'Dockerfile' -o -name 'package.json' -o -name '.env*' -o -name 'install*' -o -name 'deploy*' \\) 2>/dev/null | head -30
echo '== /root sub-manager files =='
ls -la /root/ | grep -i sub
echo '== backup tar contents =='
ls -la /root/sub-manager-*.tar.gz 2>/dev/null
tar tzf /root/sub-manager-new.tar.gz 2>/dev/null | head -30
echo '== systemd =='
systemctl list-unit-files | grep -iE 'sub-manager|submanager|panel' || echo none
echo '== running on RU :8080 (deno) =='
ps auxf | grep -E 'deno|node' | grep -v grep | head -10
echo '== /opt content =='
ls -la /opt/sub-manager/ 2>/dev/null | head -20
`;
c.on('ready',()=>c.exec(script,(e,s)=>{
  s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write('E: '+d.toString()));
})).on('error',e=>console.error('ERR',e.message))
.connect({host:'82.202.128.147',port:22,username:'root',password:process.env.RU_SSH_PASSWORD,readyTimeout:20000});