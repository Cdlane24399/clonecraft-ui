import { NavLink, useLocation } from "react-router-dom";
import { useUser, UserButton } from "@clerk/clerk-react";
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
import { BrandLogo } from "@/components/BrandLogo";

const nav = [
  { to: "/app/new", label: "New Clone", icon: Plus },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/benchmarks", label: "Benchmarks", icon: GaugeCircle },
  { to: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || email || "U").trim();
  if (!source) return "U";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, isLoaded } = useUser();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses[0]?.emailAddress ||
    "Default";
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null;
  const initials = isLoaded ? initialsFor(displayName, email) : "…";

  return (
    <div className="h-screen flex w-full bg-background overflow-hidden">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar/80 backdrop-blur-xl overflow-y-auto">
        <div className="px-5 h-16 flex items-center gap-2 shrink-0">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <BrandLogo />
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

        <div className="p-3 mt-auto space-y-1">
          <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60" href="#">
            <LifeBuoy className="w-4 h-4" /> Help & docs
          </a>
          <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60" href="#">
            <Github className="w-4 h-4" /> Changelog
          </a>
          <div className="mt-2 p-3 rounded-xl border border-border/60 bg-card/60">
            <div className="text-xs text-muted-foreground">Plan</div>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Free</div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">launch soon</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-background/60 backdrop-blur-xl flex items-center px-4 md:px-8 gap-4 z-30">
          <div className="md:hidden flex items-center gap-2">
            <BrandLogo markClassName="h-7 w-7 rounded-md" textClassName="tracking-normal" />
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span>Workspace</span>
            <span className="opacity-50">/</span>
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {isLoaded ? displayName : "Default"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-success" /> All agents online
            </div>
            {isLoaded && user ? (
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 ring-1 ring-border/60",
                  },
                }}
                userProfileProps={{
                  appearance: {
                    elements: {
                      card: "bg-card border border-border/60",
                    },
                  },
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-secondary border border-border/60 text-foreground text-xs font-semibold flex items-center justify-center">
                {initials}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
