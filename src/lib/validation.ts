import type { JsonValue } from "./api.ts";

/** The longest agent handle the scoreboard records. */
export const HANDLE_MAX_LENGTH = 24;

/** Mirrors the agentKey cleanup in src/app/api/scoreboard/route.ts exactly. */
export function cleanHandle(raw: string): string {
  return String(raw).trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, HANDLE_MAX_LENGTH);
}

export type HandleCheck =
  | { ok: true }
  | { ok: false; reason: "required" }
  | { ok: false; reason: "format"; recordedAs: string };

export function checkHandle(raw: string): HandleCheck {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, reason: "required" };
  }
  const cleaned = cleanHandle(raw);
  if (cleaned !== trimmed) {
    return { ok: false, reason: "format", recordedAs: cleaned };
  }
  return { ok: true };
}

export const GATE3_MALFORMED_MESSAGE = "Malformed assignment array. Expected valid JSON format.";

export type AssignmentParse =
  | { ok: true; value: JsonValue }
  | { ok: false; message: typeof GATE3_MALFORMED_MESSAGE };

export function parseGate3Assignment(text: string): AssignmentParse {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: false, message: GATE3_MALFORMED_MESSAGE };
  }
  try {
    // Anything JSON.parse returns is a JsonValue.
    const parsed = JSON.parse(trimmed) as JsonValue;
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: GATE3_MALFORMED_MESSAGE };
  }
}
