"use client";

import { useState, useTransition } from "react";
import { createFixture } from "./actions";

export default function CreateFixtureForm({
  competitionId,
  enteredTeams,
}: {
  competitionId: string;
  enteredTeams: { id: string; name: string }[];
}) {
  const [homeTeamId, setHomeTeamId] = useState(enteredTeams[0]?.id ?? "");
  const [awayTeamId, setAwayTeamId] = useState(enteredTeams[1]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (enteredTeams.length < 2) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Add at least two teams to this competition before scheduling a fixture.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (homeTeamId === awayTeamId) {
      setError("Home and away teams must be different");
      return;
    }

    startTransition(async () => {
      try {
        await createFixture(
          competitionId,
          homeTeamId,
          awayTeamId,
          new Date(scheduledAt).toISOString()
        );
        setScheduledAt("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Home team
        <select
          value={homeTeamId}
          onChange={(e) => setHomeTeamId(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {enteredTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Away team
        <select
          value={awayTeamId}
          onChange={(e) => setAwayTeamId(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {enteredTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Kick-off
        <input
          required
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-primary hover:bg-primary-hover px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
      >
        {isPending ? "Scheduling..." : "Schedule fixture"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
