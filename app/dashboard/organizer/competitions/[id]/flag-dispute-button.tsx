"use client";

import { useState, useTransition } from "react";
import { flagDispute } from "./actions";

export default function FlagDisputeButton({
  competitionId,
  eventId,
}: {
  competitionId: string;
  eventId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (flagged) {
    return <p className="text-xs text-amber-700 dark:text-amber-500">Disputed</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs underline text-zinc-500"
      >
        Flag dispute
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await flagDispute(competitionId, eventId, reason);
        setFlagged(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-1">
      <input
        required
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for dispute"
        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {isPending ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
