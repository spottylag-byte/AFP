import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PlayerAvatar from "@/components/player-avatar";
import ClaimForm from "./claim-form";
import { ConfirmPhotoButton, ConfirmVideoButton } from "./confirm-buttons";

export default async function PlayerDashboard() {
  const { user, fullName } = await requireRole("player");
  const supabase = await createClient();

  const { data: player } = await supabase
    .from("players")
    .select(
      "id, full_name, alias, photo_url, photo_confirmed_by_player, football_ids(code)"
    )
    .eq("profile_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  type Player = {
    id: string;
    full_name: string;
    alias: string | null;
    photo_url: string | null;
    photo_confirmed_by_player: boolean;
    football_ids: { code: string } | null;
  };
  const p = player as unknown as Player | null;

  if (!p) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Player dashboard</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Welcome, {fullName}.</p>
        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-500">Claim your profile</h2>
          <p className="mt-1 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            If a team or organizer has already registered you, link your account to your
            existing Football ID below instead of getting registered twice.
          </p>
          <div className="mt-3">
            <ClaimForm />
          </div>
        </div>
      </div>
    );
  }

  const { data: statRows } = await supabase
    .from("player_competition_stats")
    .select("goals, assists, appearances, competitions(name, season)")
    .eq("player_id", p.id);

  type StatRow = {
    goals: number;
    assists: number;
    appearances: number;
    competitions: { name: string; season: string | null } | null;
  };
  const stats = (statRows ?? []) as unknown as StatRow[];

  const { data: videoRows } = await supabase
    .from("player_videos")
    .select("id, video_url, caption, confirmed_by_player")
    .eq("player_id", p.id);
  type VideoRow = {
    id: string;
    video_url: string;
    caption: string | null;
    confirmed_by_player: boolean;
  };
  const videos = (videoRows ?? []) as VideoRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Player dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Welcome, {fullName}.</p>

      <div className="mt-6 flex items-center gap-3">
        <PlayerAvatar fullName={p.full_name} photoUrl={p.photo_url} size={56} />
        <div>
          <p className="font-medium">
            {p.full_name}
            {p.alias ? ` "${p.alias}"` : ""}
          </p>
          <p className="font-mono text-sm text-zinc-500">{p.football_ids?.code}</p>
        </div>
        <Link href={`/players/${p.id}`} target="_blank" className="ml-auto text-sm underline">
          View public page
        </Link>
      </div>

      {p.photo_url && (
        <div className="mt-4">
          <h2 className="text-sm font-medium text-zinc-500">Your photo</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Uploaded by your team manager, organizer, or admin — confirm it&apos;s really you.
          </p>
          <div className="mt-2">
            {p.photo_confirmed_by_player ? (
              <span className="text-sm text-primary-hover">✓ Confirmed by you</span>
            ) : (
              <ConfirmPhotoButton playerId={p.id} />
            )}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-500">Your videos</h2>
          <div className="mt-2 flex flex-wrap gap-4">
            {videos.map((v) => (
              <div key={v.id}>
                <video
                  src={v.video_url}
                  controls
                  className="h-32 w-52 rounded bg-black object-cover"
                />
                <div className="mt-1">
                  {v.confirmed_by_player ? (
                    <span className="text-xs text-primary-hover">✓ Confirmed by you</span>
                  ) : (
                    <ConfirmVideoButton videoId={v.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Career (verified statistics)</h2>
        {stats.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No verified statistics yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {stats.map((s, i) => (
              <li key={i}>
                {s.competitions?.name}
                {s.competitions?.season ? ` (${s.competitions.season})` : ""} —{" "}
                {s.appearances} apps · {s.goals} goals · {s.assists} assists
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
