"use client";

import { useState, useTransition } from "react";
import { recordEvent } from "./actions";

const EVENT_TYPES = [
  { value: "goal", label: "Goal" },
  { value: "own_goal", label: "Own Goal" },
  { value: "yellow_card", label: "Yellow Card" },
  { value: "red_card", label: "Red Card" },
];

export default function RecordEventForm({
  matchId,
  lineupPlayers,
}: {
  matchId: string;
  lineupPlayers: { id: string; full_name: string; alias: string | null; teamName: string }[];
}) {
  const [eventType, setEventType] = useState("goal");
  const [playerId, setPlayerId] = useState(lineupPlayers[0]?.id ?? "");
  const [minute, setMinute] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (lineupPlayers.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Set both teams&apos; lineups before recording events.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Generated once per submit attempt so a network-level retry of this
    // same request reuses it -- record_match_event() then treats a
    // resubmission as a no-op instead of a second event.
    const dedupKey = crypto.randomUUID();
    startTransition(async () => {
      try {
        await recordEvent(matchId, playerId, eventType, minute ? Number(minute) : null, dedupKey);
        setMinute("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Event
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Player
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {lineupPlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
              {p.alias ? ` "${p.alias}"` : ""} ({p.teamName})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Minute (optional)
        <input
          type="number"
          min={0}
          max={130}
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          className="w-20 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-primary hover:bg-primary-hover px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
      >
        {isPending ? "Recording..." : "Record event"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
