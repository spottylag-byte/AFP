"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Candidate = {
  id: string;
  full_name: string;
  alias: string | null;
  date_of_birth: string;
  football_id_code: string;
  similarity: number;
  already_on_this_team: boolean;
};

type Stage = "form" | "reviewing" | "registered";

export default function RegisterPlayerForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [alias, setAlias] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [position, setPosition] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [preferredFoot, setPreferredFoot] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState<{ footballIdCode: string } | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { data, error: searchError } = await supabase.rpc("search_existing_player", {
      p_full_name: `${firstName} ${lastName}`,
      p_date_of_birth: dateOfBirth,
    });

    setSubmitting(false);

    if (searchError) {
      setError(searchError.message);
      return;
    }

    setCandidates((data as Candidate[]) ?? []);
    setStage("reviewing");
  }

  async function handleRegister() {
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { data, error: registerError } = await supabase
      .rpc("register_player", {
        p_first_name: firstName,
        p_last_name: lastName,
        p_date_of_birth: dateOfBirth,
        p_alias: alias || null,
        p_position: position || null,
        p_height_cm: heightCm ? Number(heightCm) : null,
        p_preferred_foot: preferredFoot || null,
        p_country: country || null,
        p_city: city || null,
      })
      .single();

    setSubmitting(false);

    if (registerError) {
      setError(registerError.message);
      return;
    }

    setRegistered({ footballIdCode: (data as { football_id_code: string }).football_id_code });
    setStage("registered");
  }

  if (stage === "registered" && registered) {
    return (
      <div className="mt-6 rounded border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
        <p className="font-medium">Player registered.</p>
        <p className="mt-1 text-sm">
          Football ID: <span className="font-mono">{registered.footballIdCode}</span>
        </p>
        <button
          onClick={() => {
            setStage("form");
            setFirstName("");
            setLastName("");
            setAlias("");
            setDateOfBirth("");
            setPosition("");
            setHeightCm("");
            setPreferredFoot("");
            setCountry("");
            setCity("");
            setCandidates([]);
            setRegistered(null);
          }}
          className="mt-3 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          Register another
        </button>
      </div>
    );
  }

  if (stage === "reviewing") {
    return (
      <div className="mt-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Checking: <strong>{firstName} {lastName}</strong>, born {dateOfBirth}
        </p>

        {candidates.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
              {candidates.length} possible duplicate
              {candidates.length > 1 ? "s" : ""} found:
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
                >
                  <p className="font-medium">
                    {c.full_name}
                    {c.alias ? ` (${c.alias})` : ""}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Born {c.date_of_birth} · {c.football_id_code} · similarity{" "}
                    {(c.similarity * 100).toFixed(0)}%
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No likely matches found.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleRegister}
            disabled={submitting}
            className="rounded bg-primary hover:bg-primary-hover px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
          >
            {submitting
              ? "Registering..."
              : candidates.length > 0
              ? "This is a different person — register anyway"
              : "Register player"}
          </button>
          <button
            onClick={() => setStage("form")}
            className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleCheck} className="mt-6 flex flex-col gap-4">
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          First name
          <input
            required
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Last name
          <input
            required
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Alias (optional)
        <input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="e.g. Jay-Jay"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Date of birth
        <input
          required
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Position (optional)
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Not specified</option>
          <option value="GK">Goalkeeper</option>
          <option value="DEF">Defender</option>
          <option value="MID">Midfielder</option>
          <option value="FWD">Forward</option>
        </select>
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Height in cm (optional)
          <input
            type="number"
            min={100}
            max={230}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="e.g. 178"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Preferred foot (optional)
          <select
            value={preferredFoot}
            onChange={(e) => setPreferredFoot(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Not specified</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="both">Both</option>
          </select>
        </label>
      </div>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Country (optional)
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Nigeria"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          City (optional)
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Lagos"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-primary hover:bg-primary-hover px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
      >
        {submitting ? "Checking..." : "Check for duplicates"}
      </button>
    </form>
  );
}
