// Server-under-test helpers: BASE_URL, localhost guard, `next start` lifecycle,
// and probe-IP fetches that set `cf-connecting-ip`.
//
// Safety: every URL these helpers touch must be http://localhost, 127.0.0.1, or
// [::1]. Anything else (in particular ctf.hakudigital.tech) throws before a
// request is made.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import { REPO_ROOT } from "./source.ts";

// ---------------------------------------------------------------------------
// Localhost guard
// ---------------------------------------------------------------------------

const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** True when `input` is an http(s) URL whose host is localhost, 127.0.0.1, or [::1]. */
export function isLocalUrl(input: string | URL): boolean {
  let url: URL;
  try {
    url = new URL(String(input));
  } catch {
    return false;
  }
  return (url.protocol === "http:" || url.protocol === "https:") && LOCAL_HOSTNAMES.has(url.hostname);
}

/** Parses `input` and throws unless it is a localhost URL. Returns the parsed URL. */
export function assertLocalUrl(input: string | URL): URL {
  if (!isLocalUrl(input)) {
    throw new Error(
      `Refusing non-localhost target ${JSON.stringify(String(input))}. ` +
        "Tests may only send requests to http://localhost:<port> (never ctf.hakudigital.tech).",
    );
  }
  return new URL(String(input));
}

// ---------------------------------------------------------------------------
// BASE_URL
// ---------------------------------------------------------------------------

/** Port of the shared server under test (Wave 5/6 run `next start -p 3008`). */
export const DEFAULT_PORT = 3008;

/**
 * Origin of the shared server under test: `process.env.BASE_URL`, default
 * http://localhost:3008. Throws at import time if BASE_URL is not localhost.
 * Tests that start their own server should use `handle.baseUrl` instead.
 */
export const BASE_URL: string = assertLocalUrl(process.env.BASE_URL ?? `http://localhost:${DEFAULT_PORT}`).origin;

/** Builds an absolute localhost URL from a path ("/api/skill") or absolute URL. */
export function toLocalUrl(pathOrUrl: string, baseUrl: string = BASE_URL): URL {
  const base = assertLocalUrl(baseUrl);
  const url = /^[a-z][a-z0-9+.-]*:/i.test(pathOrUrl) ? new URL(pathOrUrl) : new URL(pathOrUrl, base.origin + "/");
  return assertLocalUrl(url);
}

// ---------------------------------------------------------------------------
// Probe IPs (198.18.0.0/15)
// ---------------------------------------------------------------------------

/** The c6d13ea solver sends this address itself. No test may use it. */
export const SOLVER_PROBE_IP = "198.18.99.1";

/**
 * Third-octet block per test file, so files never share a rate-limit bucket
 * even when they run against one shared server. Addresses are 198.18.<block>.<host>.
 * Block 99 is reserved for the solver.
 */
export const PROBE_BLOCKS = Object.freeze({
  /** tests/capture/api-contract.ts */
  captureContract: 10,
  /** tests/preserve/api-contract.test.ts */
  preserveContract: 11,
  /** tests/preserve/flows.test.ts */
  preserveFlows: 12,
  /** tests/explore/routes.test.ts */
  exploreRoutes: 20,
  /** tests/explore/rendered.test.ts */
  exploreRendered: 21,
  /** tests/explore/flows.test.ts */
  exploreFlows: 22,
  /** ad-hoc scripts and smoke checks */
  scratch: 30,
} as const);

export type ProbeBlock = (typeof PROBE_BLOCKS)[keyof typeof PROBE_BLOCKS];

function ipToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/** True when `ip` is in 198.18.0.0/15 and is not the solver's address. */
export function isProbeIp(ip: string): boolean {
  const n = ipToInt(ip);
  if (n === null) return false;
  const lo = ipToInt("198.18.0.0") as number;
  const hi = ipToInt("198.19.255.255") as number;
  return n >= lo && n <= hi && ip !== SOLVER_PROBE_IP;
}

/** Throws unless `ip` is a valid probe IP. */
export function assertProbeIp(ip: string): string {
  if (!isProbeIp(ip)) {
    throw new Error(
      `Invalid probe IP ${JSON.stringify(ip)}: use an address in 198.18.0.0/15 other than ${SOLVER_PROBE_IP} (see probeIp()).`,
    );
  }
  return ip;
}

function assertBlock(block: number): void {
  if (!Number.isInteger(block) || block < 0 || block > 255 || block === 99) {
    throw new Error(`Probe block must be an integer 0-255 other than 99, got ${block}`);
  }
}

/** Deterministic probe IP `198.18.<block>.<host>` (host 1-254). */
export function probeIp(block: number, host = 1): string {
  assertBlock(block);
  if (!Number.isInteger(host) || host < 1 || host > 254) {
    throw new Error(`Probe host must be an integer 1-254, got ${host}`);
  }
  return `198.18.${block}.${host}`;
}

const nextHost = new Map<number, number>();

/**
 * A fresh probe IP in `block`: hosts 2-254, starting at a random host per
 * process and cycling. Use one per browser context or per rate-limit probe so
 * re-runs inside the server's 60 s window don't inherit an old count.
 */
export function nextProbeIp(block: number): string {
  assertBlock(block);
  const current = nextHost.get(block) ?? randomInt(2, 255);
  nextHost.set(block, current >= 254 ? 2 : current + 1);
  return probeIp(block, current);
}

// ---------------------------------------------------------------------------
// Probe fetch
// ---------------------------------------------------------------------------

export interface ProbeInit extends RequestInit {
  /** Sent as `cf-connecting-ip`. Required; must be a probe IP. */
  ip: string;
  /** Origin of the server under test. Default BASE_URL. */
  baseUrl?: string;
  /** Abort after this many ms. Default 30000. */
  timeoutMs?: number;
}

/**
 * `fetch` against the server under test with `cf-connecting-ip: <ip>`.
 * Defaults to `redirect: "manual"`, so 307/308 responses are returned as-is.
 */
export async function probeFetch(pathOrUrl: string, init: ProbeInit): Promise<Response> {
  const { ip, baseUrl = BASE_URL, timeoutMs = 30_000, headers, ...rest } = init;
  assertProbeIp(ip);
  const url = toLocalUrl(pathOrUrl, baseUrl);
  const h = new Headers(headers);
  h.set("cf-connecting-ip", ip);
  return fetch(url, {
    redirect: "manual",
    ...rest,
    headers: h,
    signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

export interface ProbeResult<T = unknown> {
  status: number;
  headers: Headers;
  /** Raw body text. */
  text: string;
  /** Parsed JSON body, or undefined if the body is not JSON. */
  json: T | undefined;
  contentType: string | null;
  /** `access-control-allow-origin` header. */
  acao: string | null;
  /** `location` header (redirects). */
  location: string | null;
}

export interface ProbeRequestOptions {
  ip: string;
  baseUrl?: string;
  /** Serialized with JSON.stringify and sent with content-type application/json. */
  json?: unknown;
  /** Raw body, sent as-is (set `headers` for its content-type). */
  body?: string;
  headers?: HeadersInit;
  timeoutMs?: number;
}

/** One request with the body read and parsed. Never throws on HTTP status. */
export async function probeRequest<T = unknown>(
  method: string,
  pathOrUrl: string,
  options: ProbeRequestOptions,
): Promise<ProbeResult<T>> {
  const headers = new Headers(options.headers);
  let body: string | undefined = options.body;
  if (options.json !== undefined) {
    body = JSON.stringify(options.json);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }
  const res = await probeFetch(pathOrUrl, {
    method,
    body,
    headers,
    ip: options.ip,
    baseUrl: options.baseUrl,
    timeoutMs: options.timeoutMs,
  });
  const text = await res.text();
  let json: T | undefined;
  try {
    json = text ? (JSON.parse(text) as T) : undefined;
  } catch {
    json = undefined;
  }
  return {
    status: res.status,
    headers: res.headers,
    text,
    json,
    contentType: res.headers.get("content-type"),
    acao: res.headers.get("access-control-allow-origin"),
    location: res.headers.get("location"),
  };
}

export interface ProbeClient {
  readonly ip: string;
  readonly baseUrl: string;
  fetch(pathOrUrl: string, init?: Omit<ProbeInit, "ip" | "baseUrl">): Promise<Response>;
  get<T = unknown>(pathOrUrl: string, headers?: HeadersInit): Promise<ProbeResult<T>>;
  post<T = unknown>(pathOrUrl: string, json: unknown, headers?: HeadersInit): Promise<ProbeResult<T>>;
  postRaw<T = unknown>(pathOrUrl: string, body: string, contentType?: string): Promise<ProbeResult<T>>;
  options<T = unknown>(pathOrUrl: string, headers?: HeadersInit): Promise<ProbeResult<T>>;
}

/** A client bound to one probe IP and one server. */
export function createProbeClient(ip: string, baseUrl: string = BASE_URL): ProbeClient {
  assertProbeIp(ip);
  const origin = assertLocalUrl(baseUrl).origin;
  return {
    ip,
    baseUrl: origin,
    fetch: (p, init = {}) => probeFetch(p, { ...init, ip, baseUrl: origin }),
    get: (p, headers) => probeRequest("GET", p, { ip, baseUrl: origin, headers }),
    post: (p, json, headers) => probeRequest("POST", p, { ip, baseUrl: origin, json, headers }),
    postRaw: (p, body, contentType = "application/json") =>
      probeRequest("POST", p, { ip, baseUrl: origin, body, headers: { "content-type": contentType } }),
    options: (p, headers) => probeRequest("OPTIONS", p, { ip, baseUrl: origin, headers }),
  };
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Calls `fn` every `intervalMs` until it returns a truthy value or `timeoutMs`
 * passes. Returns the last value (falsy on timeout). Never throws on timeout;
 * errors thrown by `fn` count as falsy.
 */
export async function poll<T>(
  fn: () => T | Promise<T>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T | undefined> {
  const { timeoutMs = 5_000, intervalMs = 100 } = options;
  const end = Date.now() + timeoutMs;
  let last: T | undefined;
  for (;;) {
    try {
      last = await fn();
      if (last) return last;
    } catch {
      last = undefined;
    }
    if (Date.now() >= end) return last;
    await sleep(intervalMs);
  }
}

function assertPort(port: number): void {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Port must be an integer 1024-65535, got ${port}`);
  }
}

function canConnect(host: string, port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/** True when nothing accepts connections on 127.0.0.1:<port> or [::1]:<port>. */
export async function isPortFree(port: number): Promise<boolean> {
  assertPort(port);
  const [v4, v6] = await Promise.all([canConnect("127.0.0.1", port), canConnect("::1", port)]);
  return !v4 && !v6;
}

/** Polls until the port is free. Returns false on timeout. */
export async function waitForPortFree(port: number, timeoutMs = 15_000): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await isPortFree(port)) return true;
    await sleep(250);
  }
  return isPortFree(port);
}

/**
 * Fallback cleanup from the safety rules: kills every process listening on
 * `port` with `taskkill /T /F` (Windows) and waits until the port is free.
 */
export async function killPort(port: number): Promise<boolean> {
  assertPort(port);
  if (process.platform === "win32") {
    const cmd =
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ` +
      "ForEach-Object { taskkill /PID $_.OwningProcess /T /F }";
    spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    spawnSync("sh", ["-c", `fuser -k ${port}/tcp`], { stdio: "ignore" });
  }
  return waitForPortFree(port, 10_000);
}

/**
 * Polls GET <baseUrl>/skill.md until it returns 200. Static files don't touch
 * the rate limiter, so polling costs no budget.
 */
export async function waitForServer(baseUrl: string = BASE_URL, timeoutMs = 60_000, child?: ChildProcess): Promise<void> {
  const url = toLocalUrl("/skill.md", baseUrl);
  const end = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < end) {
    if (child && child.exitCode !== null) {
      throw new Error(`Server process exited with code ${child.exitCode} before it was ready`);
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      await res.arrayBuffer();
      if (res.status === 200) return;
      lastError = `status ${res.status}`;
    } catch (err) {
      lastError = (err as Error).message;
    }
    await sleep(300);
  }
  throw new Error(`Server at ${baseUrl} not ready after ${timeoutMs} ms (GET /skill.md: ${lastError})`);
}

export interface ServerHandle {
  readonly port: number;
  /** Origin to pass to probe clients and browser contexts, e.g. http://localhost:3101. */
  readonly baseUrl: string;
  /** PID of the `next start` node process, or null for an external server. */
  readonly pid: number | null;
  /** True when the server came from BASE_URL and this process didn't start it. */
  readonly external: boolean;
  /** Last 64 KB of the server's stdout and stderr. */
  output(): string;
  /** Kills the process tree, then waits until the port is free (falls back to killPort). Idempotent. */
  stop(): Promise<void>;
}

export interface StartServerOptions {
  /** Readiness timeout. Default 60000 ms. */
  timeoutMs?: number;
  /** Extra environment for the server process. */
  env?: Record<string, string>;
}

const liveChildren = new Set<ChildProcess>();

function killTreeSync(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGKILL");
  }
}

let exitHookInstalled = false;
function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  const killAll = (): void => {
    for (const c of liveChildren) killTreeSync(c);
    liveChildren.clear();
  };
  process.once("exit", killAll);
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      killAll();
      process.exit(130);
    });
  }
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

/**
 * Starts `next start -p <port>` from the existing `.next` build (no rebuild),
 * waits until GET /skill.md returns 200, and returns a handle. Throws if the
 * port is busy or there is no build. Always call `handle.stop()` (in `after`).
 */
export async function startServer(port: number, options: StartServerOptions = {}): Promise<ServerHandle> {
  assertPort(port);
  if (!existsSync(join(REPO_ROOT, ".next", "BUILD_ID"))) {
    throw new Error("No production build in .next (missing BUILD_ID). Run `npm run build` first.");
  }
  if (!(await isPortFree(port))) {
    throw new Error(
      `Port ${port} is already in use. Stop that server first: ` +
        `Get-NetTCPConnection -LocalPort ${port} -State Listen | ForEach-Object { taskkill /PID $_.OwningProcess /T /F }`,
    );
  }
  const nextBin = join(REPO_ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  liveChildren.add(child);
  installExitHook();

  let log = "";
  const append = (chunk: Buffer): void => {
    log = (log + chunk.toString("utf8")).slice(-64 * 1024);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.once("exit", () => liveChildren.delete(child));
  // Don't keep the test process alive because of the server. If a test file
  // forgets stop(), the process can still exit and the exit hook kills the tree.
  child.unref();
  for (const stream of [child.stdout, child.stderr]) {
    (stream as unknown as { unref?: () => void } | null)?.unref?.();
  }

  const baseUrl = `http://localhost:${port}`;
  let stopped = false;
  const handle: ServerHandle = {
    port,
    baseUrl,
    pid: child.pid ?? null,
    external: false,
    output: () => log,
    async stop() {
      if (stopped) return;
      stopped = true;
      killTreeSync(child);
      await waitForExit(child, 10_000);
      liveChildren.delete(child);
      if (!(await waitForPortFree(port, 10_000)) && !(await killPort(port))) {
        throw new Error(`Port ${port} is still in use after stopping the server`);
      }
    },
  };

  try {
    await waitForServer(baseUrl, options.timeoutMs ?? 60_000, child);
  } catch (err) {
    await handle.stop().catch(() => undefined);
    throw new Error(`${(err as Error).message}\n--- server output ---\n${log}`);
  }
  return handle;
}

/**
 * The entry point for test files. If `process.env.BASE_URL` is set, uses that
 * external server (it must be localhost and already running; `stop()` is a
 * no-op). Otherwise starts `next start -p <port>` on the file's own port.
 */
export async function ensureServer(port: number, options: StartServerOptions = {}): Promise<ServerHandle> {
  const external = process.env.BASE_URL;
  if (external) {
    const url = assertLocalUrl(external);
    await waitForServer(url.origin, options.timeoutMs ?? 60_000);
    return {
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
      baseUrl: url.origin,
      pid: null,
      external: true,
      output: () => "",
      stop: async () => undefined,
    };
  }
  return startServer(port, options);
}
