"use client";

import { useState, useTransition } from "react";
import { setScoutStatus } from "./actions";

export default function ScoutStatusButtons({
  profileId,
  status,
}: {
  profileId: string;
  status: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(next: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        await setScoutStatus(profileId, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  if (status === "approved") {
    return (
      <button
        onClick={() => handle("rejected")}
        disabled={isPending}
        className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
      >
        {isPending ? "Working..." : "Revoke scout access"}
      </button>
    );
  }

  return (
    <div className="flex gap-1">
      <button
        onClick={() => handle("approved")}
        disabled={isPending}
        className="rounded border border-primary px-2 py-1 text-xs font-medium text-primary-hover disabled:opacity-50"
      >
        {isPending ? "Working..." : "Approve scout"}
      </button>
      <button
        onClick={() => handle("rejected")}
        disabled={isPending}
        className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
      >
        Reject
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
