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
      // 1. Pehle standard POST_SELECT se try karo
      const { data, error } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return data as unknown as PostRow;
      }

      // 2. Fallback: simple query bina complex joins ke
      const { data: fallback, error: fallErr } = await supabase
        .from("posts")
        .select("*, profile:profiles(*)")
        .eq("id", id)
        .maybeSingle();

      if (!fallErr && fallback) {
        return fallback as unknown as PostRow;
      }

      // 3. Fallback: basic post
      const { data: basic, error: basicErr } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (basicErr || !basic) {
        throw new Error("Post not found");
      }

      return basic as unknown as PostRow;
    },
    retry: 1,
  });

  return (
    <div className="mx-auto max-w-xl px-3 py-4 md:py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/gram">
            <ArrowLeft className="size-4" />
            Back to feed
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-muted" />
      )}

      {(isError || (!isLoading && !post)) && (
        <div className="rounded-[1.75rem] glass p-10 text-center">
          <h2 className="font-display text-xl font-bold">This post is unavailable.</h2>
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