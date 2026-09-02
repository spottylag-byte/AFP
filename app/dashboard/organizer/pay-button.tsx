"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { initiateCompetitionPayment } from "./actions";
import { COMPETITION_ONBOARDING_FEE_NGN } from "@/lib/competitions";

export default function PayButton({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await initiateCompetitionPayment(competitionId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("alreadyPublished" in result) {
        router.refresh();
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
        className="rounded bg-primary hover:bg-primary-hover px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
      >
        {isPending ? "Starting payment..." : `Pay ₦${COMPETITION_ONBOARDING_FEE_NGN.toLocaleString()} to publish`}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
