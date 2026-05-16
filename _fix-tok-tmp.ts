import {Client} from 'ssh2';
const TOKEN='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';
const c=new Client();
c.on('ready',()=>c.exec(`
echo '--- list repos with token ---'
curl -s -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" "https://api.github.com/user/repos?per_page=20&sort=updated" | grep '"full_name"' | head -20
echo '--- installations ---'
curl -s -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/vnd.github+json" https://api.github.com/user/installations | head -c 500
echo
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stdout.write(d.toString()))}))
.connect({host:'82.202.128.147',port:22,username:'root',password:'K!E2QAGrxYFx'});
