"use client";

import { useState, useTransition } from "react";
import { assignMatchOperator } from "./actions";

export default function AssignOperatorForm({
  competitionId,
  matchId,
  operators,
}: {
  competitionId: string;
  matchId: string;
  operators: { id: string; full_name: string }[];
}) {
  const [operatorId, setOperatorId] = useState(operators[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (operators.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No match operator accounts registered yet.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await assignMatchOperator(competitionId, matchId, operatorId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <select
        value={operatorId}
        onChange={(e) => setOperatorId(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      >
        {operators.map((o) => (
          <option key={o.id} value={o.id}>
            {o.full_name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
      >
        {isPending ? "Assigning..." : "Assign operator"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
