import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("subscription edit server regressions", () => {
  it("defines baseEmail before adding standalone Hysteria inbounds locally", () => {
    const source = readFileSync("server/panel.ts", "utf8");
    const addInbounds = source.slice(source.indexOf('if (action === "addInbounds"'));
    const baseEmailIndex = addInbounds.indexOf("const baseEmail");
    const standaloneEmailIndex = addInbounds.indexOf("${baseEmail}_standalone");

    expect(baseEmailIndex).toBeGreaterThan(-1);
    expect(standaloneEmailIndex).toBeGreaterThan(baseEmailIndex);
  });

  it("keeps standalone Hysteria add/remove server-side only", () => {
    const source = readFileSync("supabase/functions/panel/index.ts", "utf8");

    expect(source).toContain('sel.panel === "standalone"');
    expect(source).toContain('panel: "standalone"');
    expect(source).toContain('protocol: "hysteria2"');
    expect(source).toContain('if (panel !== "standalone")');
  });
});
