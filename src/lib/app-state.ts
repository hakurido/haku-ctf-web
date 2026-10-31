import {
  ChallengeByGate,
  Gate1ChatResponse,
  GateSubmitResponse,
  JsonValue,
  LeaderboardEntry,
} from "./api";

export type GateNumber = 1 | 2 | 3 | 4;
export type InstanceGate = 2 | 3 | 4;

export interface ServerError {
  status: number;
  message: string;
  retryAt: number | null;
  body: JsonValue | null;
}

export type Gate1Status =
  | "idle"
  | "loading"
  | "blocked"
  | "answered"
  | "flag-returned"
  | "server-error"
  | "network-error";

export interface Gate1Slot {
  status: Gate1Status;
  prompt: string;
  promptError: "required" | null;
  response: Gate1ChatResponse | null;
  error: ServerError | null;
}

export type InstanceStatus =
  | "idle"
  | "loading"
  | "live"
  | "expired"
  | "server-error"
  | "network-error"
  | "accepted"
  | "rejected";

export interface LiveInstance<C> {
  data: C;
  receivedAt: number;
  expiresAt: number;
  expired: boolean;
}

export interface InputsByGate {
  2: [string, string, string];
  3: string;
  4: string;
}

export interface InstanceSlot<G extends InstanceGate> {
  status: InstanceStatus;
  op: "request" | "submit" | null;
  instance: LiveInstance<ChallengeByGate[G]> | null;
  inputs: InputsByGate[G];
  fieldError: string | null;
  result: GateSubmitResponse | null;
  error: ServerError | null;
}

export type FlagStatus =
  | "idle"
  | "submitting"
  | "accepted"
  | "rejected"
  | "server-error"
  | "network-error";

export interface FlagSlot {
  agentHandle: string;
  flag: string;
  fieldErrors: { handle: "required" | null; flag: "required" | null };
  status: FlagStatus;
  message: string | null;
  recordedHandle: string | null;
  proofBadge: string | null;
  retryAt: number | null;
}

export interface ScoreboardSlot {
  status: "idle" | "loading" | "loaded" | "server-error" | "network-error";
  entries: LeaderboardEntry[] | null;
  loadedAt: number | null;
  error: ServerError | null;
}

export interface ConsoleEntry {
  id: number;
  command: string | null;
  output: string;
  tone: "normal" | "error";
}

export interface ConsoleSlot {
  history: ConsoleEntry[];
  input: string;
  nextId: number;
}

export interface AppState {
  gate1: Gate1Slot;
  gate2: InstanceSlot<2>;
  gate3: InstanceSlot<3>;
  gate4: InstanceSlot<4>;
  flag: FlagSlot;
  scoreboard: ScoreboardSlot;
  console: ConsoleSlot;
  soundOn: boolean;
}

export const initialAppState: AppState = {
  gate1: {
    status: "idle",
    prompt: "",
    promptError: null,
    response: null,
    error: null,
  },
  gate2: {
    status: "idle",
    op: null,
    instance: null,
    inputs: ["", "", ""],
    fieldError: null,
    result: null,
    error: null,
  },
  gate3: {
    status: "idle",
    op: null,
    instance: null,
    inputs: "",
    fieldError: null,
    result: null,
    error: null,
  },
  gate4: {
    status: "idle",
    op: null,
    instance: null,
    inputs: "",
    fieldError: null,
    result: null,
    error: null,
  },
  flag: {
    agentHandle: "",
    flag: "",
    fieldErrors: { handle: null, flag: null },
    status: "idle",
    message: null,
    recordedHandle: null,
    proofBadge: null,
    retryAt: null,
  },
  scoreboard: {
    status: "idle",
    entries: null,
    loadedAt: null,
    error: null,
  },
  console: {
    history: [
      {
        id: 0,
        command: null,
        output: "AGENTGATE console. Type help to list commands, or gates to list the four gates.",
        tone: "normal",
      },
    ],
    input: "",
    nextId: 1,
  },
  soundOn: false,
};

export type AppAction =
  | { type: "field/set"; path: string; value: any }
  | { type: "gate1/promptError"; error: "required" | null }
  | { type: "gate1/start" }
  | { type: "gate1/success"; response: Gate1ChatResponse }
  | { type: "gate1/error"; status: "server-error" | "network-error"; error: ServerError | null }
  | { type: "instance/requestStart"; gate: InstanceGate }
  | { type: "instance/requestSuccess"; gate: InstanceGate; data: any; now: number; ttl: number }
  | { type: "instance/requestError"; gate: InstanceGate; status: "server-error" | "network-error"; error: ServerError | null }
  | { type: "instance/submitStart"; gate: InstanceGate }
  | { type: "instance/submitSuccess"; gate: InstanceGate; result: GateSubmitResponse }
  | { type: "instance/submitError"; gate: InstanceGate; status: "server-error" | "network-error"; error: ServerError | null }
  | { type: "instance/fieldError"; gate: InstanceGate; error: string | null }
  | { type: "instance/expired"; gate: InstanceGate }
  | { type: "flag/errors"; errors: { handle: "required" | null; flag: "required" | null } }
  | { type: "flag/start" }
  | { type: "flag/success"; data: any }
  | { type: "flag/rejected"; message: string }
  | { type: "flag/error"; status: "server-error" | "network-error"; message: string; error: ServerError | null; retryAt: number | null }
  | { type: "flag/dismiss" }
  | { type: "scoreboard/start" }
  | { type: "scoreboard/success"; entries: LeaderboardEntry[]; now: number }
  | { type: "scoreboard/error"; status: "server-error" | "network-error"; error: ServerError | null }
  | { type: "console/set"; input: string }
  | { type: "console/add"; entry: Omit<ConsoleEntry, "id"> }
  | { type: "console/clear" }
  | { type: "sound/toggle" };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "field/set": {
      const { path, value } = action;
      if (path === "gate1.prompt") {
        return {
          ...state,
          gate1: { ...state.gate1, prompt: value, promptError: null },
        };
      }
      if (path.startsWith("gate2.inputs.")) {
        const idx = parseInt(path.split(".")[2], 10);
        const newInputs: [string, string, string] = [...state.gate2.inputs];
        newInputs[idx] = value;
        return {
          ...state,
          gate2: { ...state.gate2, inputs: newInputs },
        };
      }
      if (path === "gate3.inputs") {
        return {
          ...state,
          gate3: { ...state.gate3, inputs: value, fieldError: null },
        };
      }
      if (path === "gate4.inputs") {
        return {
          ...state,
          gate4: { ...state.gate4, inputs: value },
        };
      }
      if (path === "flag.agentHandle") {
        return {
          ...state,
          flag: {
            ...state.flag,
            agentHandle: value,
            fieldErrors: { ...state.flag.fieldErrors, handle: null },
          },
        };
      }
      if (path === "flag.flag") {
        return {
          ...state,
          flag: {
            ...state.flag,
            flag: value,
            fieldErrors: { ...state.flag.fieldErrors, flag: null },
          },
        };
      }
      if (path === "console.input") {
        return {
          ...state,
          console: { ...state.console, input: value },
        };
      }
      return state;
    }

    case "gate1/promptError": {
      return {
        ...state,
        gate1: { ...state.gate1, promptError: action.error },
      };
    }

    case "gate1/start": {
      return {
        ...state,
        gate1: {
          ...state.gate1,
          status: "loading",
          promptError: null,
          response: null,
          error: null,
        },
      };
    }

    case "gate1/success": {
      const resp = action.response;
      let status: Gate1Status = "answered";
      if (!resp.allowed) {
        status = "blocked";
      } else if (resp.flag) {
        status = "flag-returned";
      }

      const nextFlag = resp.flag ? { ...state.flag, flag: resp.flag } : state.flag;

      return {
        ...state,
        flag: nextFlag,
        gate1: {
          ...state.gate1,
          status,
          response: resp,
          error: null,
        },
      };
    }

    case "gate1/error": {
      return {
        ...state,
        gate1: {
          ...state.gate1,
          status: action.status,
          error: action.error,
        },
      };
    }

    case "instance/requestStart": {
      const key = `gate${action.gate}` as const;
      return {
        ...state,
        [key]: {
          ...state[key],
          status: "loading",
          op: "request",
          instance: null,
          fieldError: null,
          result: null,
          error: null,
          inputs: action.gate === 2 ? ["", "", ""] : "",
        },
      };
    }

    case "instance/requestSuccess": {
      const key = `gate${action.gate}` as const;
      return {
        ...state,
        [key]: {
          ...state[key],
          status: "live",
          op: null,
          instance: {
            data: action.data,
            receivedAt: action.now,
            expiresAt: action.now + action.ttl * 1000,
            expired: false,
          },
          result: null,
          error: null,
        },
      };
    }

    case "instance/requestError": {
      const key = `gate${action.gate}` as const;
      return {
        ...state,
        [key]: {
          ...state[key],
          status: action.status,
          op: "request",
          instance: null,
          error: action.error,
        },
      };
    }

    case "instance/submitStart": {
      const key = `gate${action.gate}` as const;
      return {
        ...state,
        [key]: {
          ...state[key],
          status: "loading",
          op: "submit",
          result: null,
          error: null,
        },
      };
    }

    case "instance/submitSuccess": {
      const key = `gate${action.gate}` as const;
      const res = action.result;
      const nextFlag = res.flag ? { ...state.flag, flag: res.flag } : state.flag;

      return {
        ...state,
        flag: nextFlag,
        [key]: {
          ...state[key],
          status: res.success ? "accepted" : "rejected",
          op: null,
          result: res,
          error: null,
        },
      };
    }

    case "instance/submitError": {
      const key = `gate${action.gate}` as const;
      return {
        ...state,
        [key]: {
          ...state[key],
          status: action.status,
          op: "submit",
          error: action.error,
        },
      };
    }

    case "instance/fieldError": {
      const key = `gate${action.gate}` as const;
      return {
        ...state,
        [key]: {
          ...state[key],
          fieldError: action.error,
        },
      };
    }

    case "instance/expired": {
      const key = `gate${action.gate}` as const;
      const slot = state[key];
      if (!slot.instance || slot.instance.expired) return state;

      return {
        ...state,
        [key]: {
          ...slot,
          status: slot.status === "live" ? "expired" : slot.status,
          instance: { ...slot.instance, expired: true },
        },
      };
    }

    case "flag/errors": {
      return {
        ...state,
        flag: {
          ...state.flag,
          fieldErrors: action.errors,
        },
      };
    }

    case "flag/start": {
      return {
        ...state,
        flag: {
          ...state.flag,
          status: "submitting",
          message: null,
          recordedHandle: null,
          proofBadge: null,
          retryAt: null,
        },
      };
    }

    case "flag/success": {
      return {
        ...state,
        flag: {
          ...state.flag,
          status: "accepted",
          message: action.data.message,
          recordedHandle: action.data.agent?.agentName || null,
          proofBadge: action.data.proofBadge || null,
          retryAt: null,
        },
      };
    }

    case "flag/rejected": {
      return {
        ...state,
        flag: {
          ...state.flag,
          status: "rejected",
          message: action.message,
          recordedHandle: null,
          proofBadge: null,
          retryAt: null,
        },
      };
    }

    case "flag/error": {
      return {
        ...state,
        flag: {
          ...state.flag,
          status: action.status,
          message: action.message,
          retryAt: action.retryAt,
        },
      };
    }

    case "flag/dismiss": {
      return {
        ...state,
        flag: {
          ...state.flag,
          status: "idle",
          message: null,
          recordedHandle: null,
          proofBadge: null,
          retryAt: null,
        },
      };
    }

    case "scoreboard/start": {
      return {
        ...state,
        scoreboard: {
          ...state.scoreboard,
          status: "loading",
        },
      };
    }

    case "scoreboard/success": {
      return {
        ...state,
        scoreboard: {
          ...state.scoreboard,
          status: "loaded",
          entries: action.entries,
          loadedAt: action.now,
          error: null,
        },
      };
    }

    case "scoreboard/error": {
      return {
        ...state,
        scoreboard: {
          ...state.scoreboard,
          status: action.status,
          error: action.error,
        },
      };
    }

    case "console/set": {
      return {
        ...state,
        console: { ...state.console, input: action.input },
      };
    }

    case "console/add": {
      return {
        ...state,
        console: {
          ...state.console,
          input: "",
          history: [
            ...state.console.history,
            { id: state.console.nextId, ...action.entry },
          ],
          nextId: state.console.nextId + 1,
        },
      };
    }

    case "console/clear": {
      return {
        ...state,
        console: {
          ...state.console,
          input: "",
          history: [],
        },
      };
    }

    case "sound/toggle": {
      return {
        ...state,
        soundOn: !state.soundOn,
      };
    }

    default:
      return state;
  }
}
