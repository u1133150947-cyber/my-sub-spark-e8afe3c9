import {Client} from 'ssh2';
import {readFileSync} from 'fs';
const local = process.argv[2], remote = process.argv[3];
const c = new Client();
c.on('ready',()=>c.sftp((e,sftp)=>{
  if(e){console.error(e);process.exit(1)}
  sftp.writeFile(remote, readFileSync(local), err=>{
    if(err){console.error(err);process.exit(1)}
    console.log('uploaded',remote); c.end();
  });
})).on('error',e=>{console.error(e.message);process.exit(1)})
.connect({host:'185.87.148.138',port:22,username:'root',password:'hf6Ka8viMl'});
