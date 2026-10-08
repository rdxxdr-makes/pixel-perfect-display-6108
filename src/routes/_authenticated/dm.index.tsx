import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dm/")({
  component: () => (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-gradient-mode text-primary-foreground shadow-glow"><MessageCircle className="size-9" /></div>
        <h2 className="mt-6 text-2xl font-bold">Your private space</h2>
        <p className="mt-2 text-sm text-muted-foreground">Pick a conversation or start a new one.</p>
      </div>
    </div>
  ),
});
