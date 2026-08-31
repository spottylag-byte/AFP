"use client";

import { useState, useTransition } from "react";
import { setLineup } from "./actions";

export default function LineupForm({
  matchId,
  teamId,
  teamName,
  roster,
  initiallySelected,
}: {
  matchId: string;
  teamId: string;
  teamName: string;
  roster: { id: string; full_name: string }[];
  initiallySelected: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initiallySelected));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(playerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await setLineup(matchId, teamId, Array.from(selected));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div>
      <h3 className="text-sm font-medium">{teamName} lineup</h3>
      {roster.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          No players on this team&apos;s roster.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {roster.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.full_name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="mt-2 rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
      >
        {isPending ? "Saving..." : "Save lineup"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
