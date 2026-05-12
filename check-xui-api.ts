import { loginPanel, panelFetch } from './server/x3ui.ts';
async function addTest() {
  const cookie = await loginPanel('ru');
  const list = await panelFetch('ru', '/panel/api/inbounds/list', cookie);
  console.log('inbounds:', list.obj.map((i: any) => ({ remark: i.remark, protocol: i.protocol, network: JSON.parse(i.streamSettings)?.network })));
}
addTest();
