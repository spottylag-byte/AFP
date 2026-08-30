# African Football Platform

Grassroots football competition management platform for Nigeria (expanding later across Africa). See [CLAUDE.md](./CLAUDE.md) for the full product spec, roles, schema, roadmap, and operating rules for this project.

**Status:** Phase 0 — Foundation (project skeleton only, not yet connected to a live Supabase project).

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, Supabase (Postgres + Auth + Storage) once wired up, hosted on Vercel.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To connect Supabase locally, copy `.env.local.example` to `.env.local` and fill in your project's URL and keys.

## Repo structure

```
app/                    Next.js App Router
components/             (added as UI is built)
lib/supabase/           Supabase client (browser) + server helpers
supabase/migrations/    SQL migrations (starting Phase 2)
```
