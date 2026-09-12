import Link from "next/link";
import { Bebas_Neue, Work_Sans } from "next/font/google";
import Badge from "@/components/badge";
import Logo from "@/components/logo";

const display = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const body = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const steps = [
  {
    n: "1",
    title: "Create your competition",
    body: "Register teams and players in minutes, from your phone.",
  },
  {
    n: "2",
    title: "Run your matches",
    body: "Record goals, cards and subs from the app, or by a simple WhatsApp message.",
  },
  {
    n: "3",
    title: "Results confirm themselves",
    body: "Every match verifies automatically within 48 hours unless someone flags a dispute.",
  },
  {
    n: "4",
    title: "It goes public",
    body: "A shareable page with standings, top scorers and verified player profiles.",
  },
];

export default function Home() {
  return (
    <div className={`${display.variable} ${body.className} bg-chalk text-ink`}>
      <nav className="flex items-center justify-between bg-ink px-[6vw] py-5">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="text-sm font-semibold tracking-wide text-chalk">
            Soccer Point
          </span>
        </div>
        <div className="hidden items-center gap-8 sm:flex">
          <a href="#how" className="text-sm font-medium text-[#C7D0DE] hover:text-chalk">
            How it works
          </a>
          <a href="#trust" className="text-sm font-medium text-[#C7D0DE] hover:text-chalk">
            Verification
          </a>
          <Link
            href="/login"
            className="rounded border border-[#3A4A66] px-4 py-2 text-sm font-medium text-chalk hover:border-chalk"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-chalk hover:bg-primary-hover"
          >
            Sign up
          </Link>
        </div>
        <Link
          href="/register"
          className="rounded bg-primary px-4 py-2 text-sm font-semibold text-chalk hover:bg-primary-hover sm:hidden"
        >
          Sign up
        </Link>
      </nav>

      <section className="relative overflow-hidden bg-ink px-[6vw]">
        <svg
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.16]"
          viewBox="0 0 1200 700"
          preserveAspectRatio="none"
        >
          <line x1="700" y1="0" x2="700" y2="700" stroke="#F6F2E9" strokeWidth="2" />
          <circle cx="700" cy="350" r="110" fill="none" stroke="#F6F2E9" strokeWidth="2" />
          <path
            d="M 1200 130 A 220 220 0 0 1 1200 570"
            fill="none"
            stroke="#F6F2E9"
            strokeWidth="2"
          />
        </svg>

        <div className="relative z-10 mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-10 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(48px,7vw,84px)] leading-[0.92] text-chalk">
              EVERY GOAL
              <br />
              COUNTED.
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg text-[#B9C3D4]">
              A digital home for grassroots football competitions across Africa — starting
              in Nigeria. Organizers run their tournament, and every result becomes a
              verified record instead of a rumor in a WhatsApp group.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded bg-primary px-6 py-3.5 text-[15.5px] font-semibold text-chalk hover:bg-primary-hover"
              >
                Start a competition
              </Link>
              <a
                href="#how"
                className="rounded border-[1.5px] border-[#445171] px-6 py-3.5 text-[15.5px] font-semibold text-chalk hover:border-chalk"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="-rotate-2 rounded-lg bg-chalk p-6 text-ink shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold tracking-wide text-ink-soft">
                LAGOS COMMUNITY CUP
              </span>
              <Badge kind="verified">VERIFIED</Badge>
            </div>
            <div className="mb-2.5 flex items-center justify-between font-[family-name:var(--font-display)] text-2xl">
              <span>WARRIORS FC</span>
              <span className="px-3 text-3xl text-primary-hover">2–1</span>
              <span>FALCONS</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-[#D8CFC0] pt-2.5 text-[12.5px] text-ink-soft">
              <span>Chidi O. 52&apos; · Femi A. 21&apos;</span>
              <span>Full time</span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap bg-pitch-deep px-[6vw] py-6">
        {[
          { num: "₦5,000", label: "Flat onboarding fee per competition — no subscriptions" },
          { num: "48HRS", label: "Matches verify automatically unless disputed" },
          { num: "2 WAYS", label: "Record events from the app or by WhatsApp" },
        ].map((s, i) => (
          <div
            key={s.num}
            className={`flex-1 min-w-[220px] px-6 py-2.5 text-chalk ${
              i > 0 ? "border-l border-white/15" : ""
            }`}
          >
            <span className="block font-[family-name:var(--font-display)] text-3xl text-accent">
              {s.num}
            </span>
            <span className="text-[13.5px] text-[#CBD9CF]">{s.label}</span>
          </div>
        ))}
      </div>

      <section id="how" className="mx-auto max-w-[1180px] px-[6vw] py-24">
        <div className="mb-14 max-w-[56ch]">
          <div className="mb-2 text-sm font-bold text-primary-hover">How it works</div>
          <h2 className="text-[clamp(32px,4vw,44px)] font-semibold text-ink">
            Four steps from kickoff to a public record
          </h2>
          <p className="mt-3 text-[16.5px] text-ink-soft">
            Nothing about running the competition changes much — the platform just
            remembers what happened.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`pr-6 ${
                i < steps.length - 1
                  ? "border-b border-[#E1D9C8] pb-7 mb-7 md:border-b-0 md:border-r md:pb-0 md:mb-0"
                  : ""
              }`}
            >
              <span className="mb-2.5 block font-[family-name:var(--font-display)] text-5xl text-pitch">
                {s.n}
              </span>
              <h3 className="mb-2 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="text-sm text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="trust" className="bg-primary text-chalk">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 px-[6vw] py-22 md:grid-cols-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(30px,4vw,42px)] leading-tight">
              NOTHING ON A PROFILE IS JUST SOMEONE&apos;S WORD.
            </h2>
            <p className="mt-4 max-w-[48ch] text-[16.5px] text-[#F3E4D4]">
              Every statistic traces back to an actual match. A player can&apos;t edit
              their own goal count — they can only ask for a correction, with evidence,
              reviewed by the organizer.
            </p>
          </div>
          <div className="flex flex-col gap-3.5">
            {[
              { name: "Chidi Okafor — 11 goals", kind: "verified" as const, label: "Verified" },
              { name: "Ade Kalu — 6 goals", kind: "pending" as const, label: "Pending" },
              { name: "Bio & personal details", kind: "unverified" as const, label: "Unverified" },
            ].map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between rounded-md border border-white/35 bg-ink/15 px-5 py-4"
              >
                <span className="text-[15px] font-semibold">{r.name}</span>
                <Badge kind={r.kind}>{r.label}</Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink px-[6vw] py-24 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(34px,5vw,52px)] text-chalk">
          RUN YOUR FIRST COMPETITION FREE.
        </h2>
        <p className="mt-3 mb-8 text-[#B9C3D4]">Pilot partners pay nothing for their first tournament.</p>
        <Link
          href="/register"
          className="inline-block rounded bg-primary px-6 py-3.5 text-[15.5px] font-semibold text-chalk hover:bg-primary-hover"
        >
          Get started
        </Link>
      </section>

      <footer className="flex flex-col items-center gap-2 bg-ink-soft px-[6vw] py-7 text-center text-[13.5px] text-[#DEE4EC]">
        <p>Soccer Point — a showcase of grassroots football talent across Africa, starting in Nigeria.</p>
        <p className="flex gap-4 text-xs text-[#B9C3D4]">
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}
