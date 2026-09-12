import Link from "next/link";

export const metadata = { title: "Privacy Policy — Soccer Point" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-sm leading-relaxed">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="underline">
          Soccer Point
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-1 text-zinc-500">Last updated: {new Date().getFullYear()}</p>

      <div className="mt-6 flex flex-col gap-4 text-zinc-700 dark:text-zinc-300">
        <p>
          Soccer Point records match results, player statistics, and related profile
          information (name, alias, photo, video, and general location) to build a verified
          record of grassroots football competitions. This page explains what we collect,
          why, and what stays private.
        </p>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">What we collect</h2>
          <p className="mt-1">
            Account details (name, email, role), team and competition data entered by
            organizers and team managers, match events recorded during games, and — only
            when someone chooses to add it — a player&apos;s photo, video clips, position,
            height, preferred foot, and general location (country/city, never a precise
            address).
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            What&apos;s never shown publicly
          </h2>
          <p className="mt-1">
            A player&apos;s date of birth is stored to compute age and check eligibility,
            but is never displayed on any public page. Only three trust badges — Verified,
            Pending, Unverified — are ever shown; the underlying five-level internal
            verification status is admin-only.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Players who are minors
          </h2>
          <p className="mt-1">
            Many grassroots players are under 18. A player&apos;s photo or video is uploaded
            only by their team manager, organizer, or platform admin — never uploaded by a
            scout or any account without a legitimate roster relationship to that player.
            Scout accounts require admin approval before they can search the platform at
            all, specifically to reduce the risk of people posing as scouts or agents. If a
            player has their own account, they can confirm that a photo or video uploaded
            about them is genuinely theirs, but they cannot upload one directly.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            What we don&apos;t do
          </h2>
          <p className="mt-1">
            Soccer Point does not run third-party advertising or behavioral tracking, and
            we don&apos;t sell player data. We don&apos;t facilitate transfers, contracts, or
            payments between players and scouts/agents — any such arrangement happens
            entirely outside the platform, between the parties involved.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Data requests</h2>
          <p className="mt-1">
            To request a correction, removal of a photo/video, or a copy of data held about
            a specific player or account, contact the competition&apos;s organizer or the
            platform admin directly.
          </p>
        </div>
      </div>
    </main>
  );
}
