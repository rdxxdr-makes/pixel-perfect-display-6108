import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { timeAgo, type Profile } from "@/lib/social";
import { PostCard, POST_SELECT, type PostRow } from "@/components/social/PostCard";
import { UserAvatar } from "@/components/social/Media";
import { Button } from "@/components/ui/button";
import { useSavedIds } from "./gram.index";

export const Route = createFileRoute("/_authenticated/p/$id")({
  head: () => ({
    meta: [
      { title: "Post — Orbit" },
      { name: "description", content: "A moment shared on The Gram." },
      { property: "og:title", content: "Post — Orbit" },
      { property: "og:description", content: "A moment shared on The Gram." },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const { userId } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const saved = useSavedIds(userId);
  const [body, setBody] = useState("");

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
      return data as unknown as PostRow | null;
    },
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data } = await supabase.from("comments").select("*, profiles(*)").eq("post_id", id).order("created_at");
      return data ?? [];
    },
  });

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await supabase.from("comments").insert({ post_id: id, user_id: userId, body });
    setBody("");
    qc.invalidateQueries({ queryKey: ["comments", id] });
    qc.invalidateQueries({ queryKey: ["post", id] });
  }

  async function deletePost() {
    await supabase.from("posts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["posts"] });
    navigate({ to: "/gram" });
  }

  if (isLoading) return <div className="mx-auto mt-10 aspect-[4/5] max-w-xl animate-pulse rounded-3xl bg-muted" />;
  if (!post) return <p className="py-20 text-center text-muted-foreground">This post is unavailable.</p>;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-3 py-4 md:py-8">
      <PostCard post={post} userId={userId} saved={saved.has(post.id)} />
      {post.user_id === userId && (
        <Button variant="ghost" size="sm" onClick={deletePost} className="text-destructive"><Trash2 /> Delete post</Button>
      )}
      <div className="space-y-3 rounded-[1.75rem] glass p-4">
        <h2 className="text-sm font-bold">Comments</h2>
        {comments.map((c) => {
          const p = c.profiles as Profile;
          return (
            <div key={c.id} className="flex gap-3">
              <UserAvatar profile={p} size="xs" />
              <p className="flex-1 text-sm">
                <Link to="/u/$username" params={{ username: p.username }} className="font-bold">{p.username}</Link> {c.body}
                <span className="ml-2 text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
              </p>
            </div>
          );
        })}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        <form onSubmit={addComment} className="flex gap-2 pt-2">
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" className="h-10 flex-1 rounded-full bg-muted px-4 text-sm outline-none" />
          <Button variant="mode" size="sm" className="h-10" type="submit">Post</Button>
        </form>
      </div>
    </div>
  );
}
