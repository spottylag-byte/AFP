"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const inputClass =
    "w-full rounded border border-white/15 bg-[#0d1310] px-3 py-2 text-[#EAF3EE] placeholder:text-[#8FA89C]/50 focus:border-[#2FBE81] focus:outline-none";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070c09] px-6 py-12 text-[#EAF3EE]">
      <div className="pointer-events-none absolute -top-32 left-[-10%] h-[28rem] w-[28rem] rounded-full bg-[#2FBE81] opacity-15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[24rem] w-[24rem] rounded-full bg-[#d97706] opacity-10 blur-[110px]" />

      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-sm text-[#8FA89C] hover:text-[#EAF3EE]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#4ade80] to-[#d97706] text-xs font-bold text-[#052014]">
            AF
          </span>
          African Football Platform
        </Link>

        <div className="rounded-2xl border border-white/10 bg-[#0B0F0D]/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur sm:p-8">
          <h1 className="text-xl font-semibold">Log in</h1>
          <p className="mt-1 text-sm text-[#8FA89C]">Welcome back.</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Password
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-full bg-gradient-to-r from-[#4ade80] to-[#22c55e] px-4 py-2.5 text-sm font-semibold text-[#052014] hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-[#8FA89C]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-[#2FBE81] hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
