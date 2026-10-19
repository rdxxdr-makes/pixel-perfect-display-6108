import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Media } from "@/components/social/Media";
import { UserAvatar } from "@/components/social/Media";
import { timeAgo } from "@/lib/social";
import { Button } from "@/components/ui/button";

export const POST_SELECT = `
  id,
  user_id,
  caption,
  media_url,
  media_type,
  created_at,
  profile:profiles(id, username, display_name, avatar_url),
  likes(user_id)
`;

export interface PostRow {
  id: string;
  user_id: string;
  caption?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  created_at: string;
  profile?: {
    id?: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  likes?: { user_id: string }[] | null;
}

export function PostCard({
  post,
  userId,
  saved = false,
}: {
  post: PostRow;
  userId?: string;
  saved?: boolean;
}) {
  const [liked, setLiked] = useState(() =>
    Boolean(post?.likes?.some((l) => l.user_id === userId))
  );
  const [likeCount, setLikeCount] = useState(
    () => post?.likes?.length ?? 0
  );
  const [isSaved, setIsSaved] = useState(saved);

  async function toggleLike() {
    if (!userId || !post?.id) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)));

    if (next) {
      await supabase.from("likes").insert({ post_id: post.id, user_id: userId });
    } else {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", userId);
    }
  }

  async function toggleSave() {
    if (!userId || !post?.id) return;
    const next = !isSaved;
    setIsSaved(next);

    if (next) {
      await supabase.from("saves").insert({ post_id: post.id, user_id: userId });
    } else {
      await supabase.from("saves").delete().eq("post_id", post.id).eq("user_id", userId);
    }
  }

  const username = post?.profile?.username || "user";
  const displayName = post?.profile?.display_name || username;

  return (
    <article className="overflow-hidden rounded-[1.75rem] glass border border-white/10 bg-zinc-950/40">
      <div className="flex items-center justify-between p-4">
        <Link
          to="/u/$username"
          params={{ username }}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <UserAvatar user={post?.profile} className="size-10 rounded-full" />
          <div>
            <p className="font-semibold text-sm leading-tight text-white">{displayName}</p>
            <p className="text-xs text-muted-foreground">@{username}</p>
          </div>
        </Link>
        <span className="text-xs text-muted-foreground">
          {post?.created_at ? timeAgo(post.created_at) : ""}
        </span>
      </div>

      {post?.media_url && (
        <div className="relative aspect-square w-full bg-black/40 overflow-hidden">
          <Media
            path={post.media_url}
            type={post.media_type || "image"}
            className="size-full object-cover"
          />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLike}
              className={`rounded-full hover:bg-white/10 ${liked ? "text-rose-500 fill-rose-500" : "text-white"}`}
            >
              <Heart className={`size-5 ${liked ? "fill-current" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" asChild className="rounded-full text-white hover:bg-white/10">
              <Link to="/p/$id" params={{ id: post.id }}>
                <MessageCircle className="size-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-white hover:bg-white/10"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.origin + `/p/${post.id}`);
              }}
            >
              <Share2 className="size-5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSave}
            className={`rounded-full hover:bg-white/10 ${isSaved ? "text-amber-400 fill-amber-400" : "text-white"}`}
          >
            <Bookmark className={`size-5 ${isSaved ? "fill-current" : ""}`} />
          </Button>
        </div>

        {likeCount > 0 && (
          <p className="text-xs font-semibold text-white">
            {likeCount} {likeCount === 1 ? "like" : "likes"}
          </p>
        )}

        {post?.caption && (
          <p className="text-sm text-zinc-200">
            <span className="font-semibold text-white mr-2">{username}</span>
            {post.caption}
          </p>
        )}
      </div>
    </article>
  );
}