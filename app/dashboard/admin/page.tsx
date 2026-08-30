import { requireRole } from "@/lib/auth";

export default async function AdminDashboard() {
  const { fullName } = await requireRole("platform_admin");

  return (
    <div>
      <h1 className="text-xl font-semibold">Admin dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {fullName}. Verification and audit tools land in Phase 8.
      </p>
    </div>
  );
}
