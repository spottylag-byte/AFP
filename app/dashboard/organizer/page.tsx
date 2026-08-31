import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./onboarding-form";
import CreateCompetitionForm from "./create-competition-form";
import PayButton from "./pay-button";

export default async function OrganizerDashboard() {
  const { user, fullName } = await requireRole("organizer");
  const supabase = await createClient();

  const { data: organizer } = await supabase
    .from("organizers")
    .select("id, organization_name")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!organizer) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Organizer dashboard</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Welcome, {fullName}.
        </p>
        <div className="mt-6">
          <OnboardingForm />
        </div>
      </div>
    );
  }

  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, name, season, status, created_at")
    .eq("organizer_id", organizer.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Organizer dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {organizer.organization_name} · {fullName}
      </p>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">New competition</h2>
        <div className="mt-2">
          <CreateCompetitionForm />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Your competitions</h2>
        {!competitions || competitions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No competitions yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {competitions.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <Link
                    href={`/dashboard/organizer/competitions/${c.id}`}
                    className="font-medium underline"
                  >
                    {c.name}
                    {c.season ? ` (${c.season})` : ""}
                  </Link>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Status: {c.status}
                  </p>
                </div>
                {c.status === "draft" && <PayButton competitionId={c.id} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
