import { useMediaUrl } from "@/lib/social";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
        const target = e.currentTarget;
        if (!target.dataset.triedPublic && path) {
          target.dataset.triedPublic = "true";
          target.src = `https://kvcevknhtaxesftoiwxc.supabase.co/storage/v1/object/public/media/${path}`;
        }
      }}
    />
  );
}

// Routes jo MediaView expect karte hain
export const MediaView = Media;

// Routes jo UserAvatar expect karte hain
interface UserAvatarProps {
  user?: {
    avatar_url?: string | null;
    display_name?: string | null;
    username?: string | null;
  } | null;
  avatarUrl?: string | null;
  name?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ user, avatarUrl, name, className = "" }: UserAvatarProps) {
  const rawPath = avatarUrl ?? user?.avatar_url ?? null;
  const displayName = name ?? user?.display_name ?? user?.username ?? "User";
  const { data: url } = useMediaUrl(rawPath);

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <Avatar className={className}>
      <AvatarImage src={url ?? undefined} alt={displayName} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}