import { requireRole } from "@/lib/auth";

export default async function TeamManagerDashboard() {
  const { fullName } = await requireRole("team_manager");

  return (
    <div>
      <h1 className="text-xl font-semibold">Team manager dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {fullName}. Squad and roster management lands in Phase 4.
      </p>
    </div>
  );
}
