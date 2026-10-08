import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { clockTime } from "@/lib/social";
import { UserAvatar } from "@/components/social/Media";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/whisper/$id")({
  head: () => ({
    meta: [
      { title: "Community — Whisper — Orbit" },
      { name: "description", content: "Channels, members and conversations in your Whisper community." },
      { property: "og:title", content: "Community — Whisper — Orbit" },
      { property: "og:description", content: "Channels, members and conversations in your Whisper community." },
    ],
  }),
  component: Community,
});

function Community() {
  const { id } = Route.useParams();
  const { userId } = useMe();
  const qc = useQueryClient();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [text, setText] = useState("");

  const community = useQuery({
    queryKey: ["community", id],
    queryFn: async () => (await supabase.from("communities").select("*").eq("id", id).maybeSingle()).data,
  }).data;
  const channels = useQuery({
    queryKey: ["channels", id],
    queryFn: async () => (await supabase.from("channels").select("*").eq("community_id", id).order("position")).data ?? [],
  }).data ?? [];
  const members = useQuery({
    queryKey: ["members", id],
    queryFn: async () => (await supabase.from("community_members").select("role, user_id, profiles(*)").eq("community_id", id)).data ?? [],
  }).data ?? [];

  const active = channels.find((c) => c.id === channelId) ?? channels[0];
  const myRole = members.find((m) => m.user_id === userId)?.role;
  const staff = myRole === "admin" || myRole === "moderator";

  const messages = useQuery({
    queryKey: ["chmsgs", active?.id],
    enabled: !!active,
    queryFn: async () =>
      (await supabase.from("channel_messages").select("*, profiles(*)").eq("channel_id", active!.id).is("deleted_at", null).order("created_at").limit(200)).data ?? [],
  }).data ?? [];

  useEffect(() => {
    if (!active) return;
    const ch = supabase
      .channel("ch:" + active.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_messages", filter: `channel_id=eq.${active.id}` }, () =>
        qc.invalidateQueries({ queryKey: ["chmsgs", active.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [active?.id, qc]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !active) return;
    const { error } = await supabase.from("channel_messages").insert({ channel_id: active.id, user_id: userId, body: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
  }

  async function remove(mid: string) {
    await supabase.from("channel_messages").update({ deleted_at: new Date().toISOString() }).eq("id", mid);
    qc.invalidateQueries({ queryKey: ["chmsgs", active?.id] });
  }

  const canPost = active && (active.kind !== "announcement" || staff);

  return (
    <div className="flex h-full">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar/40 p-3 md:flex">
        <p className="mb-3 truncate font-display font-bold">{community?.name}</p>
        {channels.map((c) => (
          <button key={c.id} onClick={() => setChannelId(c.id)} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent", active?.id === c.id && "bg-accent text-foreground")}>
            {c.kind === "announcement" ? <Megaphone className="size-4" /> : <Hash className="size-4" />} {c.name}
          </button>
        ))}
        {community?.invite_code && <p className="mt-auto text-xs text-muted-foreground">Invite: /join/{community.invite_code}</p>}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3 md:hidden">
          {channels.map((c) => (
            <button key={c.id} onClick={() => setChannelId(c.id)} className={cn("shrink-0 rounded-full px-3 py-1 text-xs glass", active?.id === c.id && "bg-gradient-mode text-primary-foreground")}>#{c.name}</button>
          ))}
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className="group flex gap-3">
              <UserAvatar profile={m.profiles} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.profiles?.display_name ?? m.profiles?.username} <span className="text-xs font-normal text-muted-foreground">{clockTime(m.created_at)}</span></p>
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
              </div>
              {(staff || m.user_id === userId) && (
                <button aria-label="Delete" onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground"><Trash2 className="size-4" /></button>
              )}
            </div>
          ))}
        </div>
        {canPost ? (
          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message #${active?.name ?? ""}`} className="h-11 rounded-xl" />
            <Button type="submit" variant="mode" className="h-11">Send</Button>
          </form>
        ) : (
          <p className="border-t border-border p-4 text-center text-xs text-muted-foreground">Only admins and moderators can post here.</p>
        )}
      </section>
      <aside className="hidden w-56 shrink-0 border-l border-border p-3 xl:block">
        <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Members — {members.length}</p>
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-2 py-1.5 text-sm">
            <UserAvatar profile={m.profiles} size="xs" showOnline />
            <span className="truncate">{m.profiles?.username}</span>
            {m.role !== "member" && <span className="ml-auto text-[10px] uppercase text-primary">{m.role}</span>}
          </div>
        ))}
      </aside>
    </div>
  );
}
