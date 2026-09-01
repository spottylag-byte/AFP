"use client";

import { useState, useTransition } from "react";
import { setUserDeactivated } from "./actions";

export default function DeactivateButton({
  profileId,
  deactivated,
}: {
  profileId: string;
  deactivated: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !deactivated &&
      !window.confirm("Deactivate this account? They will be signed out and unable to log in.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await setUserDeactivated(profileId, !deactivated);
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
        className={
          deactivated
            ? "rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
            : "rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-500"
        }
      >
        {isPending ? "Working..." : deactivated ? "Reactivate" : "Deactivate"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
