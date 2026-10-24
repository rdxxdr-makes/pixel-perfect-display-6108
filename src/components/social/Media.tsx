import { useMediaUrl } from "@/lib/social";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MediaProps {
  path?: string | null;
  type?: string | null;
  className?: string;
  alt?: string;
  autoPlay?: boolean;
  controls?: boolean;
  onEnded?: () => void;
}

export function Media({ path, type = "image", className = "", alt = "Media", autoPlay, controls = true, onEnded }: MediaProps) {
  const { data: url, isLoading } = useMediaUrl(path);

  if (isLoading || !url) {
    return <Skeleton className={`aspect-square w-full rounded-xl bg-muted ${className}`} />;
  }

  if (type === "video" || path?.endsWith(".mp4") || path?.endsWith(".webm")) {
    return (
      <video
        src={url}
        className={`size-full object-cover ${className}`}
        controls={controls && !autoPlay}
        autoPlay={autoPlay}
        onEnded={onEnded}
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
    />
  );
}

export const MediaView = Media;

type AvatarUser = {
  avatar_url?: string | null;
  display_name?: string | null;
  username?: string | null;
} | null;

interface UserAvatarProps {
  user?: AvatarUser;
  profile?: AvatarUser;
  avatarUrl?: string | null;
  name?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  ring?: "unseen" | "seen";
  showOnline?: boolean;
}

const SIZES = { xs: "size-6", sm: "size-9", md: "size-11", lg: "size-16", xl: "size-24" };

export function UserAvatar({ user, profile, avatarUrl, name, className = "", size = "md", ring }: UserAvatarProps) {
  const u = user ?? profile;
  const rawPath = avatarUrl ?? u?.avatar_url ?? null;
  const displayName = name ?? u?.display_name ?? u?.username ?? "User";
  const { data: url } = useMediaUrl(rawPath);

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <Avatar className={cn(SIZES[size], ring === "unseen" && "ring-2 ring-primary ring-offset-2 ring-offset-background", ring === "seen" && "ring-2 ring-border ring-offset-2 ring-offset-background", className)}>
      <AvatarImage src={url ?? undefined} alt={displayName} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
