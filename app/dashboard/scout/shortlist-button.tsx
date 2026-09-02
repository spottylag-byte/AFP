"use client";

import { useTransition } from "react";
import { toggleShortlist } from "./actions";

export default function ShortlistButton({
  playerId,
  shortlisted,
}: {
  playerId: string;
  shortlisted: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      disabled={isPending}
      onClick={() => startTransition(() => toggleShortlist(playerId))}
      className={
        shortlisted
          ? "text-lg text-accent-hover disabled:opacity-50"
          : "text-lg text-zinc-300 hover:text-accent-hover disabled:opacity-50 dark:text-zinc-600"
      }
    >
      {shortlisted ? "★" : "☆"}
    </button>
  );
}
