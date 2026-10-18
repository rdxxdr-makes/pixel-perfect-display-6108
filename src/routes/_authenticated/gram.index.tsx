import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ghost } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { PostCard, POST_SELECT, type PostRow } from "@/components/social/PostCard";
import { StoryRail, StoryViewer, useStoryGroups } from "@/components/social/stories";
import { CreatePostDialog } from "@/components/social/CreatePostDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/gram/")({
  head: () => ({
    meta: [
      { title: "The Gram ⸱ Orbit" },
      { name: "description", content: "Your feed of photos and videos from the people you follow." },
      { property: "og:title", content: "The Gram ⸱ Orbit" },
      { property: "og:description", content: "Photos and videos from the people you follow." },
    ],
  }),
  component: Feed,
});

export function useSavedIds(userId: string) {
  return useQuery({
    queryKey: ["saves", userId],
    queryFn: async () => {
      const { data } = await supabase.from("saves").select("post_id").eq("user_id", userId);
      return new Set((data ?? []).map((s) => s.post_id));
    },
  }).data ?? new Set<string>();
}

function Feed() {
  const { userId } = useMe();
  const saved = useSavedIds(userId);
  const { data: groups = [] } = useStoryGroups(userId);
  const [viewer, setViewer] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["posts", "feed", userId],
    queryFn: async () => {
      const { data: f } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .eq("status", "accepted");

      const followingIds = (f ?? []).map((x) => x.following_id);
      const ids = [userId, ...followingIds];

      if (followingIds.length > 0) {
        const { data: mine } = await supabase
          .from("posts")
          .select(POST_SELECT)
          .in("user_id", ids)
          .order("created_at", { ascending: false })
          .limit(50);

        if (mine && mine.length > 0) {
          return { posts: mine as unknown as PostRow[], discover: false };
        }
      }

      const { data: all, error: allErr } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .limit(50);

      if (allErr) throw allErr;

      return { posts: (all ?? []) as unknown as PostRow[], discover: true };
    },
  });

  return (
    <div className="mx-auto max-w-xl px-3 py-4 md:py-8">
      <div className="mb-4 rounded-[1.75rem] glass px-4 py-2">
        <StoryRail
          groups={groups}
          onOpen={setViewer}
          leading={
            <Link to="/vanish" className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
              <div className="grid size-16 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground">
                <Ghost className="size-6" />
              </div>
              <span className="text-xs text-muted-foreground">Your story</span>
            </Link>
          }
        />
      </div>

      {data?.discover && (data.posts.length > 0) && (
        <p className="mb-4 px-2 text-sm text-muted-foreground">
          Fresh from across Orbit ⸱ follow people to personalise your feed.
        </p>
      )}

      {isLoading && (
        <div className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-muted" />
      )}

      {isError && !data && (
        <div className="rounded-[1.75rem] glass p-10 text-center">
          <h2 className="font-display text-xl font-bold">Couldn't load your feed</h2>
          <Button variant="mode" className="mt-6" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && data.posts.length === 0 && !isLoading && (
        <div className="rounded-[1.75rem] glass p-10 text-center">
          <h2 className="font-display text-xl font-bold">Nothing here yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Be the first to share a moment.</p>
          <CreatePostDialog>
            <Button variant="mode" className="mt-6">Create a post</Button>
          </CreatePostDialog>
        </div>
      )}

      <div className="space-y-6">
        {data?.posts.map((p) => (
          <PostCard key={p.id} post={p} userId={userId} saved={saved.has(p.id)} />
        ))}
      </div>

      {viewer !== null && (
        <StoryViewer
          groups={groups}
          start={viewer}
          userId={userId}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}