"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type Video = { id: string; video_url: string; caption: string | null };

export default function PlayerVideoManager({
  playerId,
  initialVideos,
}: {
  playerId: string;
  initialVideos: Video[];
}) {
  const [videos, setVideos] = useState(initialVideos);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Video must be under 50MB");
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${playerId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("player-videos")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("player-videos").getPublicUrl(path);

      const { data: newId, error: rpcError } = await supabase.rpc("add_player_video", {
        p_player_id: playerId,
        p_video_url: publicUrl,
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      setVideos((v) => [...v, { id: newId as string, video_url: publicUrl, caption: null }]);
    });
  }

  function handleRemove(videoId: string) {
    startTransition(async () => {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("remove_player_video", { p_video_id: videoId });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      setVideos((v) => v.filter((video) => video.id !== videoId));
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {videos.map((v) => (
          <div key={v.id} className="relative">
            <video src={v.video_url} className="h-24 w-40 rounded bg-black object-cover" controls />
            <button
              type="button"
              onClick={() => handleRemove(v.id)}
              disabled={isPending}
              className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white disabled:opacity-50"
              aria-label="Remove video"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="mt-2 text-xs underline text-zinc-500 disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Add video clip"}
      </button>
      <input ref={inputRef} type="file" accept="video/*" onChange={handleFile} className="hidden" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
