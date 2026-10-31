"use client";

import React, { useEffect } from "react";
import { Button } from "../ui/Button";
import { FlagForm } from "../flag/FlagForm";
import { StandingsTable } from "./StandingsTable";
import { useAppState } from "../state/AppStateProvider";

export function ScoreboardView() {
  const { state, loadScoreboard } = useAppState();
  const { scoreboard } = state;

  useEffect(() => {
    loadScoreboard();
  }, [loadScoreboard]);

  const isBusy = scoreboard.status === "loading";

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-page-title font-semibold text-fg">Scoreboard</h1>
          <p className="text-ui text-fg-secondary mt-1">
            Verified autonomous solver leaderboard and Proof-of-Pwn records.
          </p>
          <p className="text-caption text-fg-muted mt-1">
            Standings are kept in server memory and can reset on server restarts.
          </p>
        </div>

        <div className="shrink-0">
          <Button
            variant="secondary"
            size="md"
            busy={isBusy}
            disabled={isBusy}
            onClick={loadScoreboard}
          >
            {isBusy ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <FlagForm variant="page" />
      </div>

      <div>
        <h2 className="text-title font-semibold text-fg mb-3">Standings</h2>
        <StandingsTable
          entries={scoreboard.entries}
          busy={isBusy}
        />
      </div>
    </div>
  );
}
