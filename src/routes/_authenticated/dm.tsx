import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, BellOff, PenSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { timeAgo } from "@/lib/social";
import { ConvAvatar, convTitle, NewChatDialog, useConversations } from "@/components/social/dm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dm")({
  head: () => ({
    meta: [
      { title: "The DM — Orbit" },
      { name: "description", content: "Private messages and group chats, in real time." },
      { property: "og:title", content: "The DM — Orbit" },
      { property: "og:description", content: "Private messages and group chats, in real time." },
    ],
  }),
  component: DMLayout,
});

function DMLayout() {
  const { userId } = useMe();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { id?: string };
  const { data: convos = [] } = useConversations(userId);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("dm-list:" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["convos"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const list = convos
    .filter((c) => c.archived === showArchived)
    .filter((c) => !q.trim() || convTitle(c).toLowerCase().includes(q.toLowerCase()) || c.others.some((o) => o.profiles?.username.includes(q.toLowerCase())));

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] lg:h-screen">
      <aside className={cn("w-full flex-col border-r border-border md:flex md:w-80 xl:w-96", params.id ? "hidden" : "flex")}>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Chats</h1>
            <NewChatDialog userId={userId}>
              <button aria-label="New chat" className="grid size-10 place-items-center rounded-full bg-gradient-mode text-primary-foreground shadow-glow"><PenSquare className="size-4" /></button>
            </NewChatDialog>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="h-10 w-full rounded-full bg-muted pl-9 pr-3 text-sm outline-none" />
          </div>
          <button onClick={() => setShowArchived(!showArchived)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <Archive className="size-3.5" /> {showArchived ? "Back to inbox" : `Archived (${convos.filter((c) => c.archived).length})`}
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {list.map((c) => (
            <Link key={c.id} to="/dm/$id" params={{ id: c.id }} className={cn("flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-accent", params.id === c.id && "bg-accent")}>
              <ConvAvatar c={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{convTitle(c)}</p>
                  {c.muted && <BellOff className="size-3 text-muted-foreground" />}
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{c.last && timeAgo(c.last.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className={cn("truncate text-sm", c.unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {c.last ? (c.last.deleted_at ? "Message deleted" : c.last.body || (c.last.media_type ? `📎 ${c.last.media_type}` : "")) : "Say hi 👋"}
                  </p>
                  {c.unread > 0 && !c.muted && <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{c.unread}</span>}
                </div>
              </div>
            </Link>
          ))}
          {list.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</p>}
        </div>
      </aside>
      <section className={cn("min-w-0 flex-1", !params.id && "hidden md:block")}>
        <Outlet />
      </section>
    </div>
  );
}
