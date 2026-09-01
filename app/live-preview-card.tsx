"use client";

import { useState } from "react";

const TABS = ["Standings", "Top Scorers", "Fixtures"] as const;
type Tab = (typeof TABS)[number];

const STANDINGS = [
  { name: "Warriors FC", pts: 19 },
  { name: "Falcons United", pts: 17 },
  { name: "Delta Rangers", pts: 14 },
];

const SCORERS = [
  { name: "Chidi O.", value: "11 goals", verified: true },
  { name: "Ade K.", value: "6 goals", verified: false },
  { name: "Musa T.", value: "5 goals", verified: true },
];

const FIXTURES = [
  { home: "Warriors FC", away: "Falcons United", when: "Sat, 4pm", verified: true },
  { home: "Delta Rangers", away: "Coastal FC", when: "Sun, 2pm", verified: false },
];

function Badge({ verified }: { verified: boolean }) {
  return (
    <span
      className={
        verified
          ? "rounded-full bg-[#2FBE81] px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#052014]"
          : "rounded-full border border-[#2FBE81]/50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#8FA89C]"
      }
    >
      {verified ? "VERIFIED" : "PENDING"}
    </span>
  );
}

export default function LivePreviewCard() {
  const [tab, setTab] = useState<Tab>("Standings");

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B0F0D]/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex gap-6 border-b border-white/10 pb-3 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              t === tab
                ? "border-b-2 border-[#2FBE81] pb-3 -mb-3 font-medium text-[#EAF3EE]"
                : "text-[#8FA89C] hover:text-[#EAF3EE]"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm">
        {tab === "Standings" &&
          STANDINGS.map((s, i) => (
            <div key={s.name} className="flex items-center justify-between">
              <span>
                {i + 1}. {s.name}
              </span>
              <span className="font-semibold">{s.pts} pts</span>
            </div>
          ))}

        {tab === "Top Scorers" &&
          SCORERS.map((s) => (
            <div key={s.name} className="flex items-center justify-between">
              <span>
                {s.name} — {s.value}
              </span>
              <Badge verified={s.verified} />
            </div>
          ))}

        {tab === "Fixtures" &&
          FIXTURES.map((f, i) => (
            <div key={i} className="flex items-center justify-between">
              <span>
                {f.home} vs {f.away}
                <span className="ml-2 text-[#8FA89C]">{f.when}</span>
              </span>
              <Badge verified={f.verified} />
            </div>
          ))}
      </div>

      <p className="mt-5 text-[10px] tracking-wide text-[#8FA89C]/70">
        Example data — your competition&apos;s real standings appear here once matches are played.
      </p>
    </div>
  );
}
