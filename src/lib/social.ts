import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Camera, Ghost, MessageCircle, Radio, type LucideIcon } from "lucide-react";

export type Profile = Tables<"profiles">;
export type ModeId = "gram" | "vanish" | "dm" | "whisper";

export const MODES: {
  id: ModeId;
  label: string;
  short: string;
  path: string;
  icon: LucideIcon;
  tagline: string;
}[] = [
  { id: "gram", label: "The Gram", short: "Gram", path: "/gram", icon: Camera, tagline: "Moments worth keeping" },
  { id: "vanish", label: "Disappearing", short: "Vanish", path: "/vanish", icon: Ghost, tagline: "Gone in 24 hours" },
  { id: "dm", label: "The DM", short: "DM", path: "/dm", icon: MessageCircle, tagline: "Just between you" },
  { id: "whisper", label: "Whisper", short: "Whisper", path: "/whisper", icon: Radio, tagline: "Find your people" },
];

export function modeFromPath(pathname: string): ModeId {
  if (pathname.startsWith("/vanish")) return "vanish";
  if (pathname.startsWith("/dm")) return "dm";
  if (pathname.startsWith("/join")) return "whisper";
  return "gram";
}

export async function uploadMedia(file: File, userId: string) {
  const parts = file.name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
  const path = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw uploadError;
  }

  const type = file.type.startsWith("video") ? "video" : "image";
  return { path, type };
}

export function useMediaUrl(path?: string | null) {
  return useQuery({
    queryKey: ["media", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
        return path;
      }

      // Public URL check
      const { data: pubData } = supabase.storage.from("media").getPublicUrl(path);
      if (pubData?.publicUrl) return pubData.publicUrl;

      // Fallback Signed URL
      const { data: signedData } = await supabase.storage.from("media").createSignedUrl(path, 3600);
      return signedData?.signedUrl ?? null;
    },
  });
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}