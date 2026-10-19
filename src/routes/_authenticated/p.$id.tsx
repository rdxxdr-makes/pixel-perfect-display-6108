import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { PostCard, POST_SELECT, type PostRow } from "@/components/social/PostCard";
import { useSavedIds } from "@/routes/_authenticated/gram.index";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/p/$id")({
  head: () => ({
    meta: [{ title: "Post ⸱ Orbit" }],
  }),
  component: PostView,
});

function PostView() {
  const { id } = Route.useParams();
  const { userId } = useMe();
  const saved = useSavedIds(userId);

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      // Step 1: Query post with full relation
      const { data: fullPost, error: fullErr } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (!fullErr && fullPost) {
        return fullPost as unknown as PostRow;
      }

      // Step 2: Fallback - get single post safely
      const { data: rawPost, error: rawErr } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (rawErr || !rawPost) {
        throw new Error("Post not found");
      }

      // Step 3: Fetch post creator profile separately
      let profileData = null;
      if (rawPost.user_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", rawPost.user_id)
          .maybeSingle();
        profileData = p;
      }

      // Step 4: Fetch likes safely
      const { data: likesData } = await supabase
        .from("likes")
        .select("user_id")
        .eq("post_id", id);

      return {
        ...rawPost,
        profile: profileData,
        likes: likesData ?? [],
      } as PostRow;
    },
    retry: 1,
  });

  return (
    <div className="mx-auto max-w-xl px-3 py-4 md:py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-white hover:bg-white/10">
          <Link to="/gram">
            <ArrowLeft className="size-4" />
            Back to feed
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="aspect-square animate-pulse rounded-[1.75rem] bg-muted/30" />
      )}

      {(isError || (!isLoading && !post)) && (
        <div className="rounded-[1.75rem] glass p-10 text-center border border-white/10">
          <h2 className="font-display text-xl font-bold text-white">This post is unavailable.</h2>
          <Button asChild variant="mode" className="mt-6">
            <Link to="/gram">Go to feed</Link>
          </Button>
        </div>
      )}

      {post && (
        <PostCard post={post} userId={userId} saved={saved.has(post.id)} />
      )}
    </div>
  );
}