import { useMediaUrl } from "@/lib/social";
import { Skeleton } from "@/components/ui/skeleton";

interface MediaProps {
  path?: string | null;
  type?: string | null;
  className?: string;
  alt?: string;
}

export function Media({ path, type = "image", className = "", alt = "Media" }: MediaProps) {
  const { data: url, isLoading } = useMediaUrl(path);

  if (isLoading || !url) {
    return <Skeleton className={`aspect-square w-full rounded-xl bg-muted ${className}`} />;
  }

  if (type === "video" || path?.endsWith(".mp4") || path?.endsWith(".webm")) {
    return (
      <video
        src={url}
        className={`size-full object-cover ${className}`}
        controls
        playsInline
      />
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={`size-full object-cover ${className}`}
      onError={(e) => {
        // Fallback agar Supabase direct URL deny kare
        const target = e.currentTarget;
        if (!target.dataset.triedPublic && path) {
          target.dataset.triedPublic = "true";
          target.src = `https://kvcevknhtaxesftoiwxc.supabase.co/storage/v1/object/public/media/${path}`;
        }
      }}
    />
  );
}