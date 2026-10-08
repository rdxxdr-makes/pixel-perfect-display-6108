import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { timeAgo, type Profile } from "@/lib/social";
import { UserAvatar } from "@/components/social/Media";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Orbit" },
      { name: "description", content: "Likes, comments, follows and requests." },
      { property: "og:title", content: "Notifications — Orbit" },
      { property: "og:description", content: "Likes, comments, follows and requests." },
    ],
  }),
  component: Notifications,
});

const text: Record<string, string> = {
  like: "liked your post",
  comment: "commented:",
  follow: "started following you",
  follow_request: "requested to follow you",
};

function Notifications() {
  const { userId } = useMe();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notif", "list"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*, actor:profiles!notifications_actor_id_fkey(*)").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  const { data: pending = [] } = useQuery({
    queryKey: ["notif", "pending"],
    queryFn: async () => (await supabase.from("follows").select("follower_id").eq("following_id", userId).eq("status", "pending")).data?.map((r) => r.follower_id) ?? [],
  });

  useEffect(() => {
    supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false).then(() => qc.invalidateQueries({ queryKey: ["notif", "unread"] }));
  }, [userId, qc]);

  async function respond(followerId: string, accept: boolean) {
    if (accept) await supabase.from("follows").update({ status: "accepted" }).eq("follower_id", followerId).eq("following_id", userId);
    else await supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", userId);
    qc.invalidateQueries({ queryKey: ["notif"] });
    qc.invalidateQueries({ queryKey: ["follows"] });
  }

  return (
    <div className="mx-auto max-w-xl px-3 py-6 md:py-10">
      <h1 className="mb-6 text-3xl font-bold">Activity</h1>
      <div className="space-y-2">
        {data.map((n) => {
          const a = n.actor as Profile | null;
          if (!a) return null;
          return (
            <div key={n.id} className="flex items-center gap-3 rounded-2xl glass p-3">
              <Link to="/u/$username" params={{ username: a.username }}><UserAvatar profile={a} size="md" /></Link>
              <p className="flex-1 text-sm">
                <b>{a.username}</b> {text[n.type] ?? n.type} {n.body && <span className="text-muted-foreground">{n.body}</span>}
                <span className="ml-2 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
              </p>
              {n.type === "follow_request" && pending.includes(a.id) && (
                <div className="flex gap-1">
                  <Button size="sm" variant="mode" onClick={() => respond(a.id, true)}>Accept</Button>
                  <Button size="sm" variant="glass" onClick={() => respond(a.id, false)}>Decline</Button>
                </div>
              )}
              {n.post_id && <Link to="/p/$id" params={{ id: n.post_id }} className="text-xs font-semibold text-primary">View</Link>}
            </div>
          );
        })}
        {data.length === 0 && <p className="py-20 text-center text-muted-foreground">No activity yet.</p>}
      </div>
    </div>
  );
}
