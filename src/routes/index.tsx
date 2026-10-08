import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODES } from "@/lib/social";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orbit — One app, four social worlds" },
      { name: "description", content: "Post to The Gram, vanish in 24h, DM your people and gather in Whisper communities — all with one account." },
      { property: "og:title", content: "Orbit — One app, four social worlds" },
      { property: "og:description", content: "Gram, Disappearing, DM and Whisper. One account, four worlds." },
    ],
  }),
  component: Landing,
});

const accents = ["text-gram", "text-vanish", "text-dm", "text-whisper"];

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/gram" });
    });
  }, [navigate]);

  return (
    <main className="min-h-screen ambient flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <span className="font-display text-xl font-bold">orbit<span className="text-gradient-mode">.</span></span>
        <Button asChild variant="glass" size="sm"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-6 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">One account · Four worlds</p>
        <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.02] md:text-8xl">
          Every way you <span className="text-gradient-mode">connect.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Share what lasts, post what vanishes, talk in private and gather in public — switch worlds in a tap.
        </p>
        <Button asChild variant="mode" size="lg" className="mt-10 h-14 px-10 text-base"><Link to="/auth">Enter Orbit</Link></Button>
        <div className="mt-16 grid w-full max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
          {MODES.map((m, i) => (
            <div key={m.id} className="glass rounded-3xl p-5 text-left transition-transform hover:-translate-y-1">
              <m.icon className={`mb-6 size-7 ${accents[i]}`} />
              <p className="font-display text-sm font-bold">{m.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.tagline}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="py-8" />
    </main>
  );
}
