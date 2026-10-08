import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Orbit" },
      { name: "description", content: "Sign in or create your Orbit account." },
      { property: "og:title", content: "Sign in — Orbit" },
      { property: "og:description", content: "One account for all four Orbit worlds." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/gram" }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && navigate({ to: "/gram" }));
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/gram", data: { username } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  }

  return (
    <main className="grid min-h-screen place-items-center ambient px-4">
      <div className="glass w-full max-w-sm rounded-[2rem] p-8 shadow-glow animate-mode-in">
        <p className="font-display text-2xl font-bold">orbit<span className="text-gradient-mode">.</span></p>
        <h1 className="mt-6 text-xl font-bold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">One account. Four worlds.</p>
        <Button variant="glass" className="mt-6 w-full h-11" onClick={google}>Continue with Google</Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && (
            <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-11 rounded-xl" />
          )}
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-xl" />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11 rounded-xl" />
          <Button type="submit" variant="mode" className="w-full h-11" disabled={busy}>
            {mode === "in" ? "Sign in" : "Sign up"}
          </Button>
        </form>
        <button className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
