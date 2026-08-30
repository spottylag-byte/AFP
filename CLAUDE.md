# AFRICAN FOOTBALL PLATFORM — MASTER BUILD PROMPT FOR CLAUDE CODE

**Paste this entire file as your first message to Claude Code in this repository, or save it as `CLAUDE.md` in the project root so Claude Code loads it automatically every session.**

---

## 0. HOW TO USE THIS PROMPT

You are Claude Code, acting as the lead full-stack engineer on a real product being built by a solo/small founder team. This file is your persistent source of truth. A companion document, **"African Football Platform — Technical Build Specification v1.0"** (PDF/DOCX, 51 pages), contains the full detailed reasoning behind every decision here — treat it as the canonical reference if this prompt and the spec ever seem to conflict; flag the conflict to the founder rather than guessing.

**Your operating discipline for this entire project, non-negotiable:**

```
SPECIFICATION → MILESTONE → PLAN → CODE → TEST → REVIEW → COMMIT → NEXT MILESTONE
```

- Work on **one phase at a time** (phase list in Section 8 below). Never jump ahead.
- Before writing any code for a milestone, **restate the scope back to the founder in your own words**, list any assumptions you're making, and flag anything ambiguous or missing. Wait for confirmation if anything is unclear.
- **Never expand scope on your own initiative.** If you notice something useful that isn't in the current milestone — even something small and obviously good — flag it explicitly and ask, rather than building it.
- Every milestone must include the relevant automated tests before you consider it done.
- **THE VERTICAL SLICE RULE (important — read twice):** This project always ships frontend and backend together as one matched pair, never one without the other. For every feature in every milestone: if you build a server function or database table, you also build the UI screen(s) that use it in the same milestone, and vice versa. Never leave a backend endpoint with no UI to call it, and never leave a UI screen wired to mock/fake data when the real backend for it is in scope for that milestone. If a milestone genuinely can't include both (e.g. pure infrastructure setup in Phase 0), say so explicitly instead of silently skipping one side.
- When a milestone is complete, show a working demo path (e.g. "run `npm run dev`, go to `/dashboard`, click X, see Y") before moving on.

---

## 1. WHAT WE ARE BUILDING, IN ONE PARAGRAPH

A grassroots football competition management platform for Nigeria (expanding later across Africa). Tournament organizers run their competitions through the app — creating competitions, registering teams and players, generating fixtures, and recording match events. The system turns those match events into **verified player and team statistics** as a byproduct of running the competition digitally. It is deliberately **not** a Transfermarkt-style database seeded with existing data — it is the infrastructure that *creates* grassroots football data that doesn't currently exist in structured form anywhere.

---

## 2. THE ONE RULE THAT GOVERNS EVERYTHING ELSE

> **Player-entered information must never be the primary source of truth for performance statistics.**
> Statistics flow one direction only: `match events → verified statistics → player profile`.
> No user of any role may ever directly edit a career total, competition total, or any other derived statistic. The only way to change a number is the correction workflow (Section 6), which creates a compensating event — it never edits history in place.

If you ever find yourself writing code that lets a statistic be set directly (an UPDATE to `player_competition_stats.goals`, for example, outside of the statistics-engine recalculation functions), stop — that violates the core trust model of the entire product.

---

## 3. TECH STACK

| Layer | Technology |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Next.js Server Actions / Route Handlers (no separate backend service) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Authorization | PostgreSQL Row Level Security (RLS) — this is the *authoritative* enforcement layer, not the frontend |
| Storage | Supabase Storage (photos, logos, evidence uploads) |
| Hosting | Vercel (app) + Supabase (data) |
| Payments | Paystack or Flutterwave (Nigerian gateway) — one-time competition onboarding fee |
| Match-event messaging channel | WhatsApp Business Platform (Meta Cloud API) or Twilio, via webhook |
| Testing | Unit + integration (against a real Postgres/RLS instance) + end-to-end |
| Version control | Git + GitHub, milestone-based commits |

**Golden rule:** never trust the client for anything that affects verified data. All permission checks and statistics calculations happen in server logic and are reinforced by RLS — never in the frontend alone.

---

## 4. USER ROLES (implement exactly this permission matrix)

| Role | Create | Read | Update | Delete | Verify | Publish |
|---|---|---|---|---|---|---|
| Platform Admin | All entities | All | All | Soft-delete only | Yes — final authority | Yes |
| Organizer | Own competitions, teams, fixtures | Own + public | Own competition data (pre-verification) | Own unpublished data only | Match results within own competition | Own competition pages |
| Team Manager | Own team roster requests | Own team + public | Own team profile, squad list | No | No | No |
| Match Operator | Match events for assigned fixtures | Assigned fixtures | Events before match verification | Own unverified entries only | No | No |
| Player | Own profile claim, personal info | Own profile + public | Own personal/self-reported fields only | No | No | No |
| Scout | Shortlists (Phase 3+) | Public verified data | Own shortlists | Own shortlists | No | No |
| Public User | Nothing | Public pages only | No | No | No | No |

Future roles (not implemented yet, don't build permissions for them, but don't design the schema to actively block them either): Agent, Club, Academy, Sponsor, Football Association.

---

## 5. DATABASE SCHEMA (build exactly this in Phase 2, PostgreSQL + Supabase)

Use UUID primary keys everywhere. Enforce all foreign keys at the database level. Soft-delete (`deleted_at`) on any entity with public visibility. Append-only, immutable audit logging on anything affecting verified statistics.

| Domain | Tables | Notes |
|---|---|---|
| Identity | `profiles`, `players`, `football_ids` | `football_ids.code` (e.g. `AF-0001842`) is permanent, globally unique, never recycled, never name-derived |
| Organizations | `organizers`, `teams`, `venues`, `match_officials` | A team can enter many competitions over time |
| Competition | `competitions`, `competition_teams`, `competition_statistics` | `competition_teams` unique on `(competition_id, team_id)` |
| Roster | `team_players`, `match_lineups` | Roster membership over time vs. one specific match |
| Match | `matches`, `match_events` | `match_events` is **append-only**; corrections add compensating events, never edit in place. `match_events.source` = `match_center` \| `whatsapp_bot`. `matches.auto_verify_at` = timestamp for auto-promotion (Section 7) |
| Statistics | `player_match_stats`, `player_competition_stats`, `team_statistics` | 100% derived/materialized from `match_events` — **never written directly by any user-facing function** |
| Trust & audit | `verification_records`, `correction_requests`, `audit_logs` | `audit_logs` is append-only, immutable |
| Commercial | `competition_payments` | A competition cannot move from draft to published without a completed payment record, unless explicitly waived by an Admin |

Duplicate player detection: on `registerPlayer()`, always run `searchExistingPlayer()` first (fuzzy name + DOB + team/competition overlap). Surface candidates for human review. **Never auto-merge.**

---

## 6. TRUST MODEL — INTERNAL VS. PUBLIC

**Internal (five levels, database/admin only — never shown publicly as five labels):**
`SELF_REPORTED → TEAM_CONFIRMED → MATCH_RECORDED → MATCH_VERIFIED → ADMIN_VERIFIED`

**Public-facing (collapse to three badges everywhere in the UI):**

| Public badge | Maps to |
|---|---|
| Verified | MATCH_VERIFIED, ADMIN_VERIFIED |
| Pending | MATCH_RECORDED (within auto-verify window) |
| Unverified | SELF_REPORTED, TEAM_CONFIRMED |

**Correction workflow** (never a direct edit): `correction_requests` → evidence → organizer review → admin review (if escalated) → approve (creates a compensating `match_event`, writes `audit_logs`) or reject (reason required, writes `audit_logs`).

---

## 7. VERIFICATION AUTO-PROMOTION (build this as a first-class MVP feature, not a later optimization)

This is a considered change from a pure "organizer must manually verify" model, made specifically to protect the trust model from an organizer simply not having time to click a button:

1. When a match is submitted, set `matches.auto_verify_at` to +48–72 hours.
2. Any player, team manager, or organizer can call `flagEventDispute(eventId, reason)`, which pauses the clock for that match.
3. A scheduled job (`autoPromoteUnverifiedMatches()`) promotes any match past its `auto_verify_at` deadline with no open dispute to `MATCH_VERIFIED`, then calls `publishMatch()`.
4. An organizer can still manually verify earlier if they choose — both paths converge on the same `MATCH_VERIFIED` state.

---

## 8. DEVELOPMENT ROADMAP — WORK THROUGH THESE PHASES IN ORDER

Do not start a phase until the previous one's Definition of Done is met and demoed.

| Phase | Objective | Definition of Done |
|---|---|---|
| **P0 — Foundation** | Project skeleton + environments | Deployed "hello world" on Vercel connected to a live Supabase project; local dev works. **Start WhatsApp Business verification now in parallel — it has an external lead time.** |
| **P1 — Auth + Roles** | Login + role-gated routes | A user can register, log in, see a role-appropriate dashboard; unauthorized routes blocked server-side |
| **P2 — DB + Football Identity** | Full schema + duplicate detection | Schema migrated; new player registration triggers duplicate detection against seeded data |
| **P3 — Competition Management + Payment** | Organizers create competitions and pay the onboarding fee | Organizer can create a competition, complete payment (or receive Admin waiver), see it on their dashboard; RLS blocks cross-organizer access |
| **P4 — Team + Player Registration** | Squads can be built | Full squad registered with duplicate warnings functioning |
| **P5 — Fixtures** | Fixtures can be scheduled | Fixture list created and visible in draft form |
| **P6 — Match Center + WhatsApp Bot** | Match-day recording works end to end, two channels | A test match fully recorded via both the Match Center UI and a WhatsApp message |
| **P7 — Statistics Engine** | Verified events become statistics automatically | Publishing a verified match updates player/team/competition stats correctly |
| **P8 — Verification + Audit** | Trust hierarchy, auto-promotion, corrections enforced | All test cases in Section 9 pass |
| **P9 — Public Website** | Public competition/team/player pages | A public link works for someone with no account |
| **P10 — Pilot Tournament** | One real organizer runs one real competition | Pilot completes; organizer would use it again |
| **P11 — Monetization Expansion** | Revenue beyond the base fee | A repeat organizer upgrades to a premium/subscription tier |
| **P12 — Scouting** | Verified-data search for scouts | A realistic scout query returns relevant results |
| **P13 — African Expansion** | Repeat the model in a second city/state | Running without core-product rework |

---

## 9. NON-NEGOTIABLE TEST CASES (implement across the relevant phases, don't skip any before Phase 10)

- Unauthorized user cannot create a competition.
- Organizer cannot edit another organizer's competition.
- Player cannot edit their own verified goals.
- Duplicate-player warning triggers on a near-match name + DOB.
- A goal event increases the scorer's goal count exactly once, even on resubmission.
- A deleted/unpublished match does not affect any public statistic.
- An approved correction updates the statistic correctly and leaves an audit trail.
- A player retains the same Football ID after changing teams.
- An ineligible player (not on the confirmed roster) cannot be added to a lineup.
- A published match cannot be silently modified by any role, including the original operator.
- Audit log records every correction, verification, and merge decision.
- A match past `auto_verify_at` with no dispute is auto-promoted by the scheduled job.
- Flagging a dispute pauses auto-promotion for the whole match.
- A WhatsApp event for a player not on the lineup is rejected with a corrective reply, not silently recorded.
- A duplicate WhatsApp webhook delivery does not create a duplicate event.
- A competition cannot publish while its onboarding payment is unpaid and unwaived.
- A duplicate payment webhook does not double-charge or double-record.

---

## 10. KEY SERVER FUNCTIONS (implement with these names/signatures as the contract; expand internals as needed)

`createCompetition()` · `registerTeam()` · `registerPlayer()` · `searchExistingPlayer()` · `createFootballId()` (system-only) · `addTeamToCompetition()` · `createFixture()` · `startMatch()` · `recordMatchEvent()` · `recordMatchEventFromWhatsApp(rawMessage, senderNumber)` · `finishMatch()` · `verifyMatch()` · `autoPromoteUnverifiedMatches()` (scheduled) · `flagEventDispute()` · `publishMatch()` · `calculatePlayerStats()` · `calculateCompetitionStats()` · `requestCorrection()` · `approveCorrection()` · `rejectCorrection()` · `createCompetitionPayment()` · `confirmCompetitionPayment(webhookPayload)`

Every function validates permissions server-side per Section 4, independent of RLS, as defence in depth.

---

## 11. UX PRINCIPLES (apply to every screen you build)

- Mobile-first, low-bandwidth, works on inexpensive Android phones.
- Simple English, minimal jargon.
- The Match Center: three taps or fewer per event; a review screen before submission; never lose in-progress entries to a network blip.
- WhatsApp is a first-class input channel for match events, not just a sharing mechanism.
- Public pages: one-tap WhatsApp share.
- No public page ever shows the five-level internal trust taxonomy — only Verified / Pending / Unverified.
- Direct statistic fields are genuinely non-editable in the UI (not just discouraged) — the correction flow is the only path.

Reference mockups exist for: Organizer Dashboard, Match Center (mobile), Public Competition Page, Public Player Profile, Player Registration + Duplicate Warning, Correction Request Review, Admin Verification/Audit Panel, and Competition Payment/Onboarding. Match their layout and information hierarchy unless there's a concrete reason to deviate — flag it if so.

---

## 12. WHAT TO DEFER (do not build these unless explicitly asked, even if they seem easy)

AI player ratings/scouting, video analysis/computer vision, market values/automated valuation, transfer marketplace, agent marketplace, social network features, native mobile apps, live streaming, advanced analytics, continental-wide launch. These are all Phase 12+/Future by design — see the spec's Section 7 and 20 for why.

---

## 13. START HERE

Your first task is **Phase 0 only**. Before writing any code:

1. Restate the Phase 0 scope back to me in your own words.
2. List every assumption you're making about the environment (Node version, package manager, Supabase project already created or not, etc.) and ask about anything you're not sure of.
3. Propose the repo structure.
4. Then, and only then, start building.

Do not touch Phase 1 or beyond until Phase 0 is demoed and I've said to continue.