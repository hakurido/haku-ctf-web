import crypto from "crypto";

const SECRET = process.env.CTF_SECRET_KEY || "haku_agentgate_sovereign_cyberpunk_secret_2026_x77";

export interface SessionTokenData {
  gate: number;
  issuedAt: number;
  expiresAt: number;
  payload: any;
  /** One-time-use nonce; cleared server-side after a successful submit (R-09). */
  jti?: string;
  /** Speedrun run this token is bound to. */
  runId?: string;
}

/** Issued one-time tokens for challenges. Cleared on first verified submission. */
const issuedJti = new Set<string>();

export function createSignedToken(
  gate: number,
  ttlSeconds: number,
  payload: any,
  opts?: { runId?: string; singleUse?: boolean }
): string {
  const now = Math.floor(Date.now() / 1000);
  const jti = opts?.singleUse ? crypto.randomBytes(8).toString("hex") : undefined;
  if (jti) issuedJti.add(jti);
  const data: SessionTokenData = {
    gate,
    issuedAt: now,
    expiresAt: now + ttlSeconds,
    payload,
    jti,
    runId: opts?.runId,
  };
  const jsonStr = JSON.stringify(data);
  const b64 = Buffer.from(jsonStr).toString("base64url");
  const hmac = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${hmac}`;
}

/** Marks a token as consumed. Returns false when it was already used (replay). */
export function consumeJti(jti: string | undefined): boolean {
  if (!jti) return true; // Tokens without jti are not single-use.
  if (!issuedJti.has(jti)) return false;
  issuedJti.delete(jti);
  return true;
}

export function verifySignedToken(
  tokenString: string,
  expectedGate: number,
  opts?: { runId?: string; consume?: boolean }
): { valid: boolean; error?: string; data?: SessionTokenData } {
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

    // Run binding: a token minted inside a run cannot be replayed after that run expires (R-11).
    if (opts?.runId && parsed.runId && opts.runId !== parsed.runId) {
      return { valid: false, error: "Session token belongs to a different speedrun run." };
    }

    // Single-use enforcement (R-09): a submit token is consumed on first use.
    if (opts?.consume && parsed.jti && !consumeJti(parsed.jti)) {
      return { valid: false, error: "Replay detected: this instance token was already consumed." };
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
