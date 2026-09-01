"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SELF_REGISTERABLE_ROLES, type UserRole } from "@/lib/roles";
import PhoneInput from "@/components/phone-input";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("player");
  const [dialCode, setDialCode] = useState("+234");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedRole = SELF_REGISTERABLE_ROLES.find((r) => r.value === role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          first_name: firstName,
          last_name: lastName,
          whatsapp_number: role === "match_operator" ? `${dialCode}${phoneNumber}` : null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      setCheckEmail(true);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const inputClass =
    "w-full rounded border border-white/15 bg-[#0d1310] px-3 py-2 text-[#EAF3EE] placeholder:text-[#8FA89C]/50 focus:border-[#2FBE81] focus:outline-none";

  if (checkEmail) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#070c09] px-6 text-center text-[#EAF3EE]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#4ade80] to-[#d97706] text-sm font-bold text-[#052014]">
          AF
        </div>
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="max-w-sm text-[#8FA89C]">
          We sent a confirmation link to {email}. Click it to finish setting up your
          account.
        </p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070c09] px-6 py-12 text-[#EAF3EE]">
      <div className="pointer-events-none absolute -top-32 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-[#2FBE81] opacity-15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-10%] h-[24rem] w-[24rem] rounded-full bg-[#d97706] opacity-10 blur-[110px]" />

      <div className="relative w-full max-w-md">
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
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-[#8FA89C]">
            Free to join — pick the role that matches what you'll be doing.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm">
                First name
                <input
                  required
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm">
                Last name
                <input
                  required
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

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
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            <div className="flex flex-col gap-1 text-sm">
              <label htmlFor="role">I am registering as a...</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className={inputClass}
              >
                {SELF_REGISTERABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {selectedRole && (
                <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#8FA89C]">
                  {selectedRole.description}
                </p>
              )}
            </div>

            {role === "match_operator" && (
              <label className="flex flex-col gap-1 text-sm">
                WhatsApp number
                <PhoneInput
                  required
                  dialCode={dialCode}
                  onDialCodeChange={setDialCode}
                  number={phoneNumber}
                  onNumberChange={setPhoneNumber}
                />
                <span className="text-xs text-[#8FA89C]">
                  Match events you send from this number will be recorded automatically.
                </span>
              </label>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-full bg-gradient-to-r from-[#4ade80] to-[#22c55e] px-4 py-2.5 text-sm font-semibold text-[#052014] hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating account..." : "Register"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-[#8FA89C]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#2FBE81] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
