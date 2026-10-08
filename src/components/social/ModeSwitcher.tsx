import { Link } from "@tanstack/react-router";
import { MODES, type ModeId } from "@/lib/social";
import { cn } from "@/lib/utils";

export function ModeSwitcher({ mode, vertical }: { mode: ModeId; vertical?: boolean }) {
  const idx = MODES.findIndex((m) => m.id === mode);
  return (
    <div className={cn("glass relative rounded-full p-1", vertical ? "flex flex-col rounded-3xl" : "grid grid-cols-4")}>
      <span
        aria-hidden
        className={cn(
          "absolute bg-gradient-mode shadow-glow transition-all duration-500 ease-[cubic-bezier(.2,.9,.2,1.1)]",
          vertical ? "left-1 right-1 h-12 rounded-2xl" : "top-1 bottom-1 rounded-full",
        )}
        style={
          vertical
            ? { top: `calc(${idx} * 3rem + 0.25rem)` }
            : { width: "calc(25% - 0.125rem)", left: `calc(${idx} * 25% + 0.125rem)` }
        }
      />
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <Link
            key={m.id}
            to={m.path}
            className={cn(
              "relative z-10 flex items-center gap-2 font-semibold transition-colors",
              vertical ? "h-12 px-4 text-sm" : "h-10 justify-center text-xs",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <m.icon className="size-4 shrink-0" />
            <span className={cn(!vertical && !active && "hidden sm:inline")}>{vertical ? m.label : m.short}</span>
          </Link>
        );
      })}
    </div>
  );
}
