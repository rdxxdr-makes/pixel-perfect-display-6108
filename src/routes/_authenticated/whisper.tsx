import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/whisper")({
  head: () => ({
    meta: [
      { title: "Whisper — Orbit" },
      { name: "description", content: "Communities, channels and announcements for your people." },
      { property: "og:title", content: "Whisper — Orbit" },
      { property: "og:description", content: "Communities, channels and announcements for your people." },
    ],
  }),
  component: WhisperLayout,
});

export function useMyCommunities(userId: string) {
  return useQuery({
    queryKey: ["my-communities", userId],
    queryFn: async () => {
      const { data } = await supabase.from("community_members").select("role, communities(*)").eq("user_id", userId);
      return (data ?? []).filter((r) => r.communities).map((r) => ({ ...r.communities!, role: r.role }));
    },
  });
}

function WhisperLayout() {
  const { userId } = useMe();
  const params = useParams({ strict: false }) as { id?: string };
  const { data: mine = [] } = useMyCommunities(userId);
  return (
    <div className="flex h-[calc(100dvh-7.25rem)] lg:h-screen">
      <nav className="flex w-[72px] shrink-0 flex-col items-center gap-3 overflow-y-auto border-r border-border bg-sidebar/60 py-4">
        <Link to="/whisper" aria-label="Discover" className={cn("grid size-12 place-items-center rounded-2xl glass transition-all hover:rounded-xl", !params.id && "bg-gradient-mode text-primary-foreground")}>
          <Compass className="size-5" />
        </Link>
        <div className="h-px w-8 bg-border" />
        {mine.map((c) => (
          <Link key={c.id} to="/whisper/$id" params={{ id: c.id }} title={c.name} className="group relative">
            <span className={cn("absolute -left-3 top-1/2 h-0 w-1 -translate-y-1/2 rounded-r bg-primary transition-all", params.id === c.id ? "h-8" : "group-hover:h-4")} />
            <div className={cn("grid size-12 place-items-center rounded-3xl bg-secondary font-display text-sm font-bold transition-all group-hover:rounded-xl", params.id === c.id && "rounded-xl bg-gradient-mode text-primary-foreground")}>
              {c.name.slice(0, 2).toUpperCase()}
            </div>
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1"><Outlet /></div>
    </div>
  );
}
