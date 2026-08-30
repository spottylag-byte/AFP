import { requireRole } from "@/lib/auth";

export default async function PlayerDashboard() {
  const { fullName } = await requireRole("player");

  return (
    <div>
      <h1 className="text-xl font-semibold">Player dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {fullName}. Profile claim and verified stats land in later
        phases.
      </p>
    </div>
  );
}
