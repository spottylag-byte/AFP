"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import PlayerAvatar from "./player-avatar";

export default function PlayerPhotoUpload({
  playerId,
  fullName,
  photoUrl,
}: {
  playerId: string;
  fullName: string;
  photoUrl: string | null;
}) {
  const [currentUrl, setCurrentUrl] = useState(photoUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${playerId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("player-photos")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("player-photos").getPublicUrl(path);

      const { error: rpcError } = await supabase.rpc("set_player_photo", {
        p_player_id: playerId,
        p_photo_url: publicUrl,
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      setCurrentUrl(publicUrl);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <PlayerAvatar fullName={fullName} photoUrl={currentUrl} size={40} />
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="text-xs underline text-zinc-500 disabled:opacity-50"
      >
        {isPending ? "Uploading..." : currentUrl ? "Change photo" : "Add photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
