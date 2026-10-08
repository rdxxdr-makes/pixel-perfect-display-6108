import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import type { Profile } from "@/lib/social";
import { UserAvatar } from "@/components/social/Media";
import { PostGrid } from "@/components/social/PostCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — Orbit` },
      { name: "description", content: `See @${params.username}'s posts on Orbit.` },
      { property: "og:title", content: `@${params.username} — Orbit` },
      { property: "og:description", content: `See @${params.username}'s posts on Orbit.` },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { userId } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [list, setList] = useState<"followers" | "following" | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-by-name", username],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("username", username).maybeSingle()).data,
  });
  const pid = profile?.id;
  const isMe = pid === userId;

  const { data: rel } = useQuery({
    queryKey: ["follows", pid],
    enabled: !!pid,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("*").or(`follower_id.eq.${pid},following_id.eq.${pid}`);
      const rows = data ?? [];
      return {
        followers: rows.filter((r) => r.following_id === pid && r.status === "accepted"),
        following: rows.filter((r) => r.follower_id === pid && r.status === "accepted"),
        mine: rows.find((r) => r.follower_id === userId && r.following_id === pid),
      };
    },
  });
  const canView = isMe || !profile?.is_private || rel?.mine?.status === "accepted";

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", "profile", pid],
    enabled: !!pid,
    queryFn: async () => (await supabase.from("posts").select("id, media_url, media_type").eq("user_id", pid!).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: savedPosts = [] } = useQuery({
    queryKey: ["saves", "posts", userId],
    enabled: isMe && tab === "saved",
    queryFn: async () => {
      const { data } = await supabase.from("saves").select("posts(id, media_url, media_type)").eq("user_id", userId).order("created_at", { ascending: false });
      return (data ?? []).map((s) => s.posts).filter(Boolean) as { id: string; media_url: string; media_type: string }[];
    },
  });

  const listIds = list === "followers" ? rel?.followers.map((r) => r.follower_id) : rel?.following.map((r) => r.following_id);
  const { data: listPeople = [] } = useQuery({
    queryKey: ["people", listIds],
    enabled: !!listIds && listIds.length > 0,
    queryFn: async () => (await supabase.from("profiles").select("*").in("id", listIds!)).data ?? [],
  });

  async function follow() {
    if (rel?.mine) await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", pid!);
    else await supabase.from("follows").insert({ follower_id: userId, following_id: pid! });
    qc.invalidateQueries({ queryKey: ["follows", pid] });
    qc.invalidateQueries({ queryKey: ["posts"] });
  }
  async function message() {
    const { data, error } = await supabase.rpc("get_or_create_dm", { _other: pid! });
    if (error || !data) return toast.error(error?.message ?? "Couldn't open chat");
    navigate({ to: "/dm/$id", params: { id: data } });
  }

  if (isLoading) return <div className="mx-auto mt-10 h-40 max-w-3xl animate-pulse rounded-3xl bg-muted" />;
  if (!profile) return <p className="py-20 text-center text-muted-foreground">User not found.</p>;

  const followLabel = !rel?.mine ? "Follow" : rel.mine.status === "pending" ? "Requested" : "Following";

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 md:py-10">
      <section className="relative overflow-hidden rounded-[2rem] glass p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-gradient-mode opacity-20 blur-3xl" />
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-start">
          <UserAvatar profile={profile} size="xl" showOnline />
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <h1 className="text-2xl font-bold">{profile.display_name}</h1>
              {profile.is_private && <Lock className="size-4 text-muted-foreground" />}
            </div>
            <p className="text-muted-foreground">@{profile.username}</p>
            <div className="mt-4 flex justify-center gap-6 text-sm md:justify-start">
              <span><b>{posts.length}</b> posts</span>
              <button onClick={() => setList("followers")}><b>{rel?.followers.length ?? 0}</b> followers</button>
              <button onClick={() => setList("following")}><b>{rel?.following.length ?? 0}</b> following</button>
            </div>
            {profile.bio && <p className="mt-4 whitespace-pre-wrap text-sm">{profile.bio}</p>}
            <div className="mt-5 flex justify-center gap-2 md:justify-start">
              {isMe ? (
                <Button asChild variant="glass"><Link to="/settings">Edit profile</Link></Button>
              ) : (
                <>
                  <Button variant={rel?.mine ? "glass" : "mode"} onClick={follow}>{followLabel}</Button>
                  <Button variant="glass" onClick={message}><MessageCircle /> Message</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {isMe && (
        <div className="mt-6 flex justify-center gap-2">
          {(["posts", "saved"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-5 py-2 text-sm font-semibold capitalize", tab === t ? "bg-gradient-mode text-primary-foreground" : "text-muted-foreground")}>{t}</button>
          ))}
        </div>
      )}

      <div className="mt-6">
        {canView ? (
          <>
            <PostGrid posts={tab === "saved" ? savedPosts : posts} />
            {(tab === "saved" ? savedPosts : posts).length === 0 && <p className="py-16 text-center text-muted-foreground">No posts yet.</p>}
          </>
        ) : (
          <div className="rounded-[2rem] glass p-12 text-center">
            <Lock className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-bold">This account is private</h2>
            <p className="mt-1 text-sm text-muted-foreground">Follow to see their photos and videos.</p>
          </div>
        )}
      </div>

      <Dialog open={!!list} onOpenChange={(o) => !o && setList(null)}>
        <DialogContent className="glass rounded-3xl sm:max-w-sm">
          <DialogHeader><DialogTitle className="capitalize">{list}</DialogTitle></DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {(listIds?.length ? listPeople : []).map((p: Profile) => (
              <Link key={p.id} to="/u/$username" params={{ username: p.username }} onClick={() => setList(null)} className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent">
                <UserAvatar profile={p} size="sm" />
                <div><p className="text-sm font-semibold">{p.username}</p><p className="text-xs text-muted-foreground">{p.display_name}</p></div>
              </Link>
            ))}
            {!listIds?.length && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
