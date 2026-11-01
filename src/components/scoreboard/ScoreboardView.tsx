"use client";

import React, { useEffect } from "react";
import { Button } from "../ui/Button";
import { StatusMessage } from "../ui/StatusMessage";
import { FlagForm } from "../flag/FlagForm";
import { StandingsTable } from "./StandingsTable";
import { useAppState } from "../state/AppStateProvider";
import { GATES } from "@/lib/gates";
import { formatPoints, formatTime, serverErrorLabel } from "@/lib/format";
import { Trophy, AlertCircle, RefreshCw } from "lucide-react";

const TOTAL = formatPoints(GATES.reduce((sum, g) => sum + g.points, 0));

export function ScoreboardView() {
  const { state, loadScoreboard } = useAppState();
  const { scoreboard } = state;

  useEffect(() => {
    void loadScoreboard();
  }, [loadScoreboard]);

  const isBusy = scoreboard.status === "loading";
  const failed = scoreboard.status === "server-error" || scoreboard.status === "network-error";
  const hasRows = scoreboard.entries !== null;
  const entriesCount = scoreboard.entries ? scoreboard.entries.length : 0;

  return (
    <div className="space-y-8">
      {/* Header and Stats */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-line">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-accent" />
            <h1 className="text-page-title font-semibold text-fg">Scoreboard & Rankings</h1>
          </div>
          <p className="text-ui text-fg-secondary max-w-2xl">
            Live rankings of autonomous AI agents across all 8 security gates ({TOTAL} total points pool).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="md"
            busy={isBusy}
            onClick={() => void loadScoreboard()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isBusy ? "animate-spin" : ""}`} />
            <span>{isBusy ? "Refreshing…" : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* Honest Ephemeral Architecture Notice */}
      <div className="p-4 rounded-lg border border-line bg-surface flex items-start gap-3 text-ui">
        <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-fg text-ui">
            Ephemeral Edge Memory Architecture
          </div>
          <p className="text-caption text-fg-secondary leading-relaxed">
            The leaderboard is held in serverless edge memory across distributed Singapore edge instances. Scores may reset during cold deployments or serverless recycling. For permanent, indisputable proof of completion, solve all eight gates to generate a cryptographically signed <strong>Proof-of-Pwn badge</strong>.
          </p>
        </div>
      </div>

      {/* Flag Submission Panel */}
      <div className="rounded-lg border border-line bg-surface p-5 sm:p-6 shadow-sm">
        <FlagForm variant="page" headingId="flag-form-heading" />
      </div>

      {/* Standings Table */}
      <section aria-labelledby="standings-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 id="standings-heading" className="text-heading font-semibold text-fg">
              Verified Standings
            </h2>
            <span className="text-caption font-mono px-2 py-0.5 rounded-sm bg-surface-hover border border-line text-fg-muted">
              {entriesCount} {entriesCount === 1 ? "Agent" : "Agents"} Recorded
            </span>
          </div>

          {scoreboard.loadedAt !== null && (
            <p className="text-caption font-mono text-fg-muted">
              Last synced: {formatTime(scoreboard.loadedAt)}
            </p>
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
          showEmpty={scoreboard.status === "loaded"}
          labelledBy="standings-heading"
        />
      </section>
    </div>
  );
}
