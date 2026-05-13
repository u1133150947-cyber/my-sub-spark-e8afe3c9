import { Client } from 'ssh2';
const c = new Client();
c.on('ready',()=>c.exec(`
echo '=== warp services ==='; systemctl list-units --all | grep -iE 'warp|wgcf' | head
echo '=== port 40000 ==='; ss -lntp | grep 40000; ss -lunp | grep 40000
echo '=== wgcf? ==='; which wgcf warp-cli warp-svc 2>&1
echo '=== try socks5 40000 ==='; timeout 5 curl -s --socks5 127.0.0.1:40000 -4 https://ifconfig.me; echo " <- exit:$?"
echo '=== direct ==='; curl -s --max-time 5 -4 https://ifconfig.me; echo
echo '=== wireguard? ==='; wg show 2>&1 | head; ip a | grep -E 'wg|warp' 
`,(e,s)=>{s.on('close',()=>c.end()).on('data',d=>process.stdout.write(d.toString())).stderr.on('data',d=>process.stderr.write(d.toString()));})).connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
