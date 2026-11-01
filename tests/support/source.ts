// Repository and git helpers for source-level tests.
//
// Paths passed to and returned from these helpers are repo-relative with
// forward slashes, for example "src/lib/gates.ts".

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Absolute path of the repository root (two levels above tests/support). */
export const REPO_ROOT: string = join(import.meta.dirname, "..", "..");

/** F_bug: the single-page UI before the overhaul. Source of the moved-logic oracles. */
export const REF_BUG = "afe2537";
/** F_api: HEAD at the start of the tasks phase (HELL mode). Baseline for the agent surface. */
export const REF_API = "c6d13ea";

/**
 * The frozen set Z. These paths stay byte-identical to c6d13ea and are never
 * edited. Directories end without a slash; `isFrozen` treats them as prefixes.
 */
export const FROZEN_PATHS: readonly string[] = Object.freeze([
  "src/app/api",
  "src/lib/challenges.ts",
  "src/lib/crypto.ts",
  "src/lib/ratelimit.ts",
  "public/skill.md",
  "test_agent_solver.py",
]);

export interface GitResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function toPosix(p: string): string {
  return p.split(sep).join("/").replace(/\\/g, "/");
}

function normalizeRepoPath(path: string): string {
  const posix = toPosix(path).replace(/^\.\//, "");
  if (posix.startsWith("/") || /^[A-Za-z]:/.test(posix) || posix.split("/").includes("..")) {
    throw new Error(`Expected a repo-relative path without "..", got ${JSON.stringify(path)}`);
  }
  return posix;
}

/** True when `path` (repo-relative) is in the frozen set Z. */
export function isFrozen(path: string): boolean {
  const p = normalizeRepoPath(path);
  return FROZEN_PATHS.some((z) => p === z || p.startsWith(`${z}/`));
}

/** Runs git in the repo root and never throws. Output is decoded as UTF-8. */
export function git(args: readonly string[]): GitResult {
  const r = spawnSync("git", ["-C", REPO_ROOT, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** `git show <ref>:<path>` as raw bytes (the blob as stored, LF line endings). Throws if missing. */
export function gitShowBuffer(ref: string, path: string): Buffer {
  const p = normalizeRepoPath(path);
  try {
    return execFileSync("git", ["-C", REPO_ROOT, "show", `${ref}:${p}`], {
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString("utf8").trim();
    throw new Error(`git show ${ref}:${p} failed${stderr ? `: ${stderr}` : ""}`);
  }
}

/** `git show <ref>:<path>` decoded as UTF-8. */
export function gitShow(ref: string, path: string): string {
  return gitShowBuffer(ref, path).toString("utf8");
}

/** `git show afe2537:<path>` (F_bug). */
export function showBug(path: string): string {
  return gitShow(REF_BUG, path);
}

/** `git show c6d13ea:<path>` (F_api). */
export function showApi(path: string): string {
  return gitShow(REF_API, path);
}

/** True when `<ref>:<path>` exists in git. */
export function existsAt(ref: string, path: string): boolean {
  const p = normalizeRepoPath(path);
  return git(["cat-file", "-e", `${ref}:${p}`]).status === 0;
}

/** Files tracked at `ref` under `dir` (recursive), repo-relative. */
export function listFilesAt(ref: string, dir: string): string[] {
  const d = normalizeRepoPath(dir);
  const r = git(["ls-tree", "-r", "--name-only", ref, "--", d]);
  if (r.status !== 0) throw new Error(`git ls-tree ${ref} -- ${d} failed: ${r.stderr.trim()}`);
  return r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** Absolute path for a repo-relative path. */
export function repoPath(path: string): string {
  return join(REPO_ROOT, ...normalizeRepoPath(path).split("/"));
}

/** Working-tree file as raw bytes. */
export function readRepoBuffer(path: string): Buffer {
  return readFileSync(repoPath(path));
}

/** Working-tree file as UTF-8 text. */
export function readRepoFile(path: string): string {
  return readRepoBuffer(path).toString("utf8");
}

/** True when the working-tree file exists. */
export function repoFileExists(path: string): boolean {
  return existsSync(repoPath(path));
}

/** Parsed package.json from the working tree. */
export function readPackageJson(): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
} {
  return JSON.parse(readRepoFile("package.json"));
}

/** Every working-tree file under `dir` (recursive, skips node_modules and dot-directories). */
export function listWorkingFiles(dir: string): string[] {
  const root = repoPath(dir);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (abs: string): void => {
    for (const name of readdirSync(abs)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const child = join(abs, name);
      if (statSync(child).isDirectory()) walk(child);
      else out.push(toPosix(relative(REPO_ROOT, child)));
    }
  };
  walk(root);
  return out.sort();
}

/**
 * UI code U: every working-tree file under src/ that is not in the frozen set Z.
 * Includes untracked files, so new F' modules are covered before they are committed.
 * `extensions` filters by suffix, for example [".tsx"] or [".ts", ".tsx", ".css"].
 */
export function listUiFiles(options: { extensions?: readonly string[] } = {}): string[] {
  const exts = options.extensions;
  return listWorkingFiles("src").filter(
    (p) => !isFrozen(p) && (!exts || exts.some((e) => p.endsWith(e))),
  );
}

/**
 * The frozen-file check from the safety rules:
 * `git diff --exit-code c6d13ea -- <Z>` must exit 0 and
 * `git status --porcelain -- <Z>` must print nothing.
 */
export function frozenFileCheck(): { clean: boolean; diffExit: number | null; diff: string; status: string } {
  const diff = git(["diff", "--exit-code", REF_API, "--", ...FROZEN_PATHS]);
  const status = git(["status", "--porcelain", "--", ...FROZEN_PATHS]);
  return {
    clean: diff.status === 0 && status.stdout.trim() === "",
    diffExit: diff.status,
    diff: diff.stdout,
    status: status.stdout,
  };
}
