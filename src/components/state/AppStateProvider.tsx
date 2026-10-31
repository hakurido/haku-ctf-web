"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  AppState,
  initialAppState,
  appReducer,
  InstanceGate,
} from "@/lib/app-state";
import {
  getScoreboard,
  postFlag,
  postGate1Prompt,
  getChallenge,
  submitGate,
} from "@/lib/api";
import { GATES } from "@/lib/gates";
import { parseGate3Assignment } from "@/lib/validation";
import { runConsoleCommand } from "@/lib/console";
import { sounds } from "@/lib/sound";
import { ServerError } from "@/lib/app-state";

function toServerError(res: any): ServerError | null {
  if (res?.kind !== "server-error") return null;
  return {
    status: res.status,
    message: res.message,
    retryAt: res.retryAfterSec ? Date.now() + res.retryAfterSec * 1000 : null,
    body: res.body,
  };
}

interface AppContextValue {
  state: AppState;
  announcement: string;
  announce: (text: string) => void;
  setField: (path: string, value: any) => void;
  sendGate1Prompt: () => Promise<void>;
  requestInstance: (gate: InstanceGate) => Promise<void>;
  submitInstance: (gate: InstanceGate) => Promise<void>;
  submitFlag: () => Promise<void>;
  dismissFlagResult: () => void;
  loadScoreboard: () => Promise<void>;
  runConsole: () => void;
  toggleSound: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const NowContext = createContext<number>(Date.now());

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}

export function useNow(): number {
  return useContext(NowContext);
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState<number>(Date.now());

  const announce = useCallback((text: string) => {
    setAnnouncement("");
    setTimeout(() => setAnnouncement(text), 50);
  }, []);

  // Sync sound setting
  useEffect(() => {
    sounds.enabled = state.soundOn;
  }, [state.soundOn]);

  // Ticker for active countdowns
  const isCounting = useMemo(() => {
    const hasLive2 = !!state.gate2.instance && !state.gate2.instance.expired;
    const hasLive3 = !!state.gate3.instance && !state.gate3.instance.expired;
    const hasLive4 = !!state.gate4.instance && !state.gate4.instance.expired;
    const hasRetry =
      (state.flag.retryAt !== null && state.flag.retryAt > now) ||
      (state.gate1.error?.retryAt !== null && (state.gate1.error?.retryAt || 0) > now) ||
      (state.gate2.error?.retryAt !== null && (state.gate2.error?.retryAt || 0) > now) ||
      (state.gate3.error?.retryAt !== null && (state.gate3.error?.retryAt || 0) > now) ||
      (state.gate4.error?.retryAt !== null && (state.gate4.error?.retryAt || 0) > now);

    return hasLive2 || hasLive3 || hasLive4 || hasRetry;
  }, [state, now]);

  useEffect(() => {
    if (!isCounting) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);

      ([2, 3, 4] as const).forEach((g) => {
        const slot = state[`gate${g}`];
        if (slot.instance && !slot.instance.expired && current >= slot.instance.expiresAt) {
          dispatch({ type: "instance/expired", gate: g });
        }
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isCounting, state]);

  const setField = useCallback((path: string, value: any) => {
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
      if (res.data.flag) {
        sounds.playSuccess();
        announce("Flag returned.");
      } else if (!res.data.allowed) {
        sounds.playError();
        announce("Prompt blocked by filter.");
      } else {
        announce("Prompt answered, no flag.");
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
          ? "Prompt didn't reach the server."
          : res.message
      );
    }
  }, [state.gate1.prompt, state.gate1.status, announce]);

  const requestInstance = useCallback(
    async (gate: InstanceGate) => {
      const slot = state[`gate${gate}`];
      if (slot.status === "loading") return;

      dispatch({ type: "instance/requestStart", gate });
      const res = await getChallenge(gate);

      if (res.kind === "ok") {
        const ttl = res.data.ttlSeconds || GATES[gate - 1].ttlSeconds || 15;
        dispatch({
          type: "instance/requestSuccess",
          gate,
          data: res.data,
          now: Date.now(),
          ttl,
        });
        sounds.playClick();
        announce(`Gate ${gate} instance ready, expires in ${ttl} seconds.`);
      } else {
        sounds.playError();
        dispatch({
          type: "instance/requestError",
          gate,
          status: res.kind,
          error: toServerError(res),
        });
        announce(
          res.kind === "network-error"
            ? "Instance request didn't reach the server."
            : res.message
        );
      }
    },
    [state, announce]
  );

  const submitInstance = useCallback(
    async (gate: InstanceGate) => {
      const slot = state[`gate${gate}`];
      if (!slot.instance || slot.instance.expired || slot.status === "loading") return;

      let body: any;
      if (gate === 2) {
        const preds = (slot.inputs as [string, string, string]).map((s) => s.trim());
        body = {
          sessionToken: slot.instance.data.sessionToken,
          predictions: preds,
        };
      } else if (gate === 3) {
        const parsed = parseGate3Assignment(slot.inputs as string);
        if (!parsed.ok) {
          dispatch({ type: "instance/fieldError", gate, error: parsed.message });
          return;
        }
        body = {
          sessionToken: slot.instance.data.sessionToken,
          assignment: parsed.value,
        };
      } else if (gate === 4) {
        body = {
          sessionToken: slot.instance.data.sessionToken,
          keyHex: (slot.inputs as string).trim(),
        };
      }

      dispatch({ type: "instance/submitStart", gate });
      const res = await submitGate(gate, body);

      if (res.kind === "ok") {
        dispatch({ type: "instance/submitSuccess", gate, result: res.data });
        if (res.data.success) {
          sounds.playSuccess();
          announce("Accepted! " + res.data.message);
        } else {
          sounds.playError();
          announce("Rejected. " + res.data.message);
        }
      } else {
        sounds.playError();
        dispatch({
          type: "instance/submitError",
          gate,
          status: res.kind,
          error: toServerError(res),
        });
        announce(
          res.kind === "network-error"
            ? "Submission didn't reach the server."
            : res.message
        );
      }
    },
    [state, announce]
  );

  const loadScoreboard = useCallback(async () => {
    if (state.scoreboard.status === "loading") return;

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
      announce("Failed to load scoreboard.");
    }
  }, [state.scoreboard.status, announce]);

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
        announce(`Flag accepted for ${res.data.agent.agentName}.`);
        loadScoreboard();
      } else {
        dispatch({ type: "flag/rejected", message: res.data.message });
        sounds.playError();
        announce("Flag rejected.");
      }
    } else {
      sounds.playError();
      const retryAt =
        res.kind === "server-error" && res.retryAfterSec
          ? Date.now() + res.retryAfterSec * 1000
          : null;
      dispatch({
        type: "flag/error",
        status: res.kind,
        message:
          res.kind === "network-error"
            ? "The flag didn't reach the server. Check your connection and try again."
            : res.message,
        error: toServerError(res),
        retryAt,
      });
      announce(
        res.kind === "network-error"
          ? "Flag didn't reach the server."
          : "Flag submission rate limited."
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
    });

    if (res.kind === "none") return;
    if (res.kind === "clear") {
      dispatch({ type: "console/clear" });
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
  }, [state.console.input, state.scoreboard.entries]);

  const toggleSound = useCallback(() => {
    dispatch({ type: "sound/toggle" });
    if (!state.soundOn) {
      sounds.enabled = true;
      sounds.playClick();
    }
  }, [state.soundOn]);

  const contextValue = useMemo(
    () => ({
      state,
      announcement,
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
