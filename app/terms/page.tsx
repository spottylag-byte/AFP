import Link from "next/link";

export const metadata = { title: "Terms of Service — Soccer Point" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-sm leading-relaxed">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="underline">
          Soccer Point
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-1 text-zinc-500">Last updated: {new Date().getFullYear()}</p>

      <div className="mt-6 flex flex-col gap-4 text-zinc-700 dark:text-zinc-300">
        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">What Soccer Point is</h2>
          <p className="mt-1">
            A tool for running grassroots football competitions — registering teams and
            players, scheduling fixtures, and recording match events — that turns those
            events into a verified statistical record. Soccer Point is not a transfer
            marketplace, an agent marketplace, or a party to any deal between a player,
            club, scout, or agent.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Statistics are derived, never edited
          </h2>
          <p className="mt-1">
            No one — including organizers and admins — can directly set a player&apos;s
            goals, assists, or other statistics. Every number traces back to a recorded
            match event. Disputed numbers go through a correction request, reviewed by the
            organizer (and admin, if escalated); an approved correction adds a compensating
            record rather than editing history.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Photos, videos, and player identity
          </h2>
          <p className="mt-1">
            Team managers, organizers, and admins may upload a photo or short video clip to
            a player&apos;s profile. By uploading one, you confirm you have the right to
            share it and that it genuinely depicts that player. A player with their own
            account may confirm media uploaded about them is genuinely theirs; this
            confirmation does not transfer upload or deletion rights.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Scout accounts</h2>
          <p className="mt-1">
            Scout accounts require admin approval before they can search players or build
            shortlists. Contacting a player directly through information found on Soccer
            Point to arrange a trial, contract, or transfer outside a proper club, academy,
            or guardian process is against these terms.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Fees</h2>
          <p className="mt-1">
            Organizers pay a one-time onboarding fee per competition, or subscribe to a
            premium tier that waives it, as shown at the time of setup. Fees are non-transferable
            between competitions.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Contact</h2>
          <p className="mt-1">
            Questions about these terms should go to the competition&apos;s organizer or the
            platform admin.
          </p>
        </div>
      </div>
    </main>
  );
}
