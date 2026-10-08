import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/social";
import { UserAvatar } from "./Media";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ConvMember = { user_id: string; last_read_at: string; role: string; profiles: Profile | null };
export type Conversation = {
  id: string;
  is_group: boolean;
  name: string | null;
  photo_url: string | null;
  updated_at: string;
  muted: boolean;
  archived: boolean;
  my_last_read: string;
  members: ConvMember[];
  others: ConvMember[];
  last?: { body: string | null; created_at: string; sender_id: string; media_type: string | null; deleted_at: string | null };
  unread: number;
};

export function useConversations(userId: string) {
  return useQuery({
    queryKey: ["convos", userId],
    queryFn: async (): Promise<Conversation[]> => {
      const { data } = await supabase
        .from("conversation_members")
        .select("muted, archived, last_read_at, conversations(*, conversation_members(user_id, last_read_at, role, profiles(*)))")
        .eq("user_id", userId);
      const rows = (data ?? []).filter((r) => r.conversations);
      const ids = rows.map((r) => r.conversations!.id);
      const { data: msgs } = ids.length
        ? await supabase.from("messages").select("conversation_id, body, created_at, sender_id, media_type, deleted_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(400)
        : { data: [] };
      return rows
        .map((r) => {
          const c = r.conversations!;
          const members = c.conversation_members as unknown as ConvMember[];
          const mine = (msgs ?? []).filter((m) => m.conversation_id === c.id);
          return {
            id: c.id,
            is_group: c.is_group,
            name: c.name,
            photo_url: c.photo_url,
            updated_at: c.updated_at,
            muted: r.muted,
            archived: r.archived,
            my_last_read: r.last_read_at,
            members,
            others: members.filter((m) => m.user_id !== userId),
            last: mine[0],
            unread: mine.filter((m) => m.sender_id !== userId && m.created_at > r.last_read_at).length,
          };
        })
        .sort((a, b) => (b.last?.created_at ?? b.updated_at).localeCompare(a.last?.created_at ?? a.updated_at));
    },
  });
}

export function convTitle(c: Conversation) {
  if (c.is_group) return c.name || c.others.map((o) => o.profiles?.username).join(", ") || "Group";
  return c.others[0]?.profiles?.display_name || c.others[0]?.profiles?.username || "Chat";
}

export function ConvAvatar({ c, size = "md" }: { c: Conversation; size?: "sm" | "md" }) {
  if (!c.is_group) return <UserAvatar profile={c.others[0]?.profiles} size={size} showOnline />;
  return (
    <UserAvatar
      profile={{ id: c.id, username: c.name ?? "G", display_name: c.name ?? "G", avatar_url: c.photo_url }}
      size={size}
    />
  );
}

export function PeoplePicker({ userId, selected, onToggle, exclude = [] }: { userId: string; selected: Profile[]; onToggle: (p: Profile) => void; exclude?: string[] }) {
  const [q, setQ] = useState("");
  const { data: people = [] } = useQuery({
    queryKey: ["pick-people", q],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").neq("id", userId).limit(20);
      if (q.trim()) query = query.or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`);
      return (await query).data ?? [];
    },
  });
  return (
    <div className="space-y-2">
      <Input placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl" />
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {people.filter((p) => !exclude.includes(p.id)).map((p) => {
          const on = selected.some((s) => s.id === p.id);
          return (
            <button key={p.id} onClick={() => onToggle(p)} className={cn("flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-accent", on && "bg-accent")}>
              <UserAvatar profile={p} size="sm" showOnline />
              <div className="flex-1"><p className="text-sm font-semibold">{p.display_name}</p><p className="text-xs text-muted-foreground">@{p.username}</p></div>
              {on && <Check className="size-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NewChatDialog({ userId, children }: { userId: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [name, setName] = useState("");

  async function start() {
    let id: string | null = null;
    if (selected.length === 1) {
      const { data, error } = await supabase.rpc("get_or_create_dm", { _other: selected[0].id });
      if (error) return toast.error(error.message);
      id = data;
    } else {
      const { data, error } = await supabase.rpc("create_group", { _name: name || "New group", _members: selected.map((s) => s.id) });
      if (error) return toast.error(error.message);
      id = data;
    }
    setOpen(false);
    setSelected([]);
    setName("");
    if (id) navigate({ to: "/dm/$id", params: { id } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent data-mode="dm" className="glass rounded-3xl sm:max-w-md">
        <DialogHeader><DialogTitle>New conversation</DialogTitle></DialogHeader>
        <PeoplePicker userId={userId} selected={selected} onToggle={(p) => setSelected((s) => (s.some((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]))} />
        {selected.length > 1 && <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />}
        <Button variant="mode" disabled={selected.length === 0} onClick={start}>
          {selected.length > 1 ? `Create group (${selected.length + 1})` : "Start chat"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
