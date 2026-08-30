import { requireRole } from "@/lib/auth";

export default async function MatchOperatorDashboard() {
  const { fullName } = await requireRole("match_operator");

  return (
    <div>
      <h1 className="text-xl font-semibold">Match operator dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {fullName}. The Match Center lands in Phase 6.
      </p>
    </div>
  );
}
