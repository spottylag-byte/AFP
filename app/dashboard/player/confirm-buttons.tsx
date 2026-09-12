"use client";

import { useTransition } from "react";
import { confirmPlayerPhoto, confirmPlayerVideo } from "./actions";

export function ConfirmPhotoButton({ playerId }: { playerId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => confirmPlayerPhoto(playerId))}
      disabled={isPending}
      className="rounded border border-primary px-2 py-1 text-xs text-primary-hover disabled:opacity-50"
    >
      {isPending ? "Confirming..." : "Confirm this is me"}
    </button>
  );
}

export function ConfirmVideoButton({ videoId }: { videoId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => confirmPlayerVideo(videoId))}
      disabled={isPending}
      className="rounded border border-primary px-2 py-1 text-xs text-primary-hover disabled:opacity-50"
    >
      {isPending ? "Confirming..." : "Confirm this is me"}
    </button>
  );
}
