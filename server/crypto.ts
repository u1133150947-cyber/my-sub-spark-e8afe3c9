// AES-GCM encryption for sensitive panel fields (password, ssh_password, ssh_key_passphrase).
// Set MASTER_KEY in .env to enable — without it, fields are stored as plaintext (backward compat).
// Encrypted values are prefixed with "enc1:" so legacy plaintext is transparently handled.
//
// Key derivation: PBKDF2-SHA256, 100 000 iterations, fixed salt scoped to this app.
// This means even a short MASTER_KEY (e.g. "secret") produces a full-strength 256-bit key.
// The salt is not secret — its job is to scope the key to this app and prevent
// cross-app key reuse, not to add entropy.

const MASTER_KEY_RAW = Deno.env.get("MASTER_KEY")?.trim() ?? "";
const MARKER = "enc1:";
// Fixed, app-specific salt — not secret, just domain-separation.
const KDF_SALT = new TextEncoder().encode("sub-manager:panel-field-encryption:v1");

let _key: CryptoKey | null = null;
let _keyInit = false;

async function getKey(): Promise<CryptoKey | null> {
  if (_keyInit) return _key;
  _keyInit = true;
  if (!MASTER_KEY_RAW) {
    console.warn(
      "[crypto] MASTER_KEY not set — panel passwords stored in plaintext. " +
      "Add MASTER_KEY=<any-passphrase> to .env to enable at-rest encryption.",
    );
    return null;
  }

  // Import raw passphrase as a PBKDF2 base key.
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MASTER_KEY_RAW),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  // Derive a 256-bit AES-GCM key with 100 000 PBKDF2-SHA256 iterations.
  _key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: KDF_SALT, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  console.log("[crypto] MASTER_KEY loaded (PBKDF2-SHA256) — panel passwords will be encrypted at rest");
  return _key;
}

export async function encryptField(plain: string): Promise<string> {
  if (!plain || plain.startsWith(MARKER)) return plain; // already encrypted or empty
  const key = await getKey();
  if (!key) return plain; // no key configured
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  const combined = new Uint8Array(12 + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), 12);
  return MARKER + btoa(String.fromCharCode(...combined));
}

export async function decryptField(stored: string): Promise<string> {
  if (!stored?.startsWith(MARKER)) return stored ?? ""; // plaintext / legacy
  const key = await getKey();
  if (!key) {
    console.error("[crypto] MASTER_KEY not set but found encrypted field — cannot decrypt");
    return "";
  }
  try {
    const bytes = Uint8Array.from(atob(stored.slice(MARKER.length)), (c) => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12),
    );
    return new TextDecoder().decode(plain);
  } catch (e) {
    console.error("[crypto] decryptField failed:", e instanceof Error ? e.message : e);
    return "";
  }
}

// Columns in the panels table that must be encrypted at rest.
export const PANEL_SENSITIVE_COLS = ["password", "ssh_password", "ssh_key_passphrase"] as const;
