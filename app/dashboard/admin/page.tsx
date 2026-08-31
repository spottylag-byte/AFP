import Link from "next/link";
import { requireRole } from "@/lib/auth";

export default async function AdminDashboard() {
  const { fullName } = await requireRole("platform_admin");

  return (
    <div>
      <h1 className="text-xl font-semibold">Admin dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {fullName}. Verification and audit tools land in Phase 8.
      </p>
      <Link
        href="/dashboard/admin/players/new"
        className="mt-4 inline-block rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
      >
        Register a player
      </Link>
    </div>
  );
}
