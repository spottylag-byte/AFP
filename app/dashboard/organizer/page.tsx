import { requireRole } from "@/lib/auth";

export default async function OrganizerDashboard() {
  const { fullName } = await requireRole("organizer");

  return (
    <div>
      <h1 className="text-xl font-semibold">Organizer dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {fullName}. Competition creation and management lands in
        Phase 3.
      </p>
    </div>
  );
}
