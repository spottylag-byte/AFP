"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/logo";
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
    "w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink placeholder:text-ink-soft/50 focus:border-primary focus:outline-none";

  if (checkEmail) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-chalk px-6 text-center text-ink">
        <Logo size={48} />
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="max-w-sm text-ink-soft">
          We sent a confirmation link to {email}. Click it to finish setting up your
          account.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-chalk px-6 py-12 text-ink">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-sm text-ink-soft hover:text-ink"
        >
          <Logo size={32} />
          Soccer Point
        </Link>

        <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-[0_20px_50px_rgba(22,33,58,0.12)] sm:p-8">
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-ink-soft">
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
                <p className="rounded-md border border-ink/10 bg-chalk px-3 py-2 text-xs text-ink-soft">
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
                <span className="text-xs text-ink-soft">
                  Match events you send from this number will be recorded automatically.
                </span>
              </label>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded bg-primary px-4 py-2.5 text-sm font-semibold text-chalk hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Creating account..." : "Register"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary-hover hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
