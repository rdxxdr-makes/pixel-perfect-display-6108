import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCheck, CornerUpLeft, FileText, MoreVertical, Paperclip, Send, SmilePlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { clockTime, timeAgo, uploadMedia, useMediaUrl, type Profile } from "@/lib/social";
import { ConvAvatar, convTitle, PeoplePicker, useConversations } from "@/components/social/dm";
import { MediaView, UserAvatar } from "@/components/social/Media";
import { usePresence } from "@/components/social/presence";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dm/$id")({
  component: Chat,
});

const EMOJIS = ["❤️", "😂", "🔥", "👍", "😮", "😢"];

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  file_name: string | null;
  reply_to: string | null;
  deleted_at: string | null;
  created_at: string;
  message_reactions: { user_id: string; emoji: string }[];
};

function FileLink({ path, name }: { path: string; name: string | null }) {
  const { data: url } = useMediaUrl(path);
  return (
    <a href={url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-background/30 p-2 text-sm underline-offset-2 hover:underline">
      <FileText className="size-4" /> {name ?? "File"}
    </a>
  );
}

function Chat() {
  const { id } = Route.useParams();
  const { userId } = useMe();
  const qc = useQueryClient();
  const online = usePresence();
  const { data: convos = [] } = useConversations(userId);
  const conv = convos.find((c) => c.id === id);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [groupOpen, setGroupOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);

  const { data: msgs = [] } = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*, message_reactions(user_id, emoji)").eq("conversation_id", id).order("created_at").limit(500);
      return (data ?? []) as Msg[];
    },
  });

  // Realtime: messages, reactions, read receipts, typing
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: ["messages", id] });
    const ch = supabase
      .channel("chat:" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["convos"] }))
      .subscribe();
    const tc = supabase
      .channel("typing:" + id)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user !== userId) setTyping((t) => ({ ...t, [payload.user]: Date.now() }));
      })
      .subscribe();
    typingChannel.current = tc;
    const sweep = setInterval(() => setTyping((t) => Object.fromEntries(Object.entries(t).filter(([, v]) => Date.now() - v < 3000))), 1000);
    return () => {
      clearInterval(sweep);
      supabase.removeChannel(ch);
      supabase.removeChannel(tc);
    };
  }, [id, userId, qc]);

  // Mark read + scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", userId)
      .then(() => qc.invalidateQueries({ queryKey: ["convos"] }));
  }, [msgs.length, id, userId, qc]);

  const byId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const memberMap = useMemo(() => new Map((conv?.members ?? []).map((m) => [m.user_id, m.profiles])), [conv]);

  function onType(v: string) {
    setText(v);
    if (Date.now() - lastTypingSent.current > 1500) {
      lastTypingSent.current = Date.now();
      typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { user: userId } });
    }
  }

  async function send(extra?: { media_url: string; media_type: string; file_name: string }) {
    if (!text.trim() && !extra) return;
    const body = text;
    setText("");
    const r = replyTo;
    setReplyTo(null);
    const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: userId, body, reply_to: r?.id ?? null, ...extra });
    if (error) toast.error(error.message);
  }

  async function attach(f?: File) {
    if (!f) return;
    try {
      const { path, type } = await uploadMedia(f, userId);
      await send({ media_url: path, media_type: type, file_name: f.name });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function react(m: Msg, emoji: string) {
    const has = m.message_reactions.some((r) => r.user_id === userId && r.emoji === emoji);
    if (has) await supabase.from("message_reactions").delete().match({ message_id: m.id, user_id: userId, emoji });
    else await supabase.from("message_reactions").insert({ message_id: m.id, user_id: userId, emoji });
    qc.invalidateQueries({ queryKey: ["messages", id] });
  }

  async function remove(m: Msg) {
    await supabase.from("messages").update({ deleted_at: new Date().toISOString(), body: "", media_url: null }).eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["messages", id] });
  }

  async function updateMembership(patch: { muted?: boolean; archived?: boolean }) {
    await supabase.from("conversation_members").update(patch).eq("conversation_id", id).eq("user_id", userId);
    qc.invalidateQueries({ queryKey: ["convos"] });
  }

  function status(m: Msg) {
    const others = conv?.others ?? [];
    if (others.length && others.every((o) => o.last_read_at >= m.created_at)) return "read";
    if (others.some((o) => online.has(o.user_id) || (o.profiles?.last_seen ?? "") >= m.created_at)) return "delivered";
    return "sent";
  }

  if (!conv) return <div className="grid h-full place-items-center text-muted-foreground">Loading…</div>;

  const other = conv.others[0]?.profiles;
  const typers = Object.keys(typing).map((u) => memberMap.get(u)?.username).filter(Boolean);
  const subtitle = typers.length
    ? null
    : conv.is_group
      ? `${conv.members.length} members · ${conv.members.filter((m) => online.has(m.user_id)).length} online`
      : other && online.has(other.id)
        ? "Online"
        : other?.last_seen
          ? `Last active ${timeAgo(other.last_seen)} ago`
          : "Offline";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/50 px-4 py-3 backdrop-blur-xl">
        <Link to="/dm" className="md:hidden" aria-label="Back"><ArrowLeft className="size-5" /></Link>
        {conv.is_group ? <ConvAvatar c={conv} size="sm" /> : other && <Link to="/u/$username" params={{ username: other.username }}><UserAvatar profile={other} size="sm" showOnline /></Link>}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{convTitle(conv)}</p>
          {typers.length ? (
            <p className="flex items-center gap-1 text-xs text-primary">
              {typers.join(", ")} typing
              {[0, 1, 2].map((i) => <span key={i} className="inline-block size-1 rounded-full bg-primary animate-typing" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </p>
          ) : (
            <p className={cn("text-xs", subtitle === "Online" ? "text-online" : "text-muted-foreground")}>{subtitle}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Chat options" className="p-2 text-muted-foreground hover:text-foreground"><MoreVertical className="size-5" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {conv.is_group && <DropdownMenuItem onClick={() => setGroupOpen(true)}>Group info</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => updateMembership({ muted: !conv.muted })}>{conv.muted ? "Unmute" : "Mute"}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateMembership({ archived: !conv.archived })}>{conv.archived ? "Unarchive" : "Archive"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4 md:px-6">
        {msgs.map((m, i) => {
          const mine = m.sender_id === userId;
          const sender = memberMap.get(m.sender_id);
          const grouped = msgs[i - 1]?.sender_id === m.sender_id;
          const quoted = m.reply_to ? byId.get(m.reply_to) : null;
          const reactions = Object.entries(
            m.message_reactions.reduce<Record<string, number>>((a, r) => ((a[r.emoji] = (a[r.emoji] ?? 0) + 1), a), {}),
          );
          const isLastMine = mine && !msgs.slice(i + 1).some((x) => x.sender_id === userId);
          return (
            <div key={m.id} className={cn("group flex items-end gap-2", mine ? "justify-end" : "justify-start", !grouped && "pt-2")}>
              {!mine && conv.is_group && <div className="w-7">{!grouped && <UserAvatar profile={sender} size="xs" />}</div>}
              <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
                {!mine && conv.is_group && !grouped && <span className="mb-0.5 px-2 text-[11px] text-muted-foreground">{sender?.username}</span>}
                <div className="flex items-center gap-1">
                  {mine && !m.deleted_at && <MsgActions m={m} mine onReply={() => setReplyTo(m)} onReact={react} onDelete={remove} />}
                  <div className={cn("rounded-3xl px-4 py-2 text-sm", mine ? "bg-gradient-mode text-primary-foreground rounded-br-lg" : "glass rounded-bl-lg", m.deleted_at && "opacity-60 italic")}>
                    {quoted && (
                      <div className={cn("mb-1.5 border-l-2 pl-2 text-xs opacity-80", mine ? "border-primary-foreground/60" : "border-primary")}>
                        <b>{memberMap.get(quoted.sender_id)?.username}</b>: {quoted.deleted_at ? "deleted" : quoted.body || "media"}
                      </div>
                    )}
                    {m.deleted_at ? (
                      "Message deleted"
                    ) : (
                      <>
                        {m.media_url && (m.media_type === "image" || m.media_type === "video") && (
                          <MediaView path={m.media_url} type={m.media_type} controls={m.media_type === "video"} className="mb-1 max-h-72 w-60 rounded-2xl" />
                        )}
                        {m.media_url && m.media_type === "file" && <FileLink path={m.media_url} name={m.file_name} />}
                        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      </>
                    )}
                  </div>
                  {!mine && !m.deleted_at && <MsgActions m={m} onReply={() => setReplyTo(m)} onReact={react} onDelete={remove} />}
                </div>
                {reactions.length > 0 && (
                  <div className="-mt-1.5 flex gap-1 px-2">
                    {reactions.map(([e, n]) => (
                      <button key={e} onClick={() => react(m, e)} className="rounded-full border border-border bg-card px-1.5 text-xs">{e}{n > 1 && ` ${n}`}</button>
                    ))}
                  </div>
                )}
                {(isLastMine || !grouped) && (
                  <span className="mt-0.5 flex items-center gap-1 px-2 text-[10px] text-muted-foreground">
                    {clockTime(m.created_at)}
                    {mine && isLastMine && (status(m) === "read" ? <CheckCheck className="size-3.5 text-primary" /> : status(m) === "delivered" ? <CheckCheck className="size-3.5" /> : <Check className="size-3.5" />)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-border bg-background/50 p-3 backdrop-blur-xl">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-xs">
            <CornerUpLeft className="size-3.5 text-primary" />
            <span className="flex-1 truncate">Replying to <b>{memberMap.get(replyTo.sender_id)?.username}</b>: {replyTo.body || "media"}</span>
            <button aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X className="size-4" /></button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2">
          <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full glass text-muted-foreground hover:text-foreground" aria-label="Attach">
            <Paperclip className="size-4" />
            <input type="file" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
          </label>
          <input value={text} onChange={(e) => onType(e.target.value)} placeholder="Message" className="h-11 flex-1 rounded-full bg-muted px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-mode text-primary-foreground shadow-glow transition-transform active:scale-90"><Send className="size-4" /></button>
        </form>
      </footer>

      {conv.is_group && <GroupInfo open={groupOpen} onOpenChange={setGroupOpen} convId={id} name={conv.name ?? ""} members={conv.members.map((m) => ({ ...m.profiles!, role: m.role }))} userId={userId} />}
    </div>
  );
}

function MsgActions({ m, mine, onReply, onReact, onDelete }: { m: Msg; mine?: boolean; onReply: () => void; onReact: (m: Msg, e: string) => void; onDelete: (m: Msg) => void }) {
  return (
    <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
      <Popover>
        <PopoverTrigger aria-label="React" className="p-1 text-muted-foreground hover:text-foreground"><SmilePlus className="size-4" /></PopoverTrigger>
        <PopoverContent className="flex w-auto gap-1 rounded-full p-1.5">
          {EMOJIS.map((e) => <button key={e} onClick={() => onReact(m, e)} className="rounded-full p-1 text-lg transition-transform hover:scale-125">{e}</button>)}
        </PopoverContent>
      </Popover>
      <button aria-label="Reply" onClick={onReply} className="p-1 text-muted-foreground hover:text-foreground"><CornerUpLeft className="size-4" /></button>
      {mine && <button aria-label="Delete" onClick={() => onDelete(m)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>}
    </div>
  );
}

function GroupInfo({ open, onOpenChange, convId, name, members, userId }: { open: boolean; onOpenChange: (o: boolean) => void; convId: string; name: string; members: (Profile & { role: string })[]; userId: string }) {
  const qc = useQueryClient();
  const [n, setN] = useState(name);
  const [adding, setAdding] = useState<Profile[]>([]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["convos"] });

  async function rename() {
    await supabase.from("conversations").update({ name: n }).eq("id", convId);
    refresh();
    toast.success("Renamed");
  }
  async function photo(f?: File) {
    if (!f) return;
    const { path } = await uploadMedia(f, userId);
    await supabase.from("conversations").update({ photo_url: path }).eq("id", convId);
    refresh();
  }
  async function add() {
    const { error } = await supabase.from("conversation_members").insert(adding.map((p) => ({ conversation_id: convId, user_id: p.id })));
    if (error) return toast.error(error.message);
    setAdding([]);
    refresh();
  }
  async function leave() {
    await supabase.from("conversation_members").delete().eq("conversation_id", convId).eq("user_id", userId);
    refresh();
    onOpenChange(false);
    window.location.href = "/dm";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-mode="dm" className="glass max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader><DialogTitle>Group info</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input value={n} onChange={(e) => setN(e.target.value)} className="rounded-xl" />
          <Button variant="mode" onClick={rename}>Save</Button>
        </div>
        <label className="cursor-pointer text-sm font-semibold text-primary">
          Change group photo
          <input type="file" accept="image/*" className="hidden" onChange={(e) => photo(e.target.files?.[0])} />
        </label>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">{members.length} members</p>
          {members.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-1.5">
              <UserAvatar profile={p} size="sm" showOnline />
              <span className="flex-1 text-sm font-semibold">{p.username}</span>
              {p.role === "admin" && <span className="text-xs text-primary">admin</span>}
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-muted-foreground">Add people</p>
        <PeoplePicker userId={userId} exclude={members.map((m) => m.id)} selected={adding} onToggle={(p) => setAdding((s) => (s.some((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]))} />
        {adding.length > 0 && <Button variant="mode" onClick={add}>Add {adding.length}</Button>}
        <Button variant="ghost" className="text-destructive" onClick={leave}>Leave group</Button>
      </DialogContent>
    </Dialog>
  );
}
