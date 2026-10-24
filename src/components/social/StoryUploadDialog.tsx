import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImageUp, Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/social";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function StoryUploadDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(f?: File) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function reset() {
    setFile(null);
    setPreview(null);
    setCaption("");
  }

  async function share() {
    if (!file || !userId) return;
    setBusy(true);
    try {
      const { path, type } = await uploadMedia(file, userId);
      const { error } = await supabase.from("stories").insert({ user_id: userId, media_url: path, media_type: type, caption });
      if (error) throw error;
      toast.success("Your story is live for 24 hours");
      await qc.invalidateQueries({ queryKey: ["stories"] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't share story");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent data-mode="gram" className="glass rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Your story</DialogTitle>
        </DialogHeader>
        <div className="relative aspect-[9/16] max-h-[60vh] overflow-hidden rounded-2xl border border-dashed border-border">
          {preview ? (
            file?.type.startsWith("video") ? (
              <video src={preview} className="absolute inset-0 size-full object-cover" autoPlay muted loop playsInline />
            ) : (
              <img src={preview} alt="Story preview" className="absolute inset-0 size-full object-cover" />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
              <label className="grid size-20 cursor-pointer place-items-center rounded-full bg-gradient-mode text-primary-foreground shadow-glow active:scale-90">
                <Camera className="size-7" />
                <input type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold">
                <ImageUp className="size-4" /> Upload from library
                <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
            </div>
          )}
        </div>
        {preview && (
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption…" className="h-11 w-full rounded-full bg-muted px-4 text-sm outline-none" />
        )}
        <div className="flex justify-end gap-2">
          {preview && <Button variant="ghost" onClick={reset} disabled={busy}>Retake</Button>}
          <Button variant="mode" disabled={!file || busy} onClick={share}>
            {busy ? <><Loader2 className="mr-2 size-4 animate-spin" />Sharing…</> : <><Timer /> Share for 24h</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
