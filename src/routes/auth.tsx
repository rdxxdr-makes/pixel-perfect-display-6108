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

function usernameToEmail(u: string) {
  const hex = Array.from(new TextEncoder().encode(u)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `u${hex}@orbit.app`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
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
    if (mode === "up") {
      if ([...username].length !== 8) return toast.error("Username must be exactly 8 characters.");
      if (password.length !== 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
        return toast.error("Password must be exactly 10 characters with letters and numbers.");
    }
    setBusy(true);
    try {
      const email = usernameToEmail(username);
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw new Error(/registered/i.test(error.message) ? "Username already taken." : error.message);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("Invalid username or password.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center ambient px-4">
      <div className="glass w-full max-w-sm rounded-[2rem] p-8 shadow-glow animate-mode-in">
        <p className="font-display text-2xl font-bold">orbit<span className="text-gradient-mode">.</span></p>
        <h1 className="mt-6 text-xl font-bold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">One account. Four worlds.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" className="h-11 rounded-xl" />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "in" ? "current-password" : "new-password"} className="h-11 rounded-xl" />
          {mode === "up" && <p className="text-xs text-muted-foreground">Username: exactly 8 characters. Password: exactly 10, letters + numbers.</p>}
          <Button type="submit" variant="mode" className="w-full h-11" disabled={busy}>
            {mode === "in" ? "Login" : "Sign up"}
          </Button>
        </form>
        <button className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
