import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./onboarding-form";
import AddPlayerForm from "./add-player-form";

export default async function TeamManagerDashboard() {
  const { user, fullName } = await requireRole("team_manager");
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("team_manager_profile_id", user.id)
    .maybeSingle();

  if (!team) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Team manager dashboard</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Welcome, {fullName}.
        </p>
        <div className="mt-6">
          <OnboardingForm />
        </div>
      </div>
    );
  }

  const { data: roster } = await supabase
    .from("team_players")
    .select(
      "joined_at, players(full_name, alias, date_of_birth, football_id_id, football_ids(code))"
    )
    .eq("team_id", team.id)
    .is("left_at", null)
    .order("joined_at", { ascending: false });

  type RosterRow = {
    joined_at: string;
    players: {
      full_name: string;
      alias: string | null;
      date_of_birth: string;
      football_ids: { code: string } | null;
    } | null;
  };

  const rosterRows = (roster ?? []) as unknown as RosterRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Team manager dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {team.name} · {fullName}
      </p>
      <p className="mt-1 text-sm">
        <a
          href={`/teams/${team.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          View public page
        </a>
      </p>

      <div className="mt-8 max-w-md">
        <h2 className="text-sm font-medium text-zinc-500">Add a player</h2>
        <div className="mt-2">
          <AddPlayerForm teamId={team.id} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">
          Squad ({rosterRows.length})
        </h2>
        {rosterRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No players yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {rosterRows.map((r, i) => (
              <li
                key={i}
                className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="font-medium">
                  {r.players?.full_name}
                  {r.players?.alias ? ` (${r.players.alias})` : ""}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Born {r.players?.date_of_birth} · {r.players?.football_ids?.code}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
