"use client";

import React, { useEffect, useRef } from "react";
import { useAppState } from "../state/AppStateProvider";

export function ConsoleView() {
  const { state, setField, runConsole } = useAppState();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Commands send no requests, and the console doesn't load the scoreboard
  // itself (R-15); `leaderboard` reads whatever Scoreboard last loaded.

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
          Type a command to look up gate details, solving hints, or the scoreboard as last
          loaded. Commands run in your browser and send no requests.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-inset p-4 sm:p-5 flex flex-col h-[520px]">
        <div
          role="log"
          aria-label="Console output"
          tabIndex={0}
          className="flex-1 overflow-y-auto space-y-2 font-mono text-code pr-2"
        >
          {state.console.history.map((entry) => (
            <div key={entry.id} className="whitespace-pre-wrap">
              {entry.command && (
                <div className="text-fg-muted">
                  <span aria-hidden="true" className="select-none">$ </span>
                  <span className="text-fg select-all">{entry.command}</span>
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

        <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-line">
          <label htmlFor="console-cmd" className="block text-ui font-medium text-fg mb-1.5">
            Command
          </label>
          {/* The global :focus-visible outline marks the input (R-13). */}
          <div className="flex items-center gap-2 rounded-md border border-line-control bg-canvas px-3">
            <span aria-hidden="true" className="font-mono text-code text-accent font-bold select-none">
              $
            </span>
            <input
              id="console-cmd"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby="console-cmd-hint"
              value={state.console.input}
              onChange={(e) => setField("console.input", e.target.value)}
              data-mono=""
              className="h-9 flex-1 min-w-0 bg-transparent font-mono text-code text-fg placeholder:text-fg-muted"
            />
          </div>
          <p id="console-cmd-hint" className="mt-1.5 text-ui text-fg-muted">
            Commands: help, gates, solve 1 to 4, leaderboard, clear. Letter case doesn&apos;t
            matter.
          </p>
        </form>
      </div>
    </div>
  );
}
