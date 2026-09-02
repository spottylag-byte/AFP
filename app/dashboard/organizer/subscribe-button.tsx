"use client";

import { useState, useTransition } from "react";
import { initiateOrganizerSubscription } from "./actions";
import { PREMIUM_MONTHLY_FEE_NGN } from "@/lib/competitions";

export default function SubscribeButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await initiateOrganizerSubscription();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      window.location.href = result.authorizationUrl;
    });
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded bg-primary px-3 py-1.5 text-sm text-chalk hover:bg-primary-hover disabled:opacity-50"
      >
        {isPending
          ? "Starting..."
          : `Upgrade to Premium — ₦${PREMIUM_MONTHLY_FEE_NGN.toLocaleString()}/mo`}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
