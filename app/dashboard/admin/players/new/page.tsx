import { requireRole } from "@/lib/auth";
import PlayerRegistrationForm from "@/components/player-registration-form";

export default async function NewPlayerPage() {
  await requireRole("platform_admin");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold">Register a player</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Creates a permanent Football ID. We check for likely duplicates
        first — never auto-merged, always a human call.
      </p>
      <div className="mt-6">
        <PlayerRegistrationForm revalidatePathTarget="/dashboard/admin/players/new" />
      </div>
    </div>
  );
}
