import { listInbounds } from './server/x3ui.ts';
for (const s of ['p2c70200bad','pc58a3d687d','pd7fa18ab53','cz','ru']) {
  try {
    const inb = await listInbounds(s);
    console.log(s, 'count=', inb.length);
    for (const i of inb) console.log('  ', i.port, i.protocol, 'enable=',i.enable, 'remark=',i.remark);
  } catch(e:any) { console.log(s, 'ERR', e.message); }
}
