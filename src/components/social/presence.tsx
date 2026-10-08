import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const PresenceCtx = createContext<Set<string>>(new Set());

export function PresenceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel("presence:global", { config: { presence: { key: userId } } });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ at: Date.now() });
      });
    const touch = () => supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId);
    touch();
    const t = setInterval(touch, 60_000);
    return () => {
      clearInterval(t);
      touch();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return <PresenceCtx.Provider value={online}>{children}</PresenceCtx.Provider>;
}

export const usePresence = () => useContext(PresenceCtx);
