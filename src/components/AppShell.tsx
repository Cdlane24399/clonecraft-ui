import { NavLink, useLocation } from "react-router-dom";
import {
  Sparkles,
  FolderKanban,
  GaugeCircle,
  LayoutTemplate,
  Settings as SettingsIcon,
  Plus,
  Github,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app/new", label: "New Clone", icon: Plus },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/benchmarks", label: "Benchmarks", icon: GaugeCircle },
  { to: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-xl">
        <div className="px-5 h-16 flex items-center gap-2 border-b border-border/60">
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold tracking-tight">CloneCraft</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">AI</span>
          </NavLink>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <div className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Workspace</div>
          {nav.map((item) => {
            const active = pathname === item.to || (item.to === "/app/new" && pathname === "/app");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-smooth",
                  active
                    ? "bg-secondary text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.to === "/app/new" && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">⌘ N</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/60 space-y-1">
          <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60" href="#">
            <LifeBuoy className="w-4 h-4" /> Help & docs
          </a>
          <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60" href="#">
            <Github className="w-4 h-4" /> Changelog
          </a>
          <div className="mt-2 p-3 rounded-xl glass">
            <div className="text-xs text-muted-foreground">Plan</div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Pro · trial</div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gradient-primary text-primary-foreground">12d left</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border/60 bg-background/60 backdrop-blur-xl flex items-center px-4 md:px-8 gap-4 sticky top-0 z-30">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold">CloneCraft</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span>Workspace</span>
            <span className="opacity-50">/</span>
            <span className="text-foreground font-medium">Acme Studio</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> All agents online
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">EJ</div>
          </div>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
