import { Client } from 'ssh2';
function ssh(cmd:string){return new Promise<string>(r=>{const c=new Client();let o='';c.on('ready',()=>c.exec(cmd,(e,s)=>{if(e){r(String(e));return;}s.on('close',()=>{c.end();r(o);}).on('data',d=>o+=d.toString()).stderr.on('data',d=>o+=d.toString());})).on('error',e=>r('SSH:'+e.message)).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});});}

const VERN_UUID='80c4aa5b-607f-4143-9dd1-aa8b12ec4195';
// Connection pass: vern.<UUID> -> pass field must be bcrypt(UUID)
console.log(await ssh(`set +e
DB=/usr/local/h-ui/data/h_ui.db
# Generate bcrypt hash for the password '${VERN_UUID}' using python
HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'${VERN_UUID}', bcrypt.gensalt()).decode())" 2>/dev/null)
if [ -z "$HASH" ]; then
  apt-get install -y -qq python3-bcrypt 2>&1 | tail -3
  HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'${VERN_UUID}', bcrypt.gensalt()).decode())")
fi
echo "HASH=$HASH"
sqlite3 $DB "UPDATE account SET pass='$HASH', con_pass='vern.${VERN_UUID}', update_time=CURRENT_TIMESTAMP WHERE username='vern';"
echo '--- account row ---'
sqlite3 $DB "SELECT id,username,substr(pass,1,30),con_pass,role,deleted FROM account WHERE username='vern';"
echo
echo '--- test auth ---'
curl -ksS --http1.1 -A 'Mozilla/5.0' -X POST https://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"vern.${VERN_UUID}","addr":"1.2.3.4:1234","tx":0}'; echo
echo '--- test bad auth ---'
curl -ksS --http1.1 -A 'Mozilla/5.0' -X POST https://127.0.0.1:8081/hui/hysteria2/auth -H 'Content-Type: application/json' -d '{"auth":"vern.bogus","addr":"1.2.3.4:1234","tx":0}'; echo
`));
