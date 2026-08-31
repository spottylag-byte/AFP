"use client";

import { useState, useTransition } from "react";
import { verifyAndPublishMatch } from "./actions";

export default function VerifyPublishButton({
  competitionId,
  matchId,
}: {
  competitionId: string;
  matchId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await verifyAndPublishMatch(competitionId, matchId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Publishing..." : "Verify & publish"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
