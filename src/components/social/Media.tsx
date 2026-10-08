import { cn } from "@/lib/utils";
import { useMediaUrl, type Profile } from "@/lib/social";
import { usePresence } from "./presence";

export function MediaView({
  path,
  type,
  className,
  controls,
  autoPlay,
  onEnded,
}: {
  path: string;
  type?: string | null;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  onEnded?: () => void;
}) {
  const { data: url } = useMediaUrl(path);
  if (!url) return <div className={cn("animate-pulse bg-muted", className)} />;
  if (type === "video")
    return (
      <video
        src={url}
        className={cn("object-cover", className)}
        controls={controls}
        autoPlay={autoPlay}
        muted={!controls}
        loop={!onEnded}
        playsInline
        onEnded={onEnded}
      />
    );
  return <img src={url} alt="" loading="lazy" className={cn("object-cover", className)} />;
}

const sizes = { xs: "size-7 text-[10px]", sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-16 text-lg", xl: "size-24 text-2xl md:size-32" };

export function UserAvatar({
  profile,
  size = "md",
  ring,
  showOnline,
  className,
}: {
  profile?: Pick<Profile, "id" | "username" | "avatar_url" | "display_name"> | null;
  size?: keyof typeof sizes;
  ring?: "unseen" | "seen";
  showOnline?: boolean;
  className?: string;
}) {
  const { data: url } = useMediaUrl(profile?.avatar_url);
  const online = usePresence().has(profile?.id ?? "");
  const initial = (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase();
  const inner = (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full bg-gradient-mode font-display font-bold text-primary-foreground grid place-items-center", sizes[size], ring && "border-2 border-background")}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : initial}
    </div>
  );
  return (
    <div className={cn("relative shrink-0", className)}>
      {ring ? (
        <div className={cn("rounded-full p-[2.5px]", ring === "unseen" ? "story-ring" : "bg-muted")}>{inner}</div>
      ) : (
        inner
      )}
      {showOnline && online && (
        <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-online" />
      )}
    </div>
  );
}
