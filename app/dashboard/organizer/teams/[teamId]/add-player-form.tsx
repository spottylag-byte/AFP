"use client";

import { useState } from "react";
import {
  searchExistingPlayerForTeam,
  registerPlayerForTeam,
  addExistingPlayerToTeam,
} from "./actions";

type Candidate = {
  id: string;
  full_name: string;
  alias: string | null;
  date_of_birth: string;
  football_id_code: string;
  similarity: number;
  already_on_this_team: boolean;
};

type Stage = "form" | "reviewing" | "added";

export default function AddPlayerForm({ teamId }: { teamId: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [alias, setAlias] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [added, setAdded] = useState<{ footballIdCode: string } | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await searchExistingPlayerForTeam(firstName, lastName, dateOfBirth, teamId);
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
      const result = await registerPlayerForTeam(
        firstName,
        lastName,
        dateOfBirth,
        teamId,
        alias || null
      );
      setAdded({ footballIdCode: result.football_id_code });
      setStage("added");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddExisting(candidate: Candidate) {
    setError(null);
    setSubmitting(true);
    try {
      await addExistingPlayerToTeam(teamId, candidate.id);
      setAdded({ footballIdCode: candidate.football_id_code });
      setStage("added");
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
    setCandidates([]);
    setAdded(null);
  }

  if (stage === "added" && added) {
    return (
      <div className="rounded border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
        <p className="font-medium">Added to roster.</p>
        <p className="mt-1 text-sm">
          Football ID: <span className="font-mono">{added.footballIdCode}</span>
        </p>
        <button
          onClick={reset}
          className="mt-3 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          Add another
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
                {c.already_on_this_team ? (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-500">
                    Already on this roster
                  </p>
                ) : (
                  <button
                    onClick={() => handleAddExisting(c)}
                    disabled={submitting}
                    className="mt-2 rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    This is the same person — add to roster instead
                  </button>
                )}
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
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {submitting
              ? "Working..."
              : candidates.length > 0
              ? "This is a different person — register as new"
              : "Add to roster"}
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitting ? "Checking..." : "Check for duplicates"}
      </button>
    </form>
  );
}
