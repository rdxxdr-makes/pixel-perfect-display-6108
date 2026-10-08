import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, type Profile } from "@/lib/social";
import { cn } from "@/lib/utils";
import { MediaView, UserAvatar } from "./Media";

export type PostRow = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  profiles: Profile | null;
  likes: { user_id: string }[];
  comments: { count: number }[];
};

export const POST_SELECT = "*, profiles(*), likes(user_id), comments(count)";

export function usePostActions(userId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["posts"] });
    qc.invalidateQueries({ queryKey: ["post"] });
    qc.invalidateQueries({ queryKey: ["saves"] });
  };
  return {
    async toggleLike(post: PostRow) {
      const liked = post.likes.some((l) => l.user_id === userId);
      if (liked) await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", userId);
      else await supabase.from("likes").insert({ post_id: post.id, user_id: userId });
      refresh();
    },
    async toggleSave(postId: string, saved: boolean) {
      if (saved) await supabase.from("saves").delete().eq("post_id", postId).eq("user_id", userId);
      else await supabase.from("saves").insert({ post_id: postId, user_id: userId });
      toast.success(saved ? "Removed from saved" : "Saved");
      refresh();
    },
  };
}

export function PostCard({ post, userId, saved }: { post: PostRow; userId: string; saved: boolean }) {
  const actions = usePostActions(userId);
  const liked = post.likes.some((l) => l.user_id === userId);
  const p = post.profiles;

  async function share() {
    const url = `${window.location.origin}/p/${post.id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  return (
    <article className="overflow-hidden rounded-[1.75rem] glass">
      <header className="flex items-center gap-3 p-4">
        {p && (
          <Link to="/u/$username" params={{ username: p.username }} className="flex items-center gap-3">
            <UserAvatar profile={p} size="sm" />
            <span className="text-sm font-bold">{p.username}</span>
          </Link>
        )}
        <span className="text-xs text-muted-foreground">· {timeAgo(post.created_at)}</span>
      </header>
      <div onDoubleClick={() => !liked && actions.toggleLike(post)}>
        <MediaView path={post.media_url} type={post.media_type} controls={post.media_type === "video"} className="aspect-[4/5] w-full" />
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-4">
          <button aria-label="Like" onClick={() => actions.toggleLike(post)} className="transition-transform active:scale-75">
            <Heart className={cn("size-6", liked && "fill-primary text-primary")} />
          </button>
          <Link to="/p/$id" params={{ id: post.id }} aria-label="Comments"><MessageCircle className="size-6" /></Link>
          <button aria-label="Share" onClick={share}><Send className="size-6" /></button>
          <button aria-label="Save" className="ml-auto" onClick={() => actions.toggleSave(post.id, saved)}>
            <Bookmark className={cn("size-6", saved && "fill-foreground")} />
          </button>
        </div>
        <p className="text-sm font-bold">{post.likes.length} {post.likes.length === 1 ? "like" : "likes"}</p>
        {post.caption && (
          <p className="text-sm"><span className="font-bold">{p?.username}</span> {post.caption}</p>
        )}
        {(post.comments[0]?.count ?? 0) > 0 && (
          <Link to="/p/$id" params={{ id: post.id }} className="block text-sm text-muted-foreground">
            View all {post.comments[0].count} comments
          </Link>
        )}
      </div>
    </article>
  );
}

export function PostGrid({ posts }: { posts: { id: string; media_url: string; media_type: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-1 md:gap-2">
      {posts.map((p) => (
        <Link key={p.id} to="/p/$id" params={{ id: p.id }} className="group relative overflow-hidden rounded-lg md:rounded-xl">
          <MediaView path={p.media_url} type={p.media_type} className="aspect-square w-full transition-transform duration-500 group-hover:scale-105" />
        </Link>
      ))}
    </div>
  );
}
