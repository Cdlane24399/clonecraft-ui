import { NavLink, useLocation } from "react-router-dom";
import {
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
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-5 h-16 flex items-center gap-2 border-b border-border">
          <NavLink to="/" className="flex items-baseline gap-2 group">
            <span className="w-2 h-2 bg-foreground translate-y-[-2px]" aria-hidden />
            <span className="font-display font-bold tracking-tight text-lg">CloneCraft</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI</span>
          </NavLink>
        </div>

        <nav className="flex-1 p-3 space-y-px">
          <div className="px-2 pt-2 pb-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Workspace</div>
          {nav.map((item) => {
            const active = pathname === item.to || (item.to === "/app/new" && pathname === "/app");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm transition-colors border-l-2",
                  active
                    ? "border-foreground text-foreground bg-secondary/60 font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                )}
              >
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
                {item.label}
                {item.to === "/app/new" && (
                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 border border-border text-muted-foreground">⌘N</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-px">
          <a className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground" href="#">
            <LifeBuoy className="w-4 h-4" strokeWidth={1.5} /> Help & docs
          </a>
          <a className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground" href="#">
            <Github className="w-4 h-4" strokeWidth={1.5} /> Changelog
          </a>
          <div className="mt-3 p-3 border border-border bg-background">
            <div className="eyebrow">Plan</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-sm font-medium">Pro · trial</div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-foreground text-background">12d</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background flex items-center px-4 md:px-10 gap-4 sticky top-0 z-30">
          <div className="md:hidden flex items-center gap-2">
            <span className="w-2 h-2 bg-foreground" />
            <span className="font-display font-bold">CloneCraft</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>Workspace</span>
            <span className="opacity-50">/</span>
            <span className="text-foreground">Acme Studio</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="w-1.5 h-1.5 bg-foreground" /> All agents online
            </div>
            <div className="w-8 h-8 bg-foreground text-background text-[11px] font-mono flex items-center justify-center">EJ</div>
          </div>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
