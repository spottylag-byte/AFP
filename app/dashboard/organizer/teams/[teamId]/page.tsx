import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PlayerRegistrationForm from "@/components/player-registration-form";
import PlayerPhotoUpload from "@/components/player-photo-upload";
import PlayerVideoManager from "@/components/player-video-manager";

export default async function OrganizerTeamRosterPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { user } = await requireRole("organizer");
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, team_manager_profile_id")
    .eq("id", teamId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!team || team.team_manager_profile_id !== user.id) {
    notFound();
  }

  const { data: roster } = await supabase
    .from("team_players")
    .select(
      "joined_at, players(id, full_name, alias, date_of_birth, photo_url, football_id_id, football_ids(code))"
    )
    .eq("team_id", team.id)
    .is("left_at", null)
    .order("joined_at", { ascending: false });

  type RosterRow = {
    joined_at: string;
    players: {
      id: string;
      full_name: string;
      alias: string | null;
      date_of_birth: string;
      photo_url: string | null;
      football_ids: { code: string } | null;
    } | null;
  };

  const rosterRows = (roster ?? []) as unknown as RosterRow[];

  const playerIds = rosterRows.map((r) => r.players?.id).filter((id): id is string => Boolean(id));
  const { data: videoRows } = playerIds.length
    ? await supabase.from("player_videos").select("id, player_id, video_url, caption").in("player_id", playerIds)
    : { data: [] as { id: string; player_id: string; video_url: string; caption: string | null }[] };
  const videosByPlayer = new Map<string, { id: string; video_url: string; caption: string | null }[]>();
  for (const v of videoRows ?? []) {
    const list = videosByPlayer.get(v.player_id) ?? [];
    list.push({ id: v.id, video_url: v.video_url, caption: v.caption });
    videosByPlayer.set(v.player_id, list);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{team.name} — roster</h1>
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
          <PlayerRegistrationForm
            teamId={team.id}
            revalidatePathTarget={`/dashboard/organizer/teams/${team.id}`}
          />
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
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.players?.full_name}
                      {r.players?.alias ? ` (${r.players.alias})` : ""}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Born {r.players?.date_of_birth} · {r.players?.football_ids?.code}
                    </p>
                  </div>
                  {r.players && (
                    <PlayerPhotoUpload
                      playerId={r.players.id}
                      fullName={r.players.full_name}
                      photoUrl={r.players.photo_url}
                    />
                  )}
                </div>
                {r.players && (
                  <div className="mt-2">
                    <PlayerVideoManager
                      playerId={r.players.id}
                      initialVideos={videosByPlayer.get(r.players.id) ?? []}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
