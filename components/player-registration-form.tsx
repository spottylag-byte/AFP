"use client";

import { useState } from "react";
import {
  searchExistingPlayer,
  registerPlayer,
  addExistingPlayerToTeam,
} from "@/lib/player-registration-actions";

type Candidate = {
  id: string;
  full_name: string;
  alias: string | null;
  date_of_birth: string;
  football_id_code: string;
  similarity: number;
  already_on_this_team: boolean;
};

type Stage = "form" | "reviewing" | "done";

/**
 * Shared "search for duplicates, then register or link" form. Used
 * standalone (no teamId -- admin registering a player with no roster
 * to add them to) and team-scoped (teamId given -- team_manager /
 * organizer building a roster, where a matched duplicate can be linked
 * in instead of re-registered).
 */
export default function PlayerRegistrationForm({
  teamId,
  revalidatePathTarget,
}: {
  teamId?: string;
  revalidatePathTarget: string;
}) {
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
  const [result, setResult] = useState<{ footballIdCode: string; linked: boolean } | null>(
    null
  );

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await searchExistingPlayer(firstName, lastName, dateOfBirth, teamId);
      setCandidates((data as Candidate[]) ?? []);
      setStage("reviewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterNew() {
    setError(null);
    setSubmitting(true);
    try {
      const data = await registerPlayer(
        {
          firstName,
          lastName,
          dateOfBirth,
          teamId,
          alias: alias || null,
          position: position || null,
          heightCm: heightCm ? Number(heightCm) : null,
          preferredFoot: preferredFoot || null,
          country: country || null,
          city: city || null,
        },
        revalidatePathTarget
      );
      setResult({ footballIdCode: data.football_id_code, linked: false });
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddExisting(candidate: Candidate) {
    if (!teamId) return;
    setError(null);
    setSubmitting(true);
    try {
      await addExistingPlayerToTeam(teamId, candidate.id, revalidatePathTarget);
      setResult({ footballIdCode: candidate.football_id_code, linked: true });
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
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
    setResult(null);
  }

  const inputClass =
    "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

  if (stage === "done" && result) {
    return (
      <div className="rounded border border-green-300 bg-green-50 p-4 text-sm dark:border-green-800 dark:bg-green-950">
        <p className="font-medium">{result.linked ? "Added to roster." : "Player registered."}</p>
        <p className="mt-1">
          Football ID: <span className="font-mono">{result.footballIdCode}</span>
        </p>
        <button
          onClick={reset}
          className="mt-3 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          {teamId ? "Add another" : "Register another"}
        </button>
      </div>
    );
  }

  if (stage === "reviewing") {
    return (
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Checking: <strong>{firstName} {lastName}</strong>, born {dateOfBirth}
        </p>

        {candidates.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
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
                {teamId &&
                  (c.already_on_this_team ? (
                    <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-500">
                      Already on this roster
                    </p>
                  ) : (
                    <button
                      onClick={() => handleAddExisting(c)}
                      disabled={submitting}
                      className="mt-2 rounded bg-primary hover:bg-primary-hover px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
                    >
                      This is the same person — add to roster instead
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No likely matches found.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleRegisterNew}
            disabled={submitting}
            className="rounded bg-primary hover:bg-primary-hover px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-primary dark:hover:bg-primary-hover"
          >
            {submitting
              ? "Working..."
              : candidates.length === 0
              ? teamId
                ? "Add to roster"
                : "Register player"
              : "This is a different person — register as new"}
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
    <form onSubmit={handleCheck} className="flex flex-col gap-4">
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
        Alias (optional)
        <input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="e.g. Jay-Jay"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Date of birth
        <input
          required
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Position (optional)
        <select value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass}>
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
            className={inputClass}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Preferred foot (optional)
          <select
            value={preferredFoot}
            onChange={(e) => setPreferredFoot(e.target.value)}
            className={inputClass}
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
            className={inputClass}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          City (optional)
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Lagos"
            className={inputClass}
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
