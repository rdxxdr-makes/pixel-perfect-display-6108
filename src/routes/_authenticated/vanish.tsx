import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImageUp, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { uploadMedia, timeAgo } from "@/lib/social";
import { StoryViewer, useStoryGroups } from "@/components/social/stories";
import { MediaView, UserAvatar } from "@/components/social/Media";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vanish")({
  head: () => ({
    meta: [
      { title: "Disappearing — Orbit" },
      { name: "description", content: "Snap it, share it, gone in 24 hours." },
      { property: "og:title", content: "Disappearing — Orbit" },
      { property: "og:description", content: "Snap it, share it, gone in 24 hours." },
    ],
  }),
  component: Vanish,
});

function hoursLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));
}

function Vanish() {
  const { userId } = useMe();
  const qc = useQueryClient();
  const { data: groups = [] } = useStoryGroups(userId);
  const [viewer, setViewer] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(f?: File) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function reset() {
    setFile(null);
    setPreview(null);
    setCaption("");
  }
  async function drop() {
    if (!file) return;
    setBusy(true);
    try {
      const { path, type } = await uploadMedia(file, userId);
      const { error } = await supabase.from("stories").insert({ user_id: userId, media_url: path, media_type: type, caption });
      if (error) throw error;
      toast.success("Live for 24 hours 👻");
      qc.invalidateQueries({ queryKey: ["stories"] });
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-3 py-4 md:py-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* Camera-first capture */}
      <section className="relative aspect-[9/16] max-h-[78vh] w-full overflow-hidden rounded-[2.25rem] glass shadow-glow">
        {preview ? (
          <>
            {file?.type.startsWith("video") ? (
              <video src={preview} className="absolute inset-0 size-full object-cover" autoPlay muted loop playsInline />
            ) : (
              <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
            )}
            <button aria-label="Discard" onClick={reset} className="absolute left-4 top-4 grid size-10 place-items-center rounded-full glass"><X className="size-5" /></button>
            <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-background/90 to-transparent p-5">
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a vibe…" className="h-11 w-full rounded-full glass px-4 text-center text-sm font-semibold outline-none" />
              <Button variant="mode" className="h-12 w-full text-base" onClick={drop} disabled={busy}>
                <Timer /> {busy ? "Dropping…" : "Drop for 24h"}
              </Button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-8 text-center">
            <div className="pointer-events-none absolute inset-0 bg-gradient-mode opacity-[0.07]" />
            <div>
              <h1 className="text-3xl font-extrabold">Snap it.<br /><span className="text-gradient-mode">Watch it vanish.</span></h1>
              <p className="mt-3 text-sm text-muted-foreground">Everything here self-destructs after 24 hours.</p>
            </div>
            <label className="group relative grid size-28 cursor-pointer place-items-center rounded-full border-4 border-primary transition-transform active:scale-90">
              <span className="grid size-20 place-items-center rounded-full bg-gradient-mode text-primary-foreground shadow-glow transition-transform group-hover:scale-105"><Camera className="size-8" /></span>
              <input type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold">
              <ImageUp className="size-4" /> Upload from library
              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          </div>
        )}
      </section>

      {/* Stories wall */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Live now</h2>
          <span className="text-xs text-muted-foreground">{groups.length} {groups.length === 1 ? "story" : "stories"}</span>
        </div>
        {groups.length === 0 && (
          <div className="rounded-[2rem] glass p-10 text-center text-muted-foreground">No live stories. Drop the first one.</div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {groups.map((g, i) => {
            const last = g.stories[g.stories.length - 1];
            const own = g.user.id === userId;
            return (
              <button
                key={g.user.id}
                onClick={() => setViewer(i)}
                className={cn("group relative aspect-[9/14] overflow-hidden rounded-3xl text-left transition-transform hover:-translate-y-1", g.unseen ? "p-[2.5px] story-ring" : "p-[2.5px] bg-muted")}
              >
                <div className="relative size-full overflow-hidden rounded-[1.35rem]">
                  <MediaView path={last.media_url} type={last.media_type} className={cn("absolute inset-0 size-full", !g.unseen && !own && "opacity-60 grayscale-[40%]")} />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/30" />
                  <div className="absolute left-3 top-3 rounded-full glass px-2 py-0.5 text-[10px] font-bold">{hoursLeft(last.expires_at)}h left</div>
                  <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
                    <UserAvatar profile={g.user} size="xs" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{own ? "You" : g.user.username}</p>
                      <p className="text-[10px] text-muted-foreground">{g.stories.length} snap{g.stories.length > 1 && "s"} · {timeAgo(last.created_at)}</p>
                    </div>
                    {g.unseen && <span className="ml-auto size-2 rounded-full bg-primary" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      {viewer !== null && <StoryViewer groups={groups} start={viewer} userId={userId} onClose={() => setViewer(null)} />}
    </div>
  );
}
