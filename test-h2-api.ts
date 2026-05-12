import { addInbound, listInbounds } from './server/x3ui.ts';

async function test() {
  try {
    const res = await addInbound('cz', {
      up: 0, down: 0, total: 0, remark: '🚀 Hysteria Европа (Test)', enable: false, expiryTime: 0,
      listen: '', port: 44433, protocol: 'hysteria',
      settings: JSON.stringify({
        version: 2,
        clients: [{ id: 'fcb33869-d6ad-4521-ba31-31405cb6b29c', email: 'test-h2@example.com' }]
      }),
      streamSettings: JSON.stringify({
        network: 'hysteria', security: 'none'
      }),
      sniffing: JSON.stringify({ enabled: false, destOverride: [] })
    });
    console.log("Success:", res);
  } catch (e) {
    console.log("Failed:", e.message);
  }
}
test();
