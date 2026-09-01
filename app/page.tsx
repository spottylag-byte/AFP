import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import LivePreviewCard from "./live-preview-card";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

const steps = [
  {
    n: "1",
    title: "Create a competition",
    body: "Set up your league or cup, pay the one-time onboarding fee, and you're live.",
  },
  {
    n: "2",
    title: "Register teams & players",
    body: "Onboard teams yourself or let them join — every player gets a permanent Football ID.",
  },
  {
    n: "3",
    title: "Record matches",
    body: "Log events from the Match Center or WhatsApp. Stats build themselves as you play.",
  },
];

const badges = [
  {
    label: "VERIFIED",
    tone: "bg-[#2FBE81] text-[#052014]",
    body: "Confirmed by an organizer, or auto-promoted after 48–72 hours with no dispute.",
  },
  {
    label: "PENDING",
    tone: "border border-[#2FBE81]/50 text-[#8FA89C]",
    body: "Recorded from a live match, waiting on the verification window to close.",
  },
  {
    label: "UNVERIFIED",
    tone: "border border-white/15 text-[#8FA89C]",
    body: "Self-reported only — not yet confirmed by anyone else at the match.",
  },
];

export default function Home() {
  return (
    <div
      className={`${display.variable} relative min-h-screen overflow-hidden bg-[#070c09] text-[#EAF3EE]`}
    >
      {/* artistic glow blobs */}
      <div className="pointer-events-none absolute -top-32 right-[-10%] h-[32rem] w-[32rem] rounded-full bg-[#2FBE81] opacity-20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 left-[-15%] h-[26rem] w-[26rem] rounded-full bg-[#d97706] opacity-10 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[20rem] w-[20rem] rounded-full bg-[#2FBE81] opacity-10 blur-[100px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <nav className="flex items-center justify-between border-b border-white/10 py-6">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#2FBE81]" />
            <span
              className={`${display.className} truncate text-base font-bold sm:text-lg`}
            >
              African Football Platform
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm sm:gap-6">
            <a href="#how-it-works" className="hidden text-[#8FA89C] hover:text-[#EAF3EE] md:inline">
              How it works
            </a>
            <a href="#verification" className="hidden text-[#8FA89C] hover:text-[#EAF3EE] md:inline">
              Verification
            </a>
            <Link href="/login" className="whitespace-nowrap text-[#EAF3EE] hover:text-[#2FBE81]">
              Log in
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-full bg-white px-4 py-2 font-medium text-[#070c09] hover:bg-zinc-100 sm:px-5"
            >
              Sign up
            </Link>
          </div>
        </nav>

        <section className="grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#2FBE81]">
              NIGERIA · GRASSROOTS FOOTBALL
            </p>
            <h1
              className={`${display.className} mt-4 text-4xl font-bold leading-tight sm:text-5xl`}
            >
              A verified record for every{" "}
              <span className="bg-gradient-to-r from-[#4ade80] to-[#fbbf24] bg-clip-text text-transparent">
                player.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-[#8FA89C]">
              Run your grassroots competition digitally — teams, fixtures, results — and
              every match becomes part of a permanent, trustworthy record.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-r from-[#4ade80] to-[#22c55e] px-6 py-3 text-sm font-semibold text-[#052014] hover:opacity-90"
              >
                Start a competition
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-[#EAF3EE] hover:bg-white/5"
              >
                See how it works
              </a>
            </div>
          </div>

          <LivePreviewCard />
        </section>

        <section id="how-it-works" className="border-t border-white/10 py-20">
          <h2 className={`${display.className} text-2xl font-bold`}>How it works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#4ade80] to-[#d97706] text-sm font-bold text-[#052014]">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-[#8FA89C]">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="verification" className="border-t border-white/10 py-20">
          <h2 className={`${display.className} text-2xl font-bold`}>
            Statistics you can trust
          </h2>
          <p className="mt-2 max-w-lg text-sm text-[#8FA89C]">
            No one edits a stat directly — every number traces back to a match event, and
            every event carries one of three badges.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {badges.map((b) => (
              <div key={b.label} className="rounded-2xl border border-white/10 p-5">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${b.tone}`}
                >
                  {b.label}
                </span>
                <p className="mt-3 text-sm text-[#8FA89C]">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col items-center gap-4 border-t border-white/10 py-16 text-center">
          <p className={`${display.className} text-xl font-semibold`}>
            Ready to run your competition digitally?
          </p>
          <Link
            href="/register"
            className="rounded-full bg-gradient-to-r from-[#4ade80] to-[#22c55e] px-6 py-3 text-sm font-semibold text-[#052014] hover:opacity-90"
          >
            Get started — it&apos;s free to join
          </Link>
        </footer>
      </div>
    </div>
  );
}
