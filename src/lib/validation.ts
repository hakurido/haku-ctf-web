export const HANDLE_MAX_LENGTH = 24;

/** Mirrors src/app/api/scoreboard/route.ts exactly. */
export function cleanHandle(raw: string): string {
  return String(raw).trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, 24);
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
  | { ok: true; value: any }
  | { ok: false; message: typeof GATE3_MALFORMED_MESSAGE };

export function parseGate3Assignment(text: string): AssignmentParse {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: false, message: GATE3_MALFORMED_MESSAGE };
  }
  try {
    const parsed = JSON.parse(trimmed);
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: GATE3_MALFORMED_MESSAGE };
  }
}
