import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        African Football Platform
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Phase 1 — Auth + Roles.
      </p>
      <div className="flex gap-4 text-sm font-medium">
        <Link href="/login" className="underline">
          Log in
        </Link>
        <Link href="/register" className="underline">
          Register
        </Link>
      </div>
    </div>
  );
}
