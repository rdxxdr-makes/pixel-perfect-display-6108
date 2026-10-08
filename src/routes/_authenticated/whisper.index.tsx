import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMyCommunities } from "./whisper";

export const Route = createFileRoute("/_authenticated/whisper/")({
  component: Discover,
});

function Discover() {
  const { userId } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: mine = [] } = useMyCommunities(userId);
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", is_private: false });

  const { data: all = [] } = useQuery({
    queryKey: ["communities"],
    queryFn: async () => (await supabase.from("communities").select("*, community_members(count)").order("created_at", { ascending: false }).limit(60)).data ?? [],
  });
  const joined = new Set(mine.map((m) => m.id));

  async function join(id: string | null, invite?: string) {
    const { data, error } = await supabase.rpc("join_community", { _cid: id as string, _code: invite });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["my-communities"] });
    navigate({ to: "/whisper/$id", params: { id: data } });
  }
  async function create() {
    if (!form.name.trim()) return;
    const { data, error } = await supabase.rpc("create_community", { _name: form.name, _description: form.description, _is_private: form.is_private });
    if (error) return toast.error(error.message);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["my-communities"] });
    qc.invalidateQueries({ queryKey: ["communities"] });
    navigate({ to: "/whisper/$id", params: { id: data } });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
        <section className="relative overflow-hidden rounded-[2rem] glass p-8 md:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-gradient-mode opacity-25 blur-3xl" />
          <h1 className="relative text-3xl font-extrabold md:text-5xl">Find your <span className="text-gradient-mode">people.</span></h1>
          <p className="relative mt-3 max-w-lg text-muted-foreground">Join communities, talk in channels, follow announcements.</p>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button variant="mode" size="lg"><Plus /> Create community</Button></DialogTrigger>
              <DialogContent data-mode="whisper" className="glass rounded-3xl sm:max-w-md">
                <DialogHeader><DialogTitle>New community</DialogTitle></DialogHeader>
                <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
                <Textarea placeholder="What's it about?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl" />
                <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
                  <div><p className="text-sm font-semibold">Private</p><p className="text-xs text-muted-foreground">Invite-only. Hidden from discovery.</p></div>
                  <Switch checked={form.is_private} onCheckedChange={(v) => setForm({ ...form, is_private: v })} />
                </div>
                <Button variant="mode" onClick={create}>Create</Button>
              </DialogContent>
            </Dialog>
            <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) join(null, code.trim()); }} className="flex gap-2">
              <Input placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} className="h-10 w-40 rounded-full" />
              <Button variant="glass" size="lg" type="submit">Join</Button>
            </form>
          </div>
        </section>
        <h2 className="mb-4 mt-10 text-xl font-bold">Discover</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((c) => (
            <div key={c.id} className="flex flex-col rounded-3xl glass p-5 transition-transform hover:-translate-y-1">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-gradient-mode font-display font-bold text-primary-foreground">{c.name.slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate font-bold">{c.name}{c.is_private && <Lock className="size-3" />}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3" /> {(c.community_members as unknown as { count: number }[])[0]?.count ?? 0} members</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{c.description || "No description yet."}</p>
              <Button variant={joined.has(c.id) ? "glass" : "mode"} size="sm" className="mt-4" onClick={() => (joined.has(c.id) ? navigate({ to: "/whisper/$id", params: { id: c.id } }) : join(c.id))}>
                {joined.has(c.id) ? "Open" : "Join"}
              </Button>
            </div>
          ))}
          {all.length === 0 && <p className="text-muted-foreground">No communities yet — create the first.</p>}
        </div>
      </div>
    </div>
  );
}
