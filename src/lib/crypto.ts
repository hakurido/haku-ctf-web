import crypto from "crypto";

const SECRET = process.env.CTF_SECRET_KEY || "haku_agentgate_sovereign_cyberpunk_secret_2026_x77";

export interface SessionTokenData {
  gate: number;
  issuedAt: number;
  expiresAt: number;
  payload: any;
}

export function createSignedToken(gate: number, ttlSeconds: number, payload: any): string {
  const now = Math.floor(Date.now() / 1000);
  const data: SessionTokenData = {
    gate,
    issuedAt: now,
    expiresAt: now + ttlSeconds,
    payload,
  };
  const jsonStr = JSON.stringify(data);
  const b64 = Buffer.from(jsonStr).toString("base64url");
  const hmac = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${hmac}`;
}

export function verifySignedToken(tokenString: string, expectedGate: number): { valid: boolean; error?: string; data?: SessionTokenData } {
  if (!tokenString || !tokenString.includes(".")) {
    return { valid: false, error: "Malformed session token format." };
  }
  const [b64, hmac] = tokenString.split(".");
  const expectedHmac = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  
  if (hmac !== expectedHmac) {
    return { valid: false, error: "Invalid signature / token forgery detected." };
  }

  try {
    const raw = Buffer.from(b64, "base64url").toString("utf-8");
    const parsed: SessionTokenData = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);

    if (parsed.gate !== expectedGate) {
      return { valid: false, error: `Token gate mismatch. Expected Gate ${expectedGate}, got Gate ${parsed.gate}.` };
    }

    if (now > parsed.expiresAt) {
      const diff = now - parsed.expiresAt;
      return { valid: false, error: `Challenge expired ${diff}s ago! AI Agent response was too slow.` };
    }

    return { valid: true, data: parsed };
  } catch (err: any) {
    return { valid: false, error: "Failed to deserialize challenge state payload." };
  }
}

export function generateProofOfSolve(agentName: string, gatesSolved: number[]): string {
  const payload = {
    agentName,
    gatesSolved,
    timestamp: Date.now(),
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", SECRET).update(b64).digest("hex").slice(0, 16);
  return `HAKU{AGENT_${agentName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_GATES_${gatesSolved.sort().join("")}_VERIFIED_${hmac}}`;
}
