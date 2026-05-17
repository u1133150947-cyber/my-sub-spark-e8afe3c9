import {Client} from 'ssh2';
function run(host:string,pass:string,cmd:string):Promise<string>{
  return new Promise((res)=>{const c=new Client();let o='';
    c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){res('ERR:'+e.message);return}
      s.on('close',()=>{c.end();res(o)}).on('data',(d:any)=>o+=d).stderr.on('data',(d:any)=>o+=d);
    })).on('error',e=>res('SSH:'+e.message))
    .connect({host,port:22,username:'root',password:pass,readyTimeout:15000});
  });
}

const probe=(target:string,name:string)=>`
echo '========== ${name} =========='
echo '--- ping ICMP 20 пакетов ---'
ping -c 20 -W 2 ${target} | tail -4
echo '--- mtr 20 циклов ---'
mtr -rwzc 20 ${target} 2>/dev/null | tail -20
echo '--- TCP handshake до 443 (10 раз) ---'
for i in 1 2 3 4 5 6 7 8 9 10; do
  t=$( { time timeout 3 bash -c "</dev/tcp/${target}/443" ; } 2>&1 | grep real | awk '{print $2}')
  echo "try $i: $t"
done
`;

console.log('\n##############  RU → CZ (185.87.148.138 / reality.panelsu.ru)  ##############');
console.log(await run('82.202.128.147','K!E2QAGrxYFx', probe('185.87.148.138','RU→CZ IP')+probe('reality.panelsu.ru','RU→CZ домен')));

console.log('\n##############  CZ → RU (82.202.128.147 / ru.panelsu.ru)  ##############');
console.log(await run('185.87.148.138','hf6Ka8viMl', probe('82.202.128.147','CZ→RU IP')+probe('ru.panelsu.ru','CZ→RU домен')));
