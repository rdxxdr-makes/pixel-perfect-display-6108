import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { uploadMedia } from "@/lib/social";
import { UserAvatar } from "@/components/social/Media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Orbit" },
      { name: "description", content: "Edit your profile and privacy, shared across every mode." },
      { property: "og:title", content: "Settings — Orbit" },
      { property: "og:description", content: "Your profile and privacy, shared across every mode." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { userId, me } = useMe();
  const qc = useQueryClient();
  const [form, setForm] = useState({ username: "", display_name: "", bio: "", is_private: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) setForm({ username: me.username, display_name: me.display_name ?? "", bio: me.bio ?? "", is_private: me.is_private });
  }, [me]);

  async function save() {
    setBusy(true);
    const username = form.username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const { error } = await supabase.from("profiles").update({ ...form, username }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message.includes("unique") ? "Username taken" : error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile-by-name"] });
  }

  async function avatar(f?: File) {
    if (!f) return;
    const { path } = await uploadMedia(f, userId);
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Photo updated");
  }

  return (
    <div className="mx-auto max-w-lg px-3 py-6 md:py-10">
      <h1 className="text-3xl font-bold">Your identity</h1>
      <p className="mt-1 text-sm text-muted-foreground">One profile across The Gram, Disappearing, The DM and Whisper.</p>
      <div className="mt-6 space-y-5 rounded-[2rem] glass p-6">
        <label className="relative mx-auto block w-fit cursor-pointer">
          <UserAvatar profile={me} size="xl" />
          <span className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full bg-gradient-mode text-primary-foreground"><Camera className="size-4" /></span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => avatar(e.target.files?.[0])} />
        </label>
        <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground">Username</label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-xl" /></div>
        <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground">Display name</label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="rounded-xl" /></div>
        <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground">Bio</label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="rounded-xl" /></div>
        <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
          <div><p className="text-sm font-semibold">Private account</p><p className="text-xs text-muted-foreground">Only approved followers see your posts and stories.</p></div>
          <Switch checked={form.is_private} onCheckedChange={(v) => setForm({ ...form, is_private: v })} />
        </div>
        <Button variant="mode" className="w-full" onClick={save} disabled={busy}>Save</Button>
      </div>
      <Button variant="ghost" className="mt-6 w-full text-destructive" onClick={() => supabase.auth.signOut()}>Sign out</Button>
    </div>
  );
}
