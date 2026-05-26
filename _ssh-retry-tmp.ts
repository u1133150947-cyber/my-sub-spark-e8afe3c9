import { Client } from 'ssh2';
const pwds=['K!E2QAGrxYFx'];
for(const pw of pwds){
  await new Promise<void>(r=>{
    const c=new Client();
    c.on('ready',()=>{console.log('OK',pw);c.exec('hostname',(e,s)=>{s.on('close',()=>{c.end();r();}).on('data',d=>process.stdout.write(d));});})
     .on('error',e=>{console.log('FAIL',pw,e.message);r();})
     .connect({host:'82.202.128.147',port:22,username:'root',password:pw,readyTimeout:20000,tryKeyboard:true});
    c.on('keyboard-interactive',(n,i,l,p,f)=>f([pw]));
  });
}
