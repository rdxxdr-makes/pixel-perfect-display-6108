import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostGrid } from "@/components/social/PostCard";
import { UserAvatar } from "@/components/social/Media";

export const Route = createFileRoute("/_authenticated/gram/explore")({
  head: () => ({
    meta: [
      { title: "Explore — Orbit" },
      { name: "description", content: "Discover people and posts across Orbit." },
      { property: "og:title", content: "Explore — Orbit" },
      { property: "og:description", content: "Discover people and posts across Orbit." },
    ],
  }),
  component: Explore,
});

function Explore() {
  const [q, setQ] = useState("");
  const term = q.trim();

  const { data: people = [] } = useQuery({
    queryKey: ["search-people", term],
    enabled: term.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(12);
      return data ?? [];
    },
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["posts", "explore", term],
    queryFn: async () => {
      let query = supabase.from("posts").select("id, media_url, media_type").order("created_at", { ascending: false }).limit(60);
      if (term) query = query.ilike("caption", `%${term}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-3 py-4 md:py-8">
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people and posts" className="h-12 w-full rounded-full glass pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {people.length > 0 && (
        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          {people.map((p) => (
            <Link key={p.id} to="/u/$username" params={{ username: p.username }} className="flex items-center gap-3 rounded-2xl glass p-3 hover:bg-accent">
              <UserAvatar profile={p} size="md" showOnline />
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.display_name}</p>
                <p className="truncate text-sm text-muted-foreground">@{p.username}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <PostGrid posts={posts} />
      {posts.length === 0 && <p className="py-20 text-center text-muted-foreground">No posts found.</p>}
    </div>
  );
}
