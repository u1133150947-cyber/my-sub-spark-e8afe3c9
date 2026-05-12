const { Client } = require('ssh2');

const conn = new Client();
const HOST = '82.202.128.147';
const USERNAME = 'root';
const PASSWORD = 'K!E2QAGrxYFx';
const panelUser = 'admin_3x';
const panelPass = 'XUIhh5sj3!';

conn.on('ready', () => {
  const script = `
  node -e "
    const http = require('http');
    const qs = require('querystring');
    const postData = qs.stringify({ username: '${panelUser}', password: '${panelPass}' });
    
    const req = http.request({
      hostname: '127.0.0.1',
      port: 2053,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : '';
        console.log('Login Response:', data);
        console.log('Cookie:', cookie);
        
        if (cookie) {
          const installReq = http.request({
            hostname: '127.0.0.1',
            port: 2053,
            path: '/server/installXray/v25.8.29',
            method: 'POST',
            headers: {
              'Cookie': cookie,
              'Accept': 'application/json'
            }
          }, (installRes) => {
            let resData = '';
            installRes.on('data', chunk => resData += chunk);
            installRes.on('end', () => {
              console.log('Install Xray Response:', resData);
            });
          });
          installReq.end();
        }
      });
    });
    req.write(postData);
    req.end();
  "
  `;
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end()).on('data', d => console.log('STDOUT: ' + d)).stderr.on('data', d => console.log('STDERR: ' + d));
  });
}).connect({ host: HOST, port: 22, username: USERNAME, password: PASSWORD });
