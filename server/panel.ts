// Port of supabase/functions/panel/index.ts to local SQLite.
import { db, decodeRow, uid } from "./db.ts";
import {
  addClient, bustPanelsCache, getAllPanels, getClientExpiryByEmail, getClientTrafficsByEmail,
  getPanelBySlug, hostFromUrl, listInbounds, panelCfg, panelFetch, randomSlug, updateClient, uuidv4, rawFetch,
} from "./x3ui.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function row<T = any>(sql: string, args: unknown[] = []): T | undefined {
  const r = db.queryEntries(sql, args as any)[0];
  return r as T | undefined;
}
function rows<T = any>(sql: string, args: unknown[] = []): T[] {
  return db.queryEntries(sql, args as any) as T[];
}

export async function handlePanel(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const action = url.searchParams.get("action") ?? "";
  try {
    if (action === "testPanel") {
      const body = await req.json().catch(() => ({}));
      const panelUrl = String(body.panel_url ?? "").replace(/\/+$/, "");
      const username = String(body.username ?? ""), password = String(body.password ?? "");
      if (!panelUrl || !username || !password) return json({ ok: false, error: "panel_url, username, password обязательны" }, 400);
      try {
        const r = await rawFetch(`${panelUrl}/login`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ username, password }).toString(),
        });
        const text = await r.text();
        if (r.status < 200 || r.status >= 300) return json({ ok: false, error: `HTTP ${r.status}: ${text.slice(0, 200)}` });
        let parsed: any = null; try { parsed = JSON.parse(text); } catch {}
        if (parsed && parsed.success === false) return json({ ok: false, error: parsed.msg ?? "Login refused" });
        const sc = r.headers.get("set-cookie");
        if (!sc && !(parsed && parsed.success)) return json({ ok: false, error: "Панель не вернула сессию" });
        return json({ ok: true });
      } catch (e: any) { return json({ ok: false, error: e?.message ?? String(e) }); }
    }

    if (action === "inbounds") {
      bustPanelsCache();
      const all = getAllPanels(true);
      const result: Record<string, any> = {};
      const meta = all.map((p) => ({ slug: p.slug, name: p.name }));
      await Promise.all(all.map(async (p) => {
        try {
          const list = await listInbounds(p.slug);
          result[p.slug] = list.map((ib) => {
            let clients: any[] = [];
            try { const s = JSON.parse(ib.settings ?? "{}"); clients = (s.clients ?? []).map((c: any) => ({ email: c.email, id: c.id, enable: c.enable !== false })); } catch {}
            return { id: ib.id, remark: ib.remark, protocol: ib.protocol, port: ib.port, enable: ib.enable, clients };
          });
        } catch (e) { result[p.slug] = { error: e instanceof Error ? e.message : String(e) }; }
      }));
      return json({ ...result, _panels: meta });
    }

    if (action === "onlines") {
      const all = getAllPanels();
      const result: any[] = [];
      const errors: Record<string, string> = {};
      const links = rows<any>(`SELECT client_email, subscription_id, remark, panel, inbound_id FROM subscription_inbounds`);
      const subsRows = rows<any>(`SELECT id, name, client_email FROM subscriptions`);
      const mappings = rows<any>(`SELECT panel, client_email, subscription_id, label FROM client_mappings`);
      const emailToInfo = new Map<string, any>();
      links.forEach((l) => { const sub = subsRows.find((s) => s.id === l.subscription_id); emailToInfo.set(l.client_email, { sid: l.subscription_id, name: sub?.name ?? "?", remark: l.remark }); });
      const mapByPE = new Map<string, any>();
      mappings.forEach((m) => { const sub = subsRows.find((s) => s.id === m.subscription_id); mapByPE.set(`${m.panel}::${m.client_email}`, { sid: m.subscription_id, name: sub?.name ?? m.label ?? null }); });
      await Promise.all(all.map(async (p) => {
        try {
          const r = await panelFetch(p.slug, "/panel/api/inbounds/onlines", { method: "POST" });
          const j = JSON.parse(r.body);
          if (!j.success) { errors[p.slug] = j.msg ?? "error"; return; }
          for (const email of (j.obj ?? []) as string[]) {
            const info = emailToInfo.get(email); const manual = mapByPE.get(`${p.slug}::${email}`);
            result.push({ panel: p.slug, email, subscription_id: info?.sid ?? manual?.sid ?? null, sub_name: info?.name ?? manual?.name ?? null, remark: info?.remark ?? null });
          }
        } catch (e) { errors[p.slug] = e instanceof Error ? e.message : String(e); }
      }));
      return json({ onlines: result, errors });
    }

    if (action === "stats") {
      const all = getAllPanels();
      const subs = rows<any>(`SELECT id, name, client_email, created_at FROM subscriptions`);
      const links = rows<any>(`SELECT subscription_id, client_email FROM subscription_inbounds`);
      const usage = new Map<string, { up: number; down: number; total: number }>();
      const panelErrors: Record<string, string> = {};
      const emailToSub = new Map<string, string>();
      links.forEach((l) => { if (l.client_email) emailToSub.set(l.client_email, l.subscription_id); });
      subs.forEach((s) => { if (!emailToSub.has(s.client_email)) emailToSub.set(s.client_email, s.id); });
      await Promise.all(all.map(async (p) => {
        try {
          const m = await getClientTrafficsByEmail(p.slug);
          for (const [email, v] of Object.entries(m)) {
            const sid = emailToSub.get(email); if (!sid) continue;
            const cur = usage.get(sid) ?? { up: 0, down: 0, total: 0 };
            cur.up += v.up; cur.down += v.down; cur.total += v.total;
            usage.set(sid, cur);
          }
        } catch (e) { panelErrors[p.slug] = e instanceof Error ? e.message : String(e); }
      }));
      for (const [sid, v] of usage.entries()) {
        db.query(`INSERT INTO traffic_snapshots (id, subscription_id, used_bytes) VALUES (?, ?, ?)`, [uid(), sid, v.total]);
      }
      const perSub = subs.map((s) => { const u = usage.get(s.id) ?? { up: 0, down: 0, total: 0 }; return { id: s.id, name: s.name, up: u.up, down: u.down, total: u.total }; });
      return json({ perSub, panelErrors });
    }

    if (action === "syncExpiry") {
      const all = getAllPanels();
      const subs = rows<any>(`SELECT id, client_email, expiry_ms FROM subscriptions`);
      const links = rows<any>(`SELECT subscription_id, client_email FROM subscription_inbounds`);
      const emailToSub = new Map<string, string>();
      links.forEach((l) => { if (l.client_email) emailToSub.set(l.client_email, l.subscription_id); });
      subs.forEach((s) => { if (s.client_email && !emailToSub.has(s.client_email)) emailToSub.set(s.client_email, s.id); });
      const subToExpiry = new Map<string, number>();
      const errors: Record<string, string> = {};
      await Promise.all(all.map(async (p) => {
        try {
          const m = await getClientExpiryByEmail(p.slug);
          for (const [email, exp] of Object.entries(m)) {
            const sid = emailToSub.get(email); if (!sid) continue;
            const cur = subToExpiry.get(sid) ?? 0;
            if (exp > 0 && (cur === 0 || exp > cur)) subToExpiry.set(sid, exp);
            else if (cur === 0 && exp === 0) subToExpiry.set(sid, 0);
          }
        } catch (e) { errors[p.slug] = e instanceof Error ? e.message : String(e); }
      }));
      let updated = 0;
      for (const s of subs) {
        const ne = subToExpiry.get(s.id);
        if (ne === undefined) continue;
        if (Number(s.expiry_ms ?? 0) === ne) continue;
        db.query(`UPDATE subscriptions SET expiry_ms = ? WHERE id = ?`, [ne, s.id]);
        updated++;
      }
      return json({ updated, total: subs.length, errors });
    }

    if (action === "create" && req.method === "POST") {
      bustPanelsCache();
      const body = await req.json();
      const name = String(body.name ?? "").trim();
      const days = Number(body.days ?? 30), totalGB = Number(body.totalGB ?? 0);
      const selections: Array<{ panel: string; inboundId: number }> = body.selections ?? [];
      if (!name) return json({ error: "name required" }, 400);
      if (!selections.length) return json({ error: "selections required" }, 400);
      const clientUuid = uuidv4(), slug = randomSlug(12), subIdShort = randomSlug(16);
      const baseEmail = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${slug.slice(0, 6)}`;
      const expiryMs = days > 0 ? Date.now() + days * 86400000 : 0;
      const totalBytes = totalGB > 0 ? Math.floor(totalGB * 1024 * 1024 * 1024) : 0;
      const subId = uid();
      db.query(`INSERT INTO subscriptions (id, slug, name, client_email, client_uuid, expiry_ms, total_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [subId, slug, name, baseEmail, clientUuid, expiryMs, totalBytes]);
      const sub = row<any>(`SELECT * FROM subscriptions WHERE id = ?`, [subId]);
      const created: any[] = [], errors: any[] = [];
      for (const sel of selections) {
        try {
          const cfg = panelCfg(getPanelBySlug(sel.panel));
          const ibs = await listInbounds(sel.panel);
          const ib = ibs.find((x: any) => x.id === sel.inboundId);
          if (!ib) throw new Error(`inbound ${sel.inboundId} not found on ${sel.panel}`);
          let flow = ""; let stream: any = {}; try { stream = JSON.parse(ib.streamSettings); } catch {}
          if (ib.protocol === "vless" && stream.security === "reality") flow = "xtls-rprx-vision";
          const email = `${baseEmail}_${sel.panel}${ib.id}`;
          await addClient(sel.panel, sel.inboundId, { id: clientUuid, email, expiryTime: expiryMs, totalGB: totalBytes, subId: subIdShort, flow });
          db.query(`INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uid(), sub!.id, sel.panel, ib.id, ib.remark ?? `${sel.panel}-${ib.id}`, ib.protocol, ib.port, hostFromUrl(cfg.url), JSON.stringify(stream), email]);
          created.push({ panel: sel.panel, inboundId: ib.id, remark: ib.remark });
        } catch (e) { errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: e instanceof Error ? e.message : String(e) }); }
      }
      if (created.length === 0) {
        db.query(`DELETE FROM subscriptions WHERE id = ?`, [sub!.id]);
        return json({ error: "All inbounds failed", details: errors }, 500);
      }
      return json({ subscription: decodeRow("subscriptions", sub as any), created, errors });
    }

    if (action === "delete" && req.method === "POST") {
      const body = await req.json();
      const subId = String(body.id ?? "");
      if (!subId) return json({ error: "id required" }, 400);
      const sub = row<any>(`SELECT id, client_uuid FROM subscriptions WHERE id = ?`, [subId]);
      if (!sub) return json({ error: "not found" }, 404);
      const links = rows<any>(`SELECT panel, inbound_id FROM subscription_inbounds WHERE subscription_id = ?`, [subId]);
      const errors: any[] = [];
      await Promise.all(links.map(async (l) => {
        try {
          const r = await panelFetch(l.panel, `/panel/api/inbounds/${l.inbound_id}/delClient/${sub.client_uuid}`, { method: "POST" });
          let j: any = {}; try { j = JSON.parse(r.body); } catch {}
          if (!j.success) errors.push({ panel: l.panel, inbound: l.inbound_id, msg: j.msg });
        } catch (e) { errors.push({ panel: l.panel, inbound: l.inbound_id, error: e instanceof Error ? e.message : String(e) }); }
      }));
      db.query(`DELETE FROM subscriptions WHERE id = ?`, [subId]);
      db.query(`DELETE FROM subscription_inbounds WHERE subscription_id = ?`, [subId]);
      return json({ ok: true, errors });
    }

    if (action === "addInbounds" && req.method === "POST") {
      const body = await req.json();
      const subId = String(body.id ?? "");
      const selections: Array<{ panel: string; inboundId: number }> = body.selections ?? [];
      if (!subId || !selections.length) return json({ error: "id and selections required" }, 400);
      const sub = row<any>(`SELECT id, slug, client_uuid, client_email, expiry_ms, total_bytes FROM subscriptions WHERE id = ?`, [subId]);
      if (!sub) return json({ error: "not found" }, 404);
      const existing = new Set(rows<any>(`SELECT panel, inbound_id FROM subscription_inbounds WHERE subscription_id = ?`, [subId]).map((l) => `${l.panel}:${l.inbound_id}`));
      const created: any[] = [], errors: any[] = [];
      const subIdShort = String(sub.slug).slice(0, 16);
      for (const sel of selections) {
        const k = `${sel.panel}:${sel.inboundId}`;
        if (existing.has(k)) { errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: "already added" }); continue; }
        try {
          const cfg = panelCfg(getPanelBySlug(sel.panel));
          const ibs = await listInbounds(sel.panel);
          const ib = ibs.find((x: any) => x.id === sel.inboundId);
          if (!ib) throw new Error(`inbound ${sel.inboundId} not found on ${sel.panel}`);
          let flow = ""; let stream: any = {}; try { stream = JSON.parse(ib.streamSettings); } catch {}
          if (ib.protocol === "vless" && stream.security === "reality") flow = "xtls-rprx-vision";
          const email = `${sub.client_email}_${sel.panel}${ib.id}`;
          await addClient(sel.panel, sel.inboundId, { id: sub.client_uuid, email, expiryTime: sub.expiry_ms, totalGB: sub.total_bytes, subId: subIdShort, flow });
          db.query(`INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uid(), sub.id, sel.panel, ib.id, ib.remark ?? `${sel.panel}-${ib.id}`, ib.protocol, ib.port, hostFromUrl(cfg.url), JSON.stringify(stream), email]);
          created.push({ panel: sel.panel, inboundId: ib.id, remark: ib.remark });
        } catch (e) { errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: e instanceof Error ? e.message : String(e) }); }
      }
      return json({ created, errors });
    }

    if (action === "removeInbound" && req.method === "POST") {
      const body = await req.json();
      const subId = String(body.id ?? ""), panel = String(body.panel ?? ""), inboundId = Number(body.inboundId);
      if (!subId || !panel || !inboundId) return json({ error: "id, panel, inboundId required" }, 400);
      const sub = row<any>(`SELECT id, client_uuid FROM subscriptions WHERE id = ?`, [subId]);
      if (!sub) return json({ error: "not found" }, 404);
      let panelErr: string | null = null;
      try {
        const r = await panelFetch(panel, `/panel/api/inbounds/${inboundId}/delClient/${sub.client_uuid}`, { method: "POST" });
        let j: any = {}; try { j = JSON.parse(r.body); } catch {}
        if (!j.success) panelErr = j.msg ?? "panel error";
      } catch (e) { panelErr = e instanceof Error ? e.message : String(e); }
      db.query(`DELETE FROM subscription_inbounds WHERE subscription_id = ? AND panel = ? AND inbound_id = ?`, [subId, panel, inboundId]);
      return json({ ok: true, panelError: panelErr });
    }

    if (action === "update" && req.method === "POST") {
      const body = await req.json();
      const subId = String(body.id ?? "");
      if (!subId) return json({ error: "id required" }, 400);
      const sub = row<any>(`SELECT id, slug, name, client_uuid, client_email, expiry_ms, total_bytes FROM subscriptions WHERE id = ?`, [subId]);
      if (!sub) return json({ error: "not found" }, 404);
      const newName = typeof body.name === "string" ? body.name.trim() : undefined;
      const hasDays = body.days !== undefined && body.days !== null && body.days !== "";
      const hasGB = body.totalGB !== undefined && body.totalGB !== null && body.totalGB !== "";
      const days = hasDays ? Number(body.days) : null;
      const totalGB = hasGB ? Number(body.totalGB) : null;
      const newExpiry = hasDays ? (days! > 0 ? Date.now() + days! * 86400000 : 0) : sub.expiry_ms;
      const newTotal = hasGB ? (totalGB! > 0 ? Math.floor(totalGB! * 1024 * 1024 * 1024) : 0) : sub.total_bytes;
      const errors: any[] = [];
      if (hasDays || hasGB) {
        const links = rows<any>(`SELECT panel, inbound_id, protocol, stream_settings, client_email FROM subscription_inbounds WHERE subscription_id = ?`, [subId]);
        const subIdShort = String(sub.slug).slice(0, 16);
        for (const l of links) {
          try {
            let stream: any = {}; try { stream = JSON.parse(l.stream_settings); } catch {}
            let flow = ""; if (l.protocol === "vless" && stream.security === "reality") flow = "xtls-rprx-vision";
            await updateClient(l.panel, l.inbound_id, { id: sub.client_uuid, email: l.client_email ?? sub.client_email, expiryTime: newExpiry, totalGB: newTotal, subId: subIdShort, flow });
          } catch (e) { errors.push({ panel: l.panel, inbound: l.inbound_id, error: e instanceof Error ? e.message : String(e) }); }
        }
      }
      const sets: string[] = [], args: unknown[] = [];
      if (newName !== undefined && newName.length > 0) { sets.push("name = ?"); args.push(newName); }
      if (hasDays) { sets.push("expiry_ms = ?"); args.push(newExpiry); }
      if (hasGB) { sets.push("total_bytes = ?"); args.push(newTotal); }
      const subs = rows<any>(`SELECT id, client_uuid FROM subscriptions WHERE id IN (${placeholders})`, subIds as any);
      return json({ ok: true, errors });
    }

    if (action === "bulkAddInbound" && req.method === "POST") {
      const body = await req.json();
      const panel = String(body.panel ?? ""), inboundId = Number(body.inboundId);
      if (!panel || !inboundId) return json({ error: "panel, inboundId required" }, 400);
      const allSubs = rows<any>(`SELECT id, slug, client_uuid, client_email, expiry_ms, total_bytes FROM subscriptions`);
      const have = new Set(rows<any>(`SELECT subscription_id FROM subscription_inbounds WHERE panel = ? AND inbound_id = ?`, [panel, inboundId]).map((l) => l.subscription_id));
      const cfg = panelCfg(getPanelBySlug(panel));
      const ibs = await listInbounds(panel);
      const ib = ibs.find((x: any) => x.id === inboundId);
      if (!ib) return json({ error: "inbound not found" }, 404);
      let stream: any = {}; try { stream = JSON.parse(ib.streamSettings); } catch {}
      const flow = ib.protocol === "vless" && stream.security === "reality" ? "xtls-rprx-vision" : "";
      const created: string[] = [], errors: any[] = [];
      const targets = allSubs.filter((s) => !have.has(s.id));
      await Promise.all(targets.map(async (sub) => {
        try {
          const email = `${sub.client_email}_${panel}${ib.id}`;
          await addClient(panel, inboundId, { id: sub.client_uuid, email, expiryTime: sub.expiry_ms, totalGB: sub.total_bytes, subId: String(sub.slug).slice(0, 16), flow });
          db.query(`INSERT INTO subscription_inbounds (id, subscription_id, panel, inbound_id, remark, protocol, port, host, stream_settings, client_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uid(), sub.id, panel, ib.id, ib.remark ?? `${panel}-${ib.id}`, ib.protocol, ib.port, hostFromUrl(cfg.url), JSON.stringify(stream), email]);
          created.push(sub.id);
        } catch (e) { errors.push({ sub: sub.id, error: e instanceof Error ? e.message : String(e) }); }
      }));
      return json({ created: created.length, errors });
    }

    if (action === "bulkRemoveInbound" && req.method === "POST") {
      const body = await req.json();
      const panel = String(body.panel ?? ""), inboundId = Number(body.inboundId);
      if (!panel || !inboundId) return json({ error: "panel, inboundId required" }, 400);
      const subIds = rows<any>(`SELECT subscription_id FROM subscription_inbounds WHERE panel = ? AND inbound_id = ?`, [panel, inboundId]).map((l) => l.subscription_id);
      if (!subIds.length) return json({ removed: 0, errors: [] });
      const placeholders = subIds.map(() => "?").join(",");
      const subs = rows<any>(`SELECT id, client_uuid FROM subscriptions WHERE id IN (${placeholders})`, subIds);
      const errors: any[] = []; let removed = 0;
      await Promise.all(subs.map(async (s) => {
        try {
          await panelFetch(panel, `/panel/api/inbounds/${inboundId}/delClient/${s.client_uuid}`, { method: "POST" });
          removed++;
        } catch (e) { errors.push({ sub: s.id, error: e instanceof Error ? e.message : String(e) }); }
      }));
      db.query(`DELETE FROM subscription_inbounds WHERE panel = ? AND inbound_id = ?`, [panel, inboundId]);
      return json({ removed, errors });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
}