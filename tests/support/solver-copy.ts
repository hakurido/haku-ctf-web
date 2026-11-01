// Runs the reference solver safely.
//
// The committed test_agent_solver.py targets production
// (BASE = "https://ctf.hakudigital.tech"). It is never executed. These helpers
// copy it to %TEMP%, rewrite only the BASE line to a localhost origin, assert
// that exactly that one line differs and that the copy names no remote host,
// then spawn `python <copy>` with PYTHONUTF8=1.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "./source.ts";
import { assertLocalUrl, waitForServer } from "./server.ts";

/** Absolute path of the committed solver. Read-only for tests. */
export const SOLVER_SOURCE: string = join(REPO_ROOT, "test_agent_solver.py");

/** Matches the solver's BASE assignment line. */
const BASE_LINE = /^BASE\s*=\s*(["'])([^"']*)\1\s*$/;

export interface SolverCopy {
  /** Absolute path of the temporary copy. */
  path: string;
  /** Temporary directory that holds the copy. */
  dir: string;
  /** Localhost origin written into the copy, e.g. http://localhost:3103. */
  baseUrl: string;
  /** 0-based index of the rewritten line. */
  lineIndex: number;
  /** The original BASE line, e.g. BASE = "https://ctf.hakudigital.tech". */
  originalLine: string;
  /** The rewritten BASE line, e.g. BASE = "http://localhost:3103". */
  rewrittenLine: string;
  /** Deletes the temporary directory. */
  cleanup(): void;
}

function splitLines(text: string): string[] {
  return text.split(/(?<=\n)/);
}

function stripEol(line: string): string {
  return line.replace(/\r?\n$/, "");
}

/**
 * Pure rewrite step: returns the solver text with only the BASE line changed.
 * Throws unless the source has exactly one BASE line, the result differs in
 * exactly that line, and the result mentions no non-local host.
 */
export function rewriteSolverBase(source: string, baseUrl: string): { text: string; lineIndex: number; originalLine: string; rewrittenLine: string } {
  const origin = assertLocalUrl(baseUrl).origin;
  const lines = splitLines(source);
  const hits = lines.map((l, i) => (BASE_LINE.test(stripEol(l)) ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) {
    throw new Error(`Expected exactly one BASE = "..." line in test_agent_solver.py, found ${hits.length}`);
  }
  const idx = hits[0];
  const originalLine = stripEol(lines[idx]);
  const eol = lines[idx].slice(originalLine.length);
  const rewrittenLine = `BASE = "${origin}"`;
  const out = lines.slice();
  out[idx] = rewrittenLine + eol;
  const text = out.join("");

  // Verify: same line count, exactly one differing line, and it is the BASE line.
  const a = splitLines(source);
  const b = splitLines(text);
  if (a.length !== b.length) throw new Error("Solver copy has a different line count than the original");
  const diffs = a.map((l, i) => (l === b[i] ? -1 : i)).filter((i) => i >= 0);
  if (diffs.length !== 1 || diffs[0] !== idx) {
    throw new Error(`Solver copy must differ from the original in exactly the BASE line; differing lines: ${JSON.stringify(diffs)}`);
  }
  // Verify: no remote target remains anywhere in the copy.
  if (/hakudigital/i.test(text)) throw new Error("Solver copy still mentions hakudigital; refusing to run it");
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)]+/g)) {
    if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(m[0])) {
      throw new Error(`Solver copy contains a non-localhost URL ${m[0]}; refusing to run it`);
    }
  }
  return { text, lineIndex: idx, originalLine, rewrittenLine };
}

/**
 * Copies test_agent_solver.py to a fresh %TEMP% directory with only the BASE
 * line set to `baseUrl` (must be localhost). The committed file is only read.
 */
export function prepareSolverCopy(baseUrl: string): SolverCopy {
  const source = readFileSync(SOLVER_SOURCE, "utf8");
  const r = rewriteSolverBase(source, baseUrl);
  const dir = mkdtempSync(join(tmpdir(), "agentgate-solver-"));
  const path = join(dir, "test_agent_solver.py");
  writeFileSync(path, r.text, "utf8");
  // Re-read from disk and re-check before anything runs it.
  const written = readFileSync(path, "utf8");
  if (written !== r.text) throw new Error("Solver copy on disk does not match the rewritten text");
  return {
    path,
    dir,
    baseUrl: assertLocalUrl(baseUrl).origin,
    lineIndex: r.lineIndex,
    originalLine: r.originalLine,
    rewrittenLine: r.rewrittenLine,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export interface SolverRun {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
  /** stdout decoded as UTF-8, CRLF normalized to LF. */
  stdout: string;
  stderr: string;
  /** The copy that ran (already deleted unless keepCopy). */
  copy: Omit<SolverCopy, "cleanup">;
}

export interface RunSolverOptions {
  /** Kill the solver after this many ms. Default 90000. */
  timeoutMs?: number;
  /** Python executable. Default process.env.PYTHON or "python". */
  python?: string;
  /** Keep the temporary copy for inspection. Default false. */
  keepCopy?: boolean;
}

/**
 * Prepares the copy for `baseUrl`, checks that the server answers
 * GET /skill.md, then runs `python <copy>` with PYTHONUTF8=1 and a timeout.
 * Run it first after a server starts: it uses the solver's own IP
 * 198.18.99.1 and registers the handle JABRIK on the (local) scoreboard.
 */
export async function runSolverCopy(baseUrl: string, options: RunSolverOptions = {}): Promise<SolverRun> {
  const origin = assertLocalUrl(baseUrl).origin;
  await waitForServer(origin, 30_000);
  const copy = prepareSolverCopy(origin);
  const timeoutMs = options.timeoutMs ?? 90_000;
  const python = options.python ?? process.env.PYTHON ?? "python";
  const started = Date.now();
  try {
    return await new Promise<SolverRun>((resolve, reject) => {
      const child = spawn(python, [copy.path], {
        cwd: copy.dir,
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          PYTHONUNBUFFERED: "1",
          NO_PROXY: "localhost,127.0.0.1,::1",
          no_proxy: "localhost,127.0.0.1,::1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      child.stdout.on("data", (c: Buffer) => out.push(c));
      child.stderr.on("data", (c: Buffer) => err.push(c));
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
      child.once("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`Could not start ${python}: ${e.message}`));
      });
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        const info = {
          path: copy.path,
          dir: copy.dir,
          baseUrl: copy.baseUrl,
          lineIndex: copy.lineIndex,
          originalLine: copy.originalLine,
          rewrittenLine: copy.rewrittenLine,
        };
        resolve({
          exitCode: code,
          signal,
          timedOut,
          durationMs: Date.now() - started,
          stdout: Buffer.concat(out).toString("utf8").replace(/\r\n/g, "\n"),
          stderr: Buffer.concat(err).toString("utf8").replace(/\r\n/g, "\n"),
          copy: info,
        });
      });
    });
  } finally {
    if (!options.keepCopy) copy.cleanup();
  }
}

export interface SolverFacts {
  /** "Flag 1" to "Flag 4" values in order ("None" becomes null). */
  flags: (string | null)[];
  /** "Scoreboard G<n>: <message>" lines. */
  scoreboard: { gate: number; message: string }[];
  /** "PROOF BADGE: <value>", or null. */
  proofBadge: string | null;
}

/** Extracts the pass-criteria facts from solver stdout. */
export function parseSolverOutput(stdout: string): SolverFacts {
  const text = stdout.replace(/\r\n/g, "\n");
  const flags: (string | null)[] = [];
  for (let n = 1; n <= 4; n++) {
    const m = new RegExp(`^Flag ${n}: (.*)$`, "m").exec(text);
    const v = m ? m[1].trim() : null;
    flags.push(v && v !== "None" ? v : null);
  }
  const scoreboard = [...text.matchAll(/^Scoreboard G(\d): (.*)$/gm)].map((m) => ({ gate: Number(m[1]), message: m[2].trim() }));
  const badge = /PROOF BADGE: (.*)$/m.exec(text);
  return { flags, scoreboard, proofBadge: badge ? badge[1].trim() || null : null };
}

/**
 * Normalizes solver stdout for the solver.txt fixture: replaces the mined nonce
 * and hash, timings, the recovered seed, predictions, the Gate 4 key, and the
 * badge suffix with placeholders. Flags and server messages stay verbatim.
 */
export function normalizeSolverOutput(stdout: string): string {
  return stdout
    .replace(/\r\n/g, "\n")
    .replace(/nonce=\d+, hash=[0-9a-f]+/g, "nonce=<NONCE>, hash=<HASH>")
    .replace(/\[nonce:\d+\]/g, "[nonce:<NONCE>]")
    .replace(/\b\d+\.\d+s\b/g, "<T>s")
    .replace(/(seed in <T>s: )\d+/g, "$1<SEED>")
    .replace(/^(Predictions \(top 48-bit states\): ).*$/gm, "$1<PREDICTIONS>")
    .replace(/(recovered 8-byte key in <T>s: )[0-9a-f]+/g, "$1<KEY>")
    .replace(/(PROOF BADGE: ).*$/gm, "$1<BADGE>")
    .replace(/\s+$/, "\n");
}
