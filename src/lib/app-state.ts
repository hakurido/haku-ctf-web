import type {
  ApiResult,
  ChallengeByGate,
  FlagAccepted,
  Gate1ChatResponse,
  GateSubmitResponse,
  LeaderboardEntry,
} from "./api.ts";
import type { InstanceGate } from "./gates.ts";

// The gate number types live in gates.ts (R-06). They are re-exported here so
// existing `import { InstanceGate } from "@/lib/app-state"` lines keep working.
export type { GateNumber, InstanceGate } from "./gates.ts";

type ServerErrorResult = Extract<ApiResult<unknown>, { kind: "server-error" }>;

/** A non-2xx (or non-JSON) answer from the server, kept for display. */
export interface ServerError {
  /** HTTP status, for labels such as "Rate limited (HTTP 429)" or "Error (HTTP 500)". */
  status: number;
  /** The server message verbatim, or api.ts's fallback text. */
  message: string;
  body: ServerErrorResult["body"];
}

export type FailureStatus = "server-error" | "network-error";

export type Gate1Status =
  | "idle"
  | "loading"
  | "blocked"
  | "answered"
  | "flag-returned"
  | FailureStatus;

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
  | FailureStatus
  | "accepted"
  | "rejected";

export interface LiveInstance<C> {
  data: C;
  receivedAt: number;
  expiresAt: number;
  expired: boolean;
  /**
   * True once this instance's expiry has been announced (R-24). The provider's
   * ticker announces the expiry itself, once per instance, and sets this in the
   * same `instance/expired` event. It stays false when nothing was announced:
   * the status at expiry wasn't `live` or `rejected`, or the visitor was on
   * another view.
   */
  expiryAnnounced: boolean;
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

export type AnyInstanceSlot = InstanceSlot<2> | InstanceSlot<3> | InstanceSlot<4>;

export type FlagStatus =
  | "idle"
  | "submitting"
  | "accepted"
  | "rejected"
  | FailureStatus;

export interface FlagSlot {
  agentHandle: string;
  flag: string;
  fieldErrors: { handle: "required" | null; flag: "required" | null };
  status: FlagStatus;
  /** Server message verbatim, or the network-error text. */
  message: string | null;
  recordedHandle: string | null;
  /** The accepted entry, for the "Score: … Gates solved: …" line (R-36). */
  agent: LeaderboardEntry | null;
  proofBadge: string | null;
  /** Set for `server-error`: carries the HTTP status for the error label (R-36). */
  error: ServerError | null;
}

export interface ScoreboardSlot {
  status: "idle" | "loading" | "loaded" | FailureStatus;
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
    agent: null,
    proofBadge: null,
    error: null,
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
        output:
          "AGENTGATE console. Type help to list commands.\nThere are 4 gates. Type gates to list their points, endpoints, and TTLs.",
        tone: "normal",
      },
    ],
    input: "",
    nextId: 1,
  },
  soundOn: false,
};

/** The text fields `field/set` can write. Gate 2's predictions are indexes 0 to 2. */
export type FieldPath =
  | "gate1.prompt"
  | `gate2.inputs.${number}`
  | "gate3.inputs"
  | "gate4.inputs"
  | "flag.agentHandle"
  | "flag.flag"
  | "console.input";

/**
 * `instance/requestSuccess` with the data type tied to the gate. Mapping over
 * `G` itself lets a generic caller build it from `getChallenge<G>()`'s result.
 */
export type RequestSuccessAction<G extends InstanceGate = InstanceGate> = {
  [P in G]: {
    type: "instance/requestSuccess";
    gate: P;
    data: ChallengeByGate[P];
    now: number;
    ttl: number;
  };
}[G];

export type AppAction =
  | { type: "field/set"; path: FieldPath; value: string }
  | { type: "gate1/promptError"; error: "required" | null }
  | { type: "gate1/start" }
  | { type: "gate1/success"; response: Gate1ChatResponse }
  | { type: "gate1/error"; status: FailureStatus; error: ServerError | null }
  | { type: "instance/requestStart"; gate: InstanceGate }
  | RequestSuccessAction
  | { type: "instance/requestError"; gate: InstanceGate; status: FailureStatus; error: ServerError | null }
  | { type: "instance/submitStart"; gate: InstanceGate }
  | { type: "instance/submitSuccess"; gate: InstanceGate; result: GateSubmitResponse }
  | { type: "instance/submitError"; gate: InstanceGate; status: FailureStatus; error: ServerError | null }
  | { type: "instance/fieldError"; gate: InstanceGate; error: string | null }
  | { type: "instance/expired"; gate: InstanceGate; announced?: boolean }
  | { type: "flag/errors"; errors: FlagSlot["fieldErrors"] }
  | { type: "flag/start" }
  | { type: "flag/success"; data: FlagAccepted }
  | { type: "flag/rejected"; message: string }
  | { type: "flag/error"; status: FailureStatus; message: string; error: ServerError | null }
  | { type: "flag/dismiss" }
  | { type: "scoreboard/start" }
  | { type: "scoreboard/success"; entries: LeaderboardEntry[]; now: number }
  | { type: "scoreboard/error"; status: FailureStatus; error: ServerError | null }
  | { type: "console/add"; entry: Omit<ConsoleEntry, "id"> }
  | { type: "console/clear" }
  | { type: "sound/toggle" };

/** The slot of an instance gate. */
export function getInstanceSlot(state: AppState, gate: InstanceGate): AnyInstanceSlot {
  switch (gate) {
    case 2:
      return state.gate2;
    case 3:
      return state.gate3;
    case 4:
      return state.gate4;
  }
}

/** Applies an update that doesn't depend on the gate's data or input types. */
function updateSlot(
  state: AppState,
  gate: InstanceGate,
  update: <S extends AnyInstanceSlot>(slot: S) => S
): AppState {
  switch (gate) {
    case 2:
      return { ...state, gate2: update(state.gate2) };
    case 3:
      return { ...state, gate3: update(state.gate3) };
    case 4:
      return { ...state, gate4: update(state.gate4) };
  }
}

/**
 * A gate returned a flag: fill the flag field and clear what belonged to the
 * previous flag, so the filled field is ready to submit (R-05, 3.5). The handle
 * is untouched. A submission still in flight keeps its status.
 */
function autoFillFlag(flag: FlagSlot, value: string): FlagSlot {
  const filled: FlagSlot = {
    ...flag,
    flag: value,
    fieldErrors: { ...flag.fieldErrors, flag: null },
  };
  if (flag.status === "submitting") return filled;
  return {
    ...filled,
    status: "idle",
    message: null,
    recordedHandle: null,
    agent: null,
    proofBadge: null,
    error: null,
  };
}

const GATE2_INPUT_INDEX = /^gate2\.inputs\.([0-2])$/;

function setFieldValue(state: AppState, path: FieldPath, value: string): AppState {
  switch (path) {
    case "gate1.prompt":
      return { ...state, gate1: { ...state.gate1, prompt: value, promptError: null } };
    case "gate3.inputs":
      return { ...state, gate3: { ...state.gate3, inputs: value, fieldError: null } };
    case "gate4.inputs":
      return { ...state, gate4: { ...state.gate4, inputs: value } };
    case "flag.agentHandle":
      return {
        ...state,
        flag: {
          ...state.flag,
          agentHandle: value,
          fieldErrors: { ...state.flag.fieldErrors, handle: null },
        },
      };
    case "flag.flag":
      return {
        ...state,
        flag: {
          ...state.flag,
          flag: value,
          fieldErrors: { ...state.flag.fieldErrors, flag: null },
        },
      };
    case "console.input":
      return { ...state, console: { ...state.console, input: value } };
    default: {
      const match = GATE2_INPUT_INDEX.exec(path);
      if (!match) return state;
      const inputs: [string, string, string] = [...state.gate2.inputs];
      inputs[Number(match[1])] = value;
      return { ...state, gate2: { ...state.gate2, inputs } };
    }
  }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "field/set":
      return setFieldValue(state, action.path, action.value);

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

      return {
        ...state,
        flag: resp.flag ? autoFillFlag(state.flag, resp.flag) : state.flag,
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
      const reset = {
        status: "loading",
        op: "request",
        instance: null,
        fieldError: null,
        result: null,
        error: null,
      } satisfies Partial<AnyInstanceSlot>;
      switch (action.gate) {
        case 2:
          return { ...state, gate2: { ...state.gate2, ...reset, inputs: ["", "", ""] } };
        case 3:
          return { ...state, gate3: { ...state.gate3, ...reset, inputs: "" } };
        case 4:
          return { ...state, gate4: { ...state.gate4, ...reset, inputs: "" } };
      }
      return state;
    }

    case "instance/requestSuccess": {
      const timing = {
        receivedAt: action.now,
        expiresAt: action.now + action.ttl * 1000,
        expired: false,
        expiryAnnounced: false,
      };
      const live = { status: "live", op: null, result: null, error: null } satisfies Partial<AnyInstanceSlot>;
      switch (action.gate) {
        case 2:
          return { ...state, gate2: { ...state.gate2, ...live, instance: { data: action.data, ...timing } } };
        case 3:
          return { ...state, gate3: { ...state.gate3, ...live, instance: { data: action.data, ...timing } } };
        case 4:
          return { ...state, gate4: { ...state.gate4, ...live, instance: { data: action.data, ...timing } } };
      }
      return state;
    }

    case "instance/requestError": {
      const { status, error } = action;
      return updateSlot(state, action.gate, (slot) => ({
        ...slot,
        status,
        op: "request",
        instance: null,
        error,
      }));
    }

    case "instance/submitStart": {
      return updateSlot(state, action.gate, (slot) => ({
        ...slot,
        status: "loading",
        op: "submit",
        result: null,
        error: null,
      }));
    }

    case "instance/submitSuccess": {
      const res = action.result;
      const next = updateSlot(state, action.gate, (slot) => ({
        ...slot,
        status: res.success ? "accepted" : "rejected",
        op: null,
        result: res,
        error: null,
      }));
      return res.flag ? { ...next, flag: autoFillFlag(next.flag, res.flag) } : next;
    }

    case "instance/submitError": {
      const { status, error } = action;
      return updateSlot(state, action.gate, (slot) => ({
        ...slot,
        status,
        op: "submit",
        error,
      }));
    }

    case "instance/fieldError": {
      const { error } = action;
      return updateSlot(state, action.gate, (slot) => ({ ...slot, fieldError: error }));
    }

    case "instance/expired": {
      const current = getInstanceSlot(state, action.gate);
      if (!current.instance || current.instance.expired) return state;
      const expiryAnnounced = action.announced ?? false;

      return updateSlot(state, action.gate, (slot) =>
        slot.instance
          ? {
              ...slot,
              status: slot.status === "live" ? "expired" : slot.status,
              instance: { ...slot.instance, expired: true, expiryAnnounced },
            }
          : slot
      );
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
          agent: null,
          proofBadge: null,
          error: null,
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
          recordedHandle: action.data.agent?.agentName ?? null,
          agent: action.data.agent ?? null,
          proofBadge: action.data.proofBadge ?? null,
          error: null,
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
          agent: null,
          proofBadge: null,
          error: null,
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
          recordedHandle: null,
          agent: null,
          proofBadge: null,
          error: action.error,
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
          agent: null,
          proofBadge: null,
          error: null,
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
