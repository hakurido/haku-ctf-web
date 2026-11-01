export function formatPoints(n: number): string {
  return n.toLocaleString("en-US");
}

/** Local time as HH:MM:SS, for "Loaded at" lines. */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toTimeString().split(" ")[0];
}

/** Status label for a server error: "Rate limited (HTTP 429)" or "Error (HTTP {status})" (R-25, R-36). */
export function serverErrorLabel(error: { status: number } | null): string {
  if (!error) return "Error";
  return error.status === 429 ? "Rate limited (HTTP 429)" : `Error (HTTP ${error.status})`;
}

export function formatResponseJson(v: unknown): string {
  return JSON.stringify(v, null, 2);
}
