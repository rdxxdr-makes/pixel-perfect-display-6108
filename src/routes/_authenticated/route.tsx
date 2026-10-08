import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Compass, Home, LogOut, PlusSquare, Settings, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { modeFromPath, MODES, type ModeId } from "@/lib/social";
import { useMe } from "@/lib/me";
import { ModeSwitcher } from "@/components/social/ModeSwitcher";
import { PresenceProvider } from "@/components/social/presence";
import { UserAvatar } from "@/components/social/Media";
import { CreatePostDialog } from "@/components/social/CreatePostDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

function AppShell() {
  const { user } = Route.useRouteContext();
  return (
    <PresenceProvider userId={user.id}>
      <Shell />
    </PresenceProvider>
  );
}

function useUnreadNotifications(userId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("notif:" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["notif"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);
  return useQuery({
    queryKey: ["notif", "unread"],
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
      return count ?? 0;
    },
  }).data ?? 0;
}

function Shell() {
  const { pathname } = useLocation();
  const mode: ModeId = modeFromPath(pathname);
  const { userId, me } = useMe();
  const unread = useUnreadNotifications(userId);
  const current = MODES.find((m) => m.id === mode)!;
  const fullBleed = mode === "dm" || mode === "whisper";

  const gramNav = [
    { to: "/gram" as const, icon: Home, label: "Feed" },
    { to: "/gram/explore" as const, icon: Compass, label: "Explore" },
  ];

  return (
    <div data-mode={mode} className="min-h-screen ambient">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-sidebar-border bg-sidebar/70 p-5 backdrop-blur-xl lg:flex">
        <Link to="/gram" className="font-display text-2xl font-bold">orbit<span className="text-gradient-mode">.</span></Link>
        <ModeSwitcher mode={mode} vertical />
        <nav className="flex flex-col gap-1 text-sm">
          {mode === "gram" &&
            gramNav.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: true }} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-accent !text-foreground" }}>
                <n.icon className="size-5" /> {n.label}
              </Link>
            ))}
          {mode === "gram" && (
            <CreatePostDialog>
              <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <PlusSquare className="size-5" /> Create
              </button>
            </CreatePostDialog>
          )}
          <Link to="/notifications" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-accent !text-foreground" }}>
            <Bell className="size-5" /> Notifications
            {unread > 0 && <span className="ml-auto rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">{unread}</span>}
          </Link>
          <Link to="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground" activeProps={{ className: "bg-accent !text-foreground" }}>
            <Settings className="size-5" /> Settings
          </Link>
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl glass p-3">
          {me && (
            <Link to="/u/$username" params={{ username: me.username }} className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar profile={me} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{me.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{me.username}</p>
              </div>
            </Link>
          )}
          <button aria-label="Sign out" onClick={() => supabase.auth.signOut()} className="text-muted-foreground hover:text-foreground">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 space-y-3 border-b border-border bg-background/70 px-4 pb-3 pt-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-bold">
            {current.label}
            <span className="text-gradient-mode">.</span>
          </span>
          <Link to="/notifications" className="relative text-muted-foreground" aria-label="Notifications">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary" />}
          </Link>
        </div>
        <ModeSwitcher mode={mode} />
      </header>

      <main className={cn("lg:pl-64", fullBleed ? "" : "pb-24 lg:pb-10")}>
        <div key={mode} className="animate-mode-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      {!fullBleed && (
        <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-full glass py-2 lg:hidden">
          <Link to="/gram" className="p-2 text-muted-foreground" activeOptions={{ exact: true }} activeProps={{ className: "!text-primary" }} aria-label="Feed"><Home className="size-6" /></Link>
          <Link to="/gram/explore" className="p-2 text-muted-foreground" activeProps={{ className: "!text-primary" }} aria-label="Explore"><Compass className="size-6" /></Link>
          <CreatePostDialog>
            <button className="grid size-11 place-items-center rounded-full bg-gradient-mode text-primary-foreground shadow-glow" aria-label="Create"><PlusSquare className="size-5" /></button>
          </CreatePostDialog>
          <Link to="/settings" className="p-2 text-muted-foreground" activeProps={{ className: "!text-primary" }} aria-label="Settings"><Settings className="size-6" /></Link>
          {me ? (
            <Link to="/u/$username" params={{ username: me.username }} className="p-1" aria-label="Profile"><UserAvatar profile={me} size="xs" /></Link>
          ) : (
            <User className="size-6 text-muted-foreground" />
          )}
        </nav>
      )}
    </div>
  );
}
