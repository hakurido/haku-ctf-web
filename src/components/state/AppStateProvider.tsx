"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  appReducer,
  getInstanceSlot,
  initialAppState,
  type AppState,
  type FieldPath,
  type RequestSuccessAction,
  type ServerError,
} from "@/lib/app-state";
import {
  getChallenge,
  getScoreboard,
  postFlag,
  postGate1Prompt,
  submitGate,
  type ApiResult,
  type GateSubmitResponse,
  type SubmitBodyByGate,
} from "@/lib/api";
import { GATES, type InstanceGate } from "@/lib/gates";
import { parseGate3Assignment } from "@/lib/validation";
import { runConsoleCommand } from "@/lib/console";
import { sounds } from "@/lib/sound";

const INSTANCE_GATES: readonly InstanceGate[] = [2, 3, 4];
const TICK_MS = 250;
/** The Announcer is emptied first, so a repeated message is spoken again (04 Live Regions). */
const ANNOUNCE_DELAY_MS = 100;
/** Then emptied again, so the virtual cursor doesn't find stale messages. */
const ANNOUNCE_CLEAR_MS = 5000;
/** Gate 1 announcements quote at most this much of the server text (design, Actions). */
const GATE1_ANNOUNCE_CHARS = 120;

type FailedResult = Exclude<ApiResult<unknown>, { kind: "ok" }>;

function toServerError(res: FailedResult): ServerError | null {
  if (res.kind !== "server-error") return null;
  return { status: res.status, message: res.message, body: res.body };
}

/** "Rate limited." for HTTP 429, "Server error." otherwise, then the server message (R-03). */
function serverFailureText(res: Extract<FailedResult, { kind: "server-error" }>): string {
  return `${res.status === 429 ? "Rate limited." : "Server error."} ${res.message}`;
}

/** Announcement for a failed gate request: gate number, then the reason (R-03). */
function gateFailureText(gate: number, res: FailedResult): string {
  return res.kind === "network-error"
    ? `Gate ${gate}: The request didn't reach the server.`
    : `Gate ${gate}: ${serverFailureText(res)}`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export interface AppContextValue {
  state: AppState;
  /** The current live-region text. The <Announcer /> for the active scope renders it. */
  announcement: string;
  /** True while the flag dialog is open: announcements go to its region (04 Live Regions). */
  flagDialogOpen: boolean;
  setFlagDialogOpen: (open: boolean) => void;
  announce: (text: string) => void;
  setField: (path: FieldPath, value: string) => void;
  sendGate1Prompt: () => Promise<void>;
  requestInstance: (gate: InstanceGate) => Promise<void>;
  submitInstance: (gate: InstanceGate) => Promise<void>;
  submitFlag: () => Promise<void>;
  dismissFlagResult: () => void;
  /** Stable identity: views may call it from a mount effect (R-01). Ignored while a load runs. */
  loadScoreboard: () => Promise<void>;
  runConsole: () => void;
  toggleSound: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const NowContext = createContext<number>(0);

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}

/** The ticker's clock. It runs while an instance is counting down and is set when one arrives. */
export function useNow(): number {
  return useContext(NowContext);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [announcement, setAnnouncement] = useState("");
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  // 0 until an instance arrives; requestInstance sets it then (R-02).
  const [now, setNow] = useState(0);
  const pathname = usePathname();

  // Read by the ticker, which runs outside render.
  const stateRef = useRef(state);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    stateRef.current = state;
    pathnameRef.current = pathname;
  });

  const announceSeq = useRef(0);
  const announce = useCallback((text: string) => {
    const seq = ++announceSeq.current;
    setAnnouncement("");
    setTimeout(() => {
      setAnnouncement(text);
      setTimeout(() => {
        if (announceSeq.current === seq) setAnnouncement("");
      }, ANNOUNCE_CLEAR_MS);
    }, ANNOUNCE_DELAY_MS);
  }, []);

  // Sync sound setting
  useEffect(() => {
    sounds.enabled = state.soundOn;
  }, [state.soundOn]);

  // The ticker runs only while an instance is counting down (R-04).
  const isCounting = INSTANCE_GATES.some((g) => {
    const instance = getInstanceSlot(state, g).instance;
    return !!instance && !instance.expired;
  });

  // Last instance handled per gate, so an expiry is dispatched and announced once.
  const expiryHandled = useRef<Partial<Record<InstanceGate, object>>>({});

  useEffect(() => {
    if (!isCounting) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);

      for (const g of INSTANCE_GATES) {
        const slot = getInstanceSlot(stateRef.current, g);
        const instance = slot.instance;
        if (!instance || instance.expired || current < instance.expiresAt) continue;
        if (expiryHandled.current[g] === instance) continue;
        expiryHandled.current[g] = instance;

        // R-24: once per instance, only for a live or rejected answer, and only
        // on the gate's own page. Returning to the page later announces nothing.
        const announced =
          (slot.status === "live" || slot.status === "rejected") &&
          pathnameRef.current === `/gates/${g}`;
        dispatch({ type: "instance/expired", gate: g, announced });
        if (announced) {
          announce(`Gate ${g} instance expired. Request a new instance to try again.`);
        }
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [isCounting, announce]);

  const setField = useCallback((path: FieldPath, value: string) => {
    dispatch({ type: "field/set", path, value });
  }, []);

  const sendGate1Prompt = useCallback(async () => {
    if (!state.gate1.prompt.trim()) {
      dispatch({ type: "gate1/promptError", error: "required" });
      return;
    }
    if (state.gate1.status === "loading") return;

    dispatch({ type: "gate1/start" });
    const res = await postGate1Prompt(state.gate1.prompt);

    if (res.kind === "ok") {
      dispatch({ type: "gate1/success", response: res.data });
      if (!res.data.allowed) {
        sounds.playError();
        announce(`Gate 1: Blocked. ${clip(res.data.response, GATE1_ANNOUNCE_CHARS)}`);
      } else if (res.data.flag) {
        sounds.playSuccess();
        announce("Gate 1: Flag returned and copied into the flag field.");
      } else {
        announce("Gate 1: Answer received, no flag.");
      }
    } else {
      sounds.playError();
      dispatch({
        type: "gate1/error",
        status: res.kind,
        error: toServerError(res),
      });
      announce(
        res.kind === "network-error"
          ? "Gate 1: The prompt didn't reach the server."
          : `Gate 1: ${serverFailureText(res)}`
      );
    }
  }, [state.gate1.prompt, state.gate1.status, announce]);

  const requestInstance = useCallback(
    async <G extends InstanceGate>(gate: G) => {
      if (getInstanceSlot(state, gate).status === "loading") return;

      dispatch({ type: "instance/requestStart", gate });
      const res = await getChallenge(gate);

      if (res.kind === "ok") {
        const ttl = res.data.ttlSeconds || GATES[gate - 1].ttlSeconds || 15;
        const receivedAt = Date.now();
        // Typed per gate, so `data` is checked against `gate`. The widening below
        // is sound (G is 2, 3, or 4), but TypeScript can't distribute a generic
        // over the action union by itself.
        const received: RequestSuccessAction<G> = {
          type: "instance/requestSuccess",
          gate,
          data: res.data,
          now: receivedAt,
          ttl,
        };
        dispatch(received as RequestSuccessAction);
        // The countdown's first frame reads the TTL, not a stale clock (R-02).
        setNow(receivedAt);
        sounds.playClick();
        announce(`Gate ${gate} instance ready. It expires in ${ttl} seconds.`);
      } else {
        sounds.playError();
        dispatch({
          type: "instance/requestError",
          gate,
          status: res.kind,
          error: toServerError(res),
        });
        announce(gateFailureText(gate, res));
      }
    },
    [state, announce]
  );

  const submitInstance = useCallback(
    async (gate: InstanceGate) => {
      const slot = getInstanceSlot(state, gate);
      if (!slot.instance || slot.instance.expired || slot.status === "loading") return;
      const sessionToken = slot.instance.data.sessionToken;

      let send: () => Promise<ApiResult<GateSubmitResponse>>;
      if (gate === 2) {
        const [x5, x6, x7] = state.gate2.inputs;
        const body: SubmitBodyByGate[2] = {
          sessionToken,
          predictions: [x5.trim(), x6.trim(), x7.trim()],
        };
        send = () => submitGate(2, body);
      } else if (gate === 3) {
        const parsed = parseGate3Assignment(state.gate3.inputs);
        if (!parsed.ok) {
          dispatch({ type: "instance/fieldError", gate, error: parsed.message });
          return;
        }
        const body: SubmitBodyByGate[3] = {
          sessionToken,
          // The parsed JSON, passed through unchanged (3.9).
          assignment: parsed.value,
        };
        send = () => submitGate(3, body);
      } else {
        const body: SubmitBodyByGate[4] = {
          sessionToken,
          keyHex: state.gate4.inputs.trim(),
        };
        send = () => submitGate(4, body);
      }

      dispatch({ type: "instance/submitStart", gate });
      const res = await send();

      if (res.kind === "ok") {
        dispatch({ type: "instance/submitSuccess", gate, result: res.data });
        if (res.data.success) {
          sounds.playSuccess();
          announce(`Gate ${gate}: Accepted. ${res.data.message}`);
        } else {
          sounds.playError();
          announce(`Gate ${gate}: Rejected. ${res.data.message}`);
        }
      } else {
        sounds.playError();
        dispatch({
          type: "instance/submitError",
          gate,
          status: res.kind,
          error: toServerError(res),
        });
        announce(gateFailureText(gate, res));
      }
    },
    [state, announce]
  );

  // R-01: a ref guards against overlapping loads, so the callback never changes
  // identity and an effect keyed on it runs once per mount.
  const scoreboardInFlight = useRef(false);
  const loadScoreboard = useCallback(async () => {
    if (scoreboardInFlight.current) return;
    scoreboardInFlight.current = true;
    try {
      dispatch({ type: "scoreboard/start" });
      const res = await getScoreboard();

      if (res.kind === "ok") {
        dispatch({
          type: "scoreboard/success",
          entries: res.data.leaderboard,
          now: Date.now(),
        });
      } else {
        dispatch({
          type: "scoreboard/error",
          status: res.kind,
          error: toServerError(res),
        });
        announce(
          res.kind === "network-error"
            ? "Couldn't load the scoreboard. The request didn't reach the server."
            : `Couldn't load the scoreboard. ${res.message}`
        );
      }
    } finally {
      scoreboardInFlight.current = false;
    }
  }, [announce]);

  const submitFlag = useCallback(async () => {
    const handle = state.flag.agentHandle.trim();
    const flag = state.flag.flag.trim();

    const errors = {
      handle: handle === "" ? ("required" as const) : null,
      flag: flag === "" ? ("required" as const) : null,
    };

    if (errors.handle || errors.flag) {
      dispatch({ type: "flag/errors", errors });
      return;
    }
    if (state.flag.status === "submitting") return;

    dispatch({ type: "flag/start" });
    const res = await postFlag(handle, flag);

    if (res.kind === "ok") {
      if (res.data.success) {
        dispatch({ type: "flag/success", data: res.data });
        sounds.playFlagWin();
        announce(`Flag accepted for ${res.data.agent.agentName}. ${res.data.message}`);
        loadScoreboard();
      } else {
        dispatch({ type: "flag/rejected", message: res.data.message });
        sounds.playError();
        announce(`Flag rejected. ${res.data.message}`);
      }
    } else {
      sounds.playError();
      dispatch({
        type: "flag/error",
        status: res.kind,
        message:
          res.kind === "network-error"
            ? "The flag didn't reach the server. Check your connection and try again."
            : res.message,
        error: toServerError(res),
      });
      // R-03: only a 429 is a rate limit.
      announce(
        res.kind === "network-error"
          ? "Flag didn't reach the server."
          : res.status === 429
          ? `Flag submission rate limited. ${res.message}`
          : `Flag submission failed. ${res.message}`
      );
    }
  }, [state.flag, announce, loadScoreboard]);

  const dismissFlagResult = useCallback(() => {
    dispatch({ type: "flag/dismiss" });
  }, []);

  const runConsole = useCallback(() => {
    const input = state.console.input;
    const res = runConsoleCommand(input, {
      gates: GATES,
      standings: state.scoreboard.entries,
      loadedAt: state.scoreboard.loadedAt,
    });

    if (res.kind === "none") return;
    if (res.kind === "clear") {
      dispatch({ type: "console/clear" });
      // The log doesn't announce removals (04 Live Regions, R-16).
      announce("Console cleared.");
      return;
    }

    dispatch({
      type: "console/add",
      entry: {
        command: res.command,
        output: res.output,
        tone: res.tone,
      },
    });
  }, [state.console.input, state.scoreboard.entries, state.scoreboard.loadedAt, announce]);

  const toggleSound = useCallback(() => {
    dispatch({ type: "sound/toggle" });
    if (!state.soundOn) {
      sounds.enabled = true;
      sounds.playClick();
    }
  }, [state.soundOn]);

  const contextValue = useMemo<AppContextValue>(
    () => ({
      state,
      announcement,
      flagDialogOpen,
      setFlagDialogOpen,
      announce,
      setField,
      sendGate1Prompt,
      requestInstance,
      submitInstance,
      submitFlag,
      dismissFlagResult,
      loadScoreboard,
      runConsole,
      toggleSound,
    }),
    [
      state,
      announcement,
      flagDialogOpen,
      announce,
      setField,
      sendGate1Prompt,
      requestInstance,
      submitInstance,
      submitFlag,
      dismissFlagResult,
      loadScoreboard,
      runConsole,
      toggleSound,
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      <NowContext.Provider value={now}>{children}</NowContext.Provider>
    </AppContext.Provider>
  );
}
