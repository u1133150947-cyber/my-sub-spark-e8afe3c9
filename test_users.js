import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: inboundsData, error: errInbounds } = await supabase.functions.invoke("panel?action=inbounds", { method: "GET" });
  if (errInbounds) { console.error("inbounds err", errInbounds); return; }
  
  const panels = inboundsData._panels || [];
  let selections = [];
  for (const pm of panels) {
     const ibs = inboundsData[pm.slug];
     if (Array.isArray(ibs) && ibs.length > 0) {
        // take one inbound from each panel just to test
        selections.push({ panel: pm.slug, inboundId: ibs[0].id });
     }
  }

  if (selections.length === 0) {
    console.log("No inbounds found");
    return;
  }

  console.log("Using selections:", selections);

  for (let i = 1; i <= 10; i++) {
    const { data, error } = await supabase.functions.invoke("panel?action=create", {
      method: "POST",
      body: { name: `TestUser_${i}_${Date.now()}`, days: 30, totalGB: 10, selections }
    });
    if (error || data?.error) {
      console.error(`Error creating user ${i}:`, error?.message || data?.error);
    } else {
      console.log(`Created user ${i} on ${data.created?.length || 0} servers.`);
    }
  }
}

run();
