"use client";

import { useState, useTransition } from "react";
import { addTeamToCompetition } from "./actions";

export default function AddTeamForm({
  competitionId,
  availableTeams,
}: {
  competitionId: string;
  availableTeams: { id: string; name: string }[];
}) {
  const [teamId, setTeamId] = useState(availableTeams[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (availableTeams.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No more teams available to add.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addTeamToCompetition(competitionId, teamId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Team
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {availableTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Adding..." : "Add team"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
