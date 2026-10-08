import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a community — Orbit" },
      { name: "description", content: "You've been invited to a Whisper community." },
      { property: "og:title", content: "Join a community — Orbit" },
      { property: "og:description", content: "You've been invited to a Whisper community." },
    ],
  }),
  component: Join,
});

function Join() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("join_community", { _cid: null as unknown as string, _code: code }).then(({ data, error }) => {
      if (error || !data) setErr(error?.message ?? "Invite invalid");
      else navigate({ to: "/whisper/$id", params: { id: data }, replace: true });
    });
  }, [code, navigate]);
  return <div className="grid h-[60vh] place-items-center text-muted-foreground">{err ?? "Joining…"}</div>;
}
