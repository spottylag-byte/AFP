import { requireRole } from "@/lib/auth";

export default async function ScoutDashboard() {
  const { fullName } = await requireRole("scout");

  return (
    <div>
      <h1 className="text-xl font-semibold">Scout dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {fullName}. Verified-data search lands in Phase 12.
      </p>
    </div>
  );
}
