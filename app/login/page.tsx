"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/logo";

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
    "w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink placeholder:text-ink-soft/50 focus:border-primary focus:outline-none";

  return (
    <main className="flex min-h-screen items-center justify-center bg-chalk px-6 py-12 text-ink">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-sm text-ink-soft hover:text-ink"
        >
          <Logo size={32} />
          Soccer Point
        </Link>

        <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-[0_20px_50px_rgba(22,33,58,0.12)] sm:p-8">
          <h1 className="text-xl font-semibold">Log in</h1>
          <p className="mt-1 text-sm text-ink-soft">Welcome back.</p>

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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded bg-primary px-4 py-2.5 text-sm font-semibold text-chalk hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary-hover hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
