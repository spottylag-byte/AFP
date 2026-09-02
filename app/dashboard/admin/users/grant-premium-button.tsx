"use client";

import { useState, useTransition } from "react";
import { grantPremium } from "./actions";

export default function GrantPremiumButton({
  organizerId,
  isPremium,
}: {
  organizerId: string;
  isPremium: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await grantPremium(organizerId, 1);
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
        className="rounded border border-accent px-2 py-1 text-xs font-medium text-accent-hover disabled:opacity-50"
      >
        {isPending ? "Granting..." : isPremium ? "Extend premium (+1mo)" : "Grant premium (1mo)"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
