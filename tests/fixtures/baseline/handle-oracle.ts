// Oracle for the server's agent-handle cleanup (Property 4, K07).
//
// The expression below is copied verbatim from
// `git show c6d13ea:src/app/api/scoreboard/route.ts` (the `agentKey` line in
// POST). tests/preserve/oracles.test.ts proves that HANDLE_CLEANUP_EXPRESSION
// appears in that file and in this function's own source text.

/** Repo path and ref the cleanup expression is copied from. */
export const HANDLE_ORACLE_SOURCE = Object.freeze({ ref: "c6d13ea", path: "src/app/api/scoreboard/route.ts" });

/** The cleanup expression, character for character as it appears in route.ts. */
export const HANDLE_CLEANUP_EXPRESSION = 'String(agentName).trim().replace(/[^a-zA-Z0-9_\\-\\.]/g, "").slice(0, 24)';

/** The handle the server records for `agentName` ("" means the server answers 400). */
export function serverCleanHandle(agentName: string): string {
  return String(agentName).trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, 24);
}

/**
 * Property 4's acceptance condition: the server records the trimmed input
 * unchanged and non-empty.
 */
export function serverKeepsHandle(raw: string): boolean {
  const clean = serverCleanHandle(raw);
  return clean === raw.trim() && clean !== "";
}

/** The equivalent closed form from the design: the trimmed handle matches this. */
export const ACCEPTED_HANDLE = /^[A-Za-z0-9_.-]{1,24}$/;
