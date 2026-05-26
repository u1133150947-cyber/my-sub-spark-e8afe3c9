import { loginPanel, panelFetch, getPanelBySlug, getAllPanels } from './server/x3ui.ts';

for (const s of ['p2c70200bad','pc58a3d687d','pd7fa18ab53','cz','ru']) {
  try {
    const p = getPanelBySlug(s);
    console.log('===', s, p.country, p.panel_url);
    const r = await panelFetch(s, 'panel/inbound/list', { method: 'POST' });
    console.log('  list status=', r.status);
    let inbounds: any[] = [];
    try { const j = JSON.parse(r.body); inbounds = j.obj || []; } catch {}
    for (const i of inbounds) console.log('  ', i.port, i.protocol, 'enable=', i.enable, 'remark=', i.remark);
    // xray status
    const xs = await panelFetch(s, 'server/status', { method: 'POST' });
    let xj: any = {}; try { xj = JSON.parse(xs.body); } catch {}
    console.log('  xray:', xj.obj?.xray?.state, 'err:', xj.obj?.xray?.errorMsg?.slice(0,200));
  } catch(e:any) { console.log(s, 'ERR', e.message); }
}
