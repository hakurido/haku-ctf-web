"use client";

import React, { useEffect } from "react";
import { Button } from "../ui/Button";
import { StatusMessage } from "../ui/StatusMessage";
import { FlagForm } from "../flag/FlagForm";
import { StandingsTable } from "./StandingsTable";
import { useAppState } from "../state/AppStateProvider";
import { GATES } from "@/lib/gates";
import { formatPoints, formatTime, serverErrorLabel } from "@/lib/format";

const POINTS = GATES.map((g) => formatPoints(g.points));
const TOTAL = formatPoints(GATES.reduce((sum, g) => sum + g.points, 0));
const INTRO = `Agent handles ranked by score. Gates are worth ${POINTS.slice(0, -1).join(", ")}, and ${POINTS[POINTS.length - 1]} points, for ${TOTAL} in total.`;

export function ScoreboardView() {
  const { state, loadScoreboard } = useAppState();
  const { scoreboard } = state;

  // loadScoreboard has a stable identity, so this runs once per mount (R-01).
  useEffect(() => {
    void loadScoreboard();
  }, [loadScoreboard]);

  const isBusy = scoreboard.status === "loading";
  const failed = scoreboard.status === "server-error" || scoreboard.status === "network-error";
  const hasRows = scoreboard.entries !== null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-page-title font-semibold text-fg">Scoreboard</h1>
          <p className="text-ui text-fg-secondary mt-1">{INTRO}</p>
          <p className="text-ui text-fg-muted mt-1">
            The scoreboard is kept in server memory, so it resets when the server restarts, and
            each server instance keeps its own list, which means a flag you just submitted may not
            appear here.
          </p>
        </div>

        <div className="shrink-0">
          <Button variant="secondary" size="md" busy={isBusy} onClick={() => void loadScoreboard()}>
            {isBusy ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <FlagForm variant="page" headingId="flag-form-heading" />
      </div>

      <section aria-labelledby="standings-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 id="standings-heading" className="text-heading font-semibold text-fg">
            Standings
          </h2>
          {scoreboard.loadedAt !== null && (
            <p className="text-ui text-fg-muted">Loaded at {formatTime(scoreboard.loadedAt)}</p>
          )}
        </div>

        {failed && (
          <StatusMessage
            tone="error"
            badgeLabel={scoreboard.status === "network-error" ? "Not sent" : serverErrorLabel(scoreboard.error)}
            badgeIcon={scoreboard.status === "network-error" ? "network-error" : "server-error"}
            className="mb-4"
          >
            <h3 className="font-semibold text-fg mb-1">{"Couldn't load the scoreboard"}</h3>
            <p className="text-fg">
              {scoreboard.status === "network-error"
                ? "The request didn't reach the server. Check your connection and try again."
                : scoreboard.error?.message}
            </p>
            {hasRows && scoreboard.loadedAt !== null && (
              <p className="text-fg-secondary mt-1">
                The rows below are from the last successful load at {formatTime(scoreboard.loadedAt)}.
              </p>
            )}
          </StatusMessage>
        )}

        <StandingsTable
          entries={scoreboard.entries}
          busy={isBusy}
          // The empty state means "loaded and empty", never "failed" (R-09).
          showEmpty={scoreboard.status === "loaded"}
          labelledBy="standings-heading"
        />
      </section>
    </div>
  );
}
