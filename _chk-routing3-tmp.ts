import { Client } from 'ssh2';
const cz = new Client();
cz.on('ready',()=>{
  console.log('cz ready, tunnel to RU');
  cz.forwardOut('127.0.0.1',0,'82.202.128.147',22,(err,stream)=>{
    if(err){console.error('fw:',err.message);cz.end();return;}
    const ru=new Client();
    ru.on('ready',()=>{
      ru.exec(`
sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='xrayTemplateConfig';" > /tmp/tpl.json
echo '=== outbounds ==='
jq '.outbounds | map({tag, protocol, addr:(.settings.vnext[0].address // null), port:(.settings.vnext[0].port // null), sni:(.streamSettings.realitySettings.serverName // null)})' /tmp/tpl.json
echo '=== routing ==='
jq '.routing' /tmp/tpl.json
echo '=== inbound ==='
sqlite3 /etc/x-ui/x-ui.db "SELECT id,tag,remark,port FROM inbounds;"
sqlite3 /etc/x-ui/x-ui.db "SELECT stream_settings FROM inbounds WHERE port=8443;" | jq '.realitySettings | {serverNames, shortIds, dest}'
sqlite3 /etc/x-ui/x-ui.db "SELECT sniffing FROM inbounds WHERE port=8443;"
echo '=== access tail ==='
tail -40 /usr/local/x-ui/access.log 2>/dev/null
echo '=== error tail ==='
tail -40 /usr/local/x-ui/error.log 2>/dev/null
`,(e,s)=>{
        if(e){console.error(e);ru.end();cz.end();return;}
        s.on('close',()=>{ru.end();cz.end();}).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));
      });
    }).on('error',e=>{console.error('ru:',e.message);cz.end();})
    .connect({sock:stream,username:'root',password:'K!E2QAGrxYFx',readyTimeout:15000});
  });
}).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
