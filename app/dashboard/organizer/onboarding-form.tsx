"use client";

import { useState, useTransition } from "react";
import { createOrganizerProfile } from "./actions";

export default function OnboardingForm() {
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createOrganizerProfile(organizationName);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-medium">Set up your organization</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        One-time setup before you can create a competition.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Organization name
          <input
            required
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-primary hover:bg-primary-hover px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
        >
          {isPending ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
