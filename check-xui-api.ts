import { testPanelConnection, loginPanel, panelFetch } from './server/x3ui.ts';
const hosts = [
  { url: 'https://ru.panelsu.ru:2053', user: 'admin', pass: 'sD2bU8oJ7mQ!vR9wF@p' },
  { url: 'https://cz.panelsu.ru:35978', user: 'admin', pass: 'Z7xK#mN4vA$bC2yH9' },
];

async function addTest() {
  const h = hosts[0];
  const cookie = await loginPanel(h.url, h.user, h.pass);
  // Get an existing valid inbound to see its format! Wait, there is none.
  // Let's create one using the panel API and see if it crashes x-ui?
  // We can just ask for the panel's default config if it has one.
  const list = await panelFetch(h.url, '/panel/api/inbounds/list', cookie);
  console.log('inbounds:', list.obj.map((i: any) => ({ remark: i.remark, protocol: i.protocol, network: JSON.parse(i.streamSettings)?.network })));
}
addTest();
