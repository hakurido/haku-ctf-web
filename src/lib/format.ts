export function formatPoints(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatClause(c: readonly number[]): string {
  return `(${c.join(" ∨ ")})`;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toTimeString().split(" ")[0];
}

export function formatResponseJson(v: unknown): string {
  return JSON.stringify(
    v,
    (_, val) => {
      if (Array.isArray(val) && val.every((x) => typeof x !== "object" || x === null)) {
        return val;
      }
      return val;
    },
    2
  );
}
