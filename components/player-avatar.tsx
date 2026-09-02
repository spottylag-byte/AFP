"use client";

import { useState } from "react";

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default function PlayerAvatar({
  fullName,
  photoUrl,
  size = 40,
}: {
  fullName: string;
  photoUrl: string | null;
  size?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => photoUrl && setOpen(true)}
        aria-label={photoUrl ? `View ${fullName}'s photo` : fullName}
        className="shrink-0 overflow-hidden rounded-full bg-primary font-semibold text-chalk"
        style={{ width: size, height: size, fontSize: size * 0.4, cursor: photoUrl ? "zoom-in" : "default" }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={fullName}
            width={size}
            height={size}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {initials(fullName)}
          </span>
        )}
      </button>

      {open && photoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
        >
          <div className="flex max-w-sm flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={fullName}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
            <p className="text-sm font-medium text-white">{fullName}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-white/40 px-4 py-1.5 text-sm text-white hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
