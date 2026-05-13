import { readFileSync, writeFileSync } from 'fs';

// Patch server/panel.ts
let panel = readFileSync('server/panel.ts', 'utf8');

// 1. Add standalone helper functions
const stHelpers = `
function getStandaloneNumId(id: string) {
  if (id === 'cz') return 1001;
  if (id === 'ru') return 1002;
  return parseInt(id, 36) % 10000 || 1000;
}
function getStandaloneStrId(num: number) {
  if (num === 1001) return 'cz';
  if (num === 1002) return 'ru';
  return String(num);
}
`;
if (!panel.includes('getStandaloneNumId')) {
  panel = panel.replace('export async function handlePanel', stHelpers + '\nexport async function handlePanel');
}

// 2. Add standalone panel to inbounds response
if (!panel.includes('Hysteria 2 (Standalone)')) {
  panel = panel.replace(
    /const result: Record<string, any> = {};\n\s+const meta = all.map\(\(p\) => \(\{ slug: p.slug, name: p.name \}\)\);/,
    `const result: Record<string, any> = {};
      const meta = all.map((p) => ({ slug: p.slug, name: p.name }));
      try {
        const stRows = db.queryEntries("SELECT id, name, host, port FROM standalone_servers ORDER BY created_at ASC");
        if (stRows.length > 0) {
          meta.push({ slug: "standalone", name: "Hysteria 2 (Premium)" });
          result["standalone"] = stRows.map((s: any) => ({
            id: getStandaloneNumId(s.id),
            remark: s.name,
            protocol: "hysteria2",
            port: s.port,
            enable: true,
            clients: []
          }));
        }
      } catch(e) {}`
  );
}

// 3. Patch "create" action
if (!panel.includes('if (sel.panel === "standalone")')) {
  panel = panel.replace(
    /const panelRow = getPanelBySlug\(sel.panel\);/g,
    `if (sel.panel === "standalone") {
            const strId = getStandaloneStrId(sel.inboundId);
            const srv = db.queryEntries(\`SELECT name, host, port FROM standalone_servers WHERE id = ?\`, [strId])[0] as any;
            if (!srv) throw new Error("Standalone server not found");
            const stream = { security: "tls", tlsSettings: { serverName: srv.host } };
            const email = \`\${baseEmail}_standalone\${sel.inboundId}\`;
            db.query(\`INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
              [uid(), sub!.id, "standalone", sel.inboundId, srv.name, "hysteria2", srv.port, srv.host, JSON.stringify(stream), email]);
            created.push({ panel: "standalone", inboundId: sel.inboundId, remark: srv.name });
            continue;
          }
          const panelRow = getPanelBySlug(sel.panel);`
  );
}

// 4. Patch "addInbounds" action
// Note: The previous replacement might have replaced both if they use exactly `const panelRow = getPanelBySlug(sel.panel);`
// Let's make sure it replaces properly for addInbounds too if it's there. 
// We used /g so it should have caught both.

// 5. Patch "removeInbound" action
if (!panel.includes('if (panel !== "standalone")')) {
  panel = panel.replace(
    /await deleteClient\(panel, inboundId, sub\.client_uuid, link\?\.protocol \?\? "vless"\);/g,
    `if (panel !== "standalone") { await deleteClient(panel, inboundId, sub.client_uuid, link?.protocol ?? "vless"); }`
  );
}

// 6. Patch "delete" action
if (!panel.includes('if (l.panel !== "standalone")')) {
  panel = panel.replace(
    /await deleteClient\(l\.panel, l\.inbound_id, sub\.client_uuid, l\.protocol\);/g,
    `if (l.panel !== "standalone") { await deleteClient(l.panel, l.inbound_id, sub.client_uuid, l.protocol); }`
  );
}

writeFileSync('server/panel.ts', panel);
console.log("Patched server/panel.ts");

// Patch server/sub.ts
let sub = readFileSync('server/sub.ts', 'utf8');

if (!sub.includes('if (panel === "standalone") return;')) {
  sub = sub.replace(
    /await Promise\.all\(panels\.map\(async \(panel\) => \{/,
    `await Promise.all(panels.map(async (panel) => {\n    if (panel === "standalone") return;`
  );
}

// Remove the hardcoded standalone block
sub = sub.replace(/\/\/ Add standalone Hysteria 2 servers[\s\S]*?try \{[\s\S]*?\} catch \(e\) \{[\s\S]*?\}/, '');

writeFileSync('server/sub.ts', sub);
console.log("Patched server/sub.ts");

