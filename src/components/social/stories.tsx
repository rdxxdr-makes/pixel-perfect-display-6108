import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Send, Trash2, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, type Profile } from "@/lib/social";
import { MediaView, UserAvatar } from "./Media";

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: Profile | null;
};
export type StoryGroup = { user: Profile; stories: Story[]; unseen: boolean };

export function useStoryGroups(userId: string) {
  return useQuery({
    queryKey: ["stories"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: stories } = await supabase
        .from("stories")
        .select("*, profiles(*)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      const { data: views } = await supabase.from("story_views").select("story_id").eq("viewer_id", userId);
      const seen = new Set((views ?? []).map((v) => v.story_id));
      const map = new Map<string, StoryGroup>();
      for (const s of (stories ?? []) as Story[]) {
        if (!s.profiles) continue;
        const g = map.get(s.user_id) ?? { user: s.profiles, stories: [], unseen: false };
        g.stories.push(s);
        if (!seen.has(s.id) && s.user_id !== userId) g.unseen = true;
        map.set(s.user_id, g);
      }
      const groups = [...map.values()];
      groups.sort((a, b) => (a.user.id === userId ? -1 : b.user.id === userId ? 1 : Number(b.unseen) - Number(a.unseen)));
      return groups;
    },
  });
}

export function StoryRail({ groups, onOpen, leading }: { groups: StoryGroup[]; onOpen: (i: number) => void; leading?: React.ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-none py-2">
      {leading}
      {groups.map((g, i) => (
        <button key={g.user.id} onClick={() => onOpen(i)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
          <UserAvatar profile={g.user} size="lg" ring={g.unseen ? "unseen" : "seen"} />
          <span className="w-full truncate text-center text-xs text-muted-foreground">{g.user.username}</span>
        </button>
      ))}
    </div>
  );
}

export function StoryViewer({ groups, start, userId, onClose }: { groups: StoryGroup[]; start: number; userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(0);
  const [reply, setReply] = useState("");
  const [paused, setPaused] = useState(false);
  const group = groups[gi];
  const story = group?.stories[si];
  const isOwn = story?.user_id === userId;

  const { data: viewers } = useQuery({
    queryKey: ["story-views", story?.id],
    enabled: !!story && isOwn,
    queryFn: async () => {
      const { data } = await supabase.from("story_views").select("viewer_id, viewed_at, profiles(*)").eq("story_id", story!.id);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!story || isOwn) return;
    supabase
      .from("story_views")
      .upsert({ story_id: story.id, viewer_id: userId }, { onConflict: "story_id,viewer_id", ignoreDuplicates: true })
      .then(() => qc.invalidateQueries({ queryKey: ["stories"] }));
  }, [story, isOwn, userId, qc]);

  const next = useMemo(
    () => () => {
      if (!group) return onClose();
      if (si < group.stories.length - 1) setSi(si + 1);
      else if (gi < groups.length - 1) {
        setGi(gi + 1);
        setSi(0);
      } else onClose();
    },
    [gi, si, group, groups.length, onClose],
  );
  const prev = () => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setSi(0);
    }
  };

  useEffect(() => {
    if (!story || story.media_type === "video" || paused) return;
    const t = setTimeout(next, 5000);
    return () => clearTimeout(t);
  }, [story, next, paused]);

  if (!group || !story) return null;

  async function sendReply() {
    if (!reply.trim()) return;
    const { data: cid, error } = await supabase.rpc("get_or_create_dm", { _other: story!.user_id });
    if (error || !cid) return toast.error(error?.message ?? "Couldn't reply");
    await supabase.from("messages").insert({
      conversation_id: cid,
      sender_id: userId,
      body: `↪ Replied to your story: ${reply}`,
      media_url: story!.media_url,
      media_type: story!.media_type,
    });
    setReply("");
    toast.success("Reply sent", { action: { label: "Open chat", onClick: () => navigate({ to: "/dm/$id", params: { id: cid } }) } });
  }

  async function remove() {
    await supabase.from("stories").delete().eq("id", story!.id);
    qc.invalidateQueries({ queryKey: ["stories"] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-2xl animate-in fade-in">
      <div className="relative h-full w-full max-w-md overflow-hidden md:h-[92vh] md:rounded-[2rem]">
        <MediaView
          key={story.id}
          path={story.media_url}
          type={story.media_type}
          autoPlay
          onEnded={next}
          className="absolute inset-0 size-full"
        />
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-background/80 to-transparent p-3">
          <div className="flex gap-1">
            {group.stories.map((s, i) => (
              <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-foreground/25">
                {i < si && <div className="h-full w-full bg-foreground" />}
                {i === si && story.media_type !== "video" && (
                  <div key={story.id} className="h-full w-full bg-foreground animate-progress" style={{ animationDuration: "5s", animationPlayState: paused ? "paused" : "running" }} />
                )}
                {i === si && story.media_type === "video" && <div className="h-full w-1/2 bg-foreground" />}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <UserAvatar profile={group.user} size="sm" />
            <span className="text-sm font-bold">{group.user.username}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(story.created_at)}</span>
            {isOwn && (
              <button aria-label="Delete story" onClick={remove} className="ml-auto p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-5" /></button>
            )}
            <button aria-label="Close" onClick={onClose} className={isOwn ? "p-1" : "ml-auto p-1"}><X className="size-6" /></button>
          </div>
        </div>
        <button aria-label="Previous" className="absolute inset-y-20 left-0 w-1/3" onClick={prev} />
        <button aria-label="Next" className="absolute inset-y-20 right-0 w-2/3" onClick={next} />
        <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-background/90 to-transparent p-4">
          {story.caption && <p className="text-center text-lg font-semibold">{story.caption}</p>}
          {isOwn ? (
            <div className="glass rounded-2xl p-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><Eye className="size-4" /> {viewers?.length ?? 0} views</p>
              <div className="mt-2 flex -space-x-2">
                {viewers?.slice(0, 8).map((v) => <UserAvatar key={v.viewer_id} profile={v.profiles as Profile} size="xs" />)}
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={reply}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                placeholder={`Reply to ${group.user.username}…`}
                className="h-11 flex-1 rounded-full glass px-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button aria-label="Send reply" onClick={sendReply} className="grid size-11 place-items-center rounded-full bg-gradient-mode text-primary-foreground"><Send className="size-4" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
