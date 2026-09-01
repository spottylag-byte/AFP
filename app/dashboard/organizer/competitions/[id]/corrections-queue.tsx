"use client";

import { useState, useTransition } from "react";
import { approveCorrection, rejectCorrection } from "./actions";

const EVENT_TYPES = [
  { value: "goal", label: "Goal" },
  { value: "own_goal", label: "Own Goal" },
  { value: "yellow_card", label: "Yellow Card" },
  { value: "red_card", label: "Red Card" },
];

export type PendingCorrection = {
  id: string;
  reason: string;
  evidence_url: string | null;
  requested_by_name: string;
  original_event_type: string;
  original_player_name: string | null;
  original_minute: number | null;
  lineup_players: { id: string; full_name: string }[];
};

function CorrectionItem({
  competitionId,
  correction,
}: {
  competitionId: string;
  correction: PendingCorrection;
}) {
  const [action, setAction] = useState<"none" | "approve" | "reject">("none");
  const [correctedType, setCorrectedType] = useState<string>("void");
  const [correctedPlayerId, setCorrectedPlayerId] = useState(
    correction.lineup_players[0]?.id ?? ""
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <li className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        Correction {done}.
      </li>
    );
  }

  function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await approveCorrection(
          competitionId,
          correction.id,
          correctedType === "void" ? null : correctedType,
          correctedType === "void" ? null : correctedPlayerId,
          notes
        );
        setDone("approved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await rejectCorrection(competitionId, correction.id, notes);
        setDone("rejected");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <li className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p className="font-medium">
        {correction.original_event_type.replace("_", " ")}
        {correction.original_player_name ? ` · ${correction.original_player_name}` : ""}
        {correction.original_minute !== null ? ` (${correction.original_minute}')` : ""}
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">
        Flagged by {correction.requested_by_name}: &quot;{correction.reason}&quot;
      </p>

      {action === "none" && (
        <div className="mt-2 flex gap-3">
          <button
            onClick={() => setAction("approve")}
            className="rounded bg-primary hover:bg-primary-hover px-3 py-1 text-xs text-white dark:bg-primary dark:hover:bg-primary-hover"
          >
            Approve
          </button>
          <button
            onClick={() => setAction("reject")}
            className="rounded border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
          >
            Reject
          </button>
        </div>
      )}

      {action === "approve" && (
        <form onSubmit={handleApprove} className="mt-2 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs">
            Correction
            <select
              value={correctedType}
              onChange={(e) => setCorrectedType(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="void">Void (remove entirely, no replacement)</option>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  Correct to: {t.label}
                </option>
              ))}
            </select>
          </label>
          {correctedType !== "void" && (
            <label className="flex flex-col gap-1 text-xs">
              Corrected player
              <select
                value={correctedPlayerId}
                onChange={(e) => setCorrectedPlayerId(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {correction.lineup_players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Review notes (optional)"
            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-primary hover:bg-primary-hover px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
            >
              {isPending ? "Approving..." : "Confirm approval"}
            </button>
            <button
              type="button"
              onClick={() => setAction("none")}
              className="rounded border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {action === "reject" && (
        <form onSubmit={handleReject} className="mt-2 flex flex-col gap-2">
          <input
            required
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for rejecting (required)"
            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-primary hover:bg-primary-hover px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
            >
              {isPending ? "Rejecting..." : "Confirm rejection"}
            </button>
            <button
              type="button"
              onClick={() => setAction("none")}
              className="rounded border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </li>
  );
}

export default function CorrectionsQueue({
  competitionId,
  corrections,
}: {
  competitionId: string;
  corrections: PendingCorrection[];
}) {
  if (corrections.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">None pending.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {corrections.map((c) => (
        <CorrectionItem key={c.id} competitionId={competitionId} correction={c} />
      ))}
    </ul>
  );
}
