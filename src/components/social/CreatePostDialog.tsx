import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/social";
import { useMe } from "@/lib/me";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CreatePostDialog({ children }: { children: ReactNode }) {
  const { userId } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function publish() {
    if (!file) return;
    setBusy(true);
    try {
      const { path, type } = await uploadMedia(file, userId);
      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        media_url: path,
        media_type: type,
        caption,
      });
      if (error) throw error;
      toast.success("Posted to The Gram");
      qc.invalidateQueries({ queryKey: ["posts"] });
      setOpen(false);
      setFile(null);
      setPreview(null);
      setCaption("");
    } catch (e: any) {
      console.error("Publish error:", e);
      toast.error(e?.message || "Failed to upload post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent data-mode="gram" className="glass rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">New post</DialogTitle>
        </DialogHeader>
        <label className="relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-border text-center hover:border-foreground/40">
          {preview ? (
            file?.type.startsWith("video") ? (
              <video src={preview} className="size-full object-cover" autoPlay muted loop playsInline />
            ) : (
              <img src={preview} alt="Preview" className="size-full object-cover" />
            )
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImagePlus className="size-8" />
              <span className="text-xs">Click to select photo or video</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        <Textarea
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="mode" disabled={!file || busy} onClick={publish}>
            {busy ? "Posting..." : "Share"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}