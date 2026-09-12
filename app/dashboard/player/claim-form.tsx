"use client";

import { useState, useTransition } from "react";
import { claimPlayerProfile } from "./actions";

export default function ClaimForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await claimPlayerProfile(code.trim());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Your Football ID
        <input
          required
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AF-0000123"
          className="rounded border border-zinc-300 px-3 py-2 font-mono dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <p className="text-xs text-zinc-500">
        Your team manager, organizer, or the admin who registered you can give you this code
        — it's also shown on your public player page.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {isPending ? "Claiming..." : "Claim my profile"}
      </button>
    </form>
  );
}
