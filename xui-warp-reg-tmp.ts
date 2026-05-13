import { panelFetch } from './server/x3ui.ts';
const r1 = await panelFetch('pd4e485d3c9', '/panel/warp/data', { method: 'POST' });
console.log('DATA:', JSON.stringify(r1));
const r2 = await panelFetch('pd4e485d3c9', '/panel/warp/reg', { method: 'POST' });
console.log('REG:', JSON.stringify(r2));
const r3 = await panelFetch('pd4e485d3c9', '/panel/warp/data', { method: 'POST' });
console.log('DATA AFTER:', JSON.stringify(r3));
