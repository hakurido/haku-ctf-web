"use client";

import React, { useEffect, useRef } from "react";
import { useAppState } from "../state/AppStateProvider";

export function ConsoleView() {
  const { state, setField, runConsole, loadScoreboard } = useAppState();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.scoreboard.entries === null) {
      loadScoreboard();
    }
  }, [state.scoreboard.entries, loadScoreboard]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [state.console.history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runConsole();
  };

  return (
    <div className="space-y-4">
      <div className="pb-4 border-b border-line">
        <h1 className="text-page-title font-semibold text-fg">Console</h1>
        <p className="text-ui text-fg-secondary mt-1">
          Interactive command interface for checking gates, standings, and directives.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-inset p-4 sm:p-5 flex flex-col h-[520px]">
        <div
          role="log"
          aria-label="Console output"
          className="flex-1 overflow-y-auto space-y-2 font-mono text-code pr-2"
        >
          {state.console.history.map((entry) => (
            <div key={entry.id} className="whitespace-pre-wrap">
              {entry.command && (
                <div className="text-fg-muted select-none">
                  $ <span className="text-fg select-all">{entry.command}</span>
                </div>
              )}
              <div
                className={
                  entry.tone === "error" ? "text-error font-medium" : "text-fg-secondary"
                }
              >
                {entry.output}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-3 pt-3 border-t border-line flex items-center gap-2 font-mono text-code"
        >
          <label htmlFor="console-cmd" className="text-accent font-bold select-none">
            $&gt;
          </label>
          <input
            id="console-cmd"
            type="text"
            value={state.console.input}
            onChange={(e) => setField("console.input", e.target.value)}
            placeholder="Type 'help', 'gates', 'solve 2', or 'leaderboard'..."
            className="flex-1 bg-transparent text-fg placeholder:text-fg-muted focus-visible:outline-none text-code"
          />
        </form>
      </div>
    </div>
  );
}
