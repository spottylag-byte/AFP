"use client";

import { useState, useTransition } from "react";
import { changeUserRole } from "./actions";
import type { UserRole } from "@/lib/roles";

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: "platform_admin", label: "Admin" },
  { value: "organizer", label: "Organizer" },
  { value: "team_manager", label: "Team Manager" },
  { value: "match_operator", label: "Match Operator" },
  { value: "player", label: "Player" },
  { value: "scout", label: "Scout" },
];

export default function RoleChangeForm({
  profileId,
  currentRole,
}: {
  profileId: string;
  currentRole: UserRole;
}) {
  const [role, setRole] = useState<UserRole>(currentRole);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChange(newRole: UserRole) {
    setRole(newRole);
    setConfirming(newRole !== currentRole);
    setError(null);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await changeUserRole(profileId, role);
        setConfirming(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setRole(currentRole);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value as UserRole)}
        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
      >
        {ALL_ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {confirming && (
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {isPending ? "Saving..." : "Confirm"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
