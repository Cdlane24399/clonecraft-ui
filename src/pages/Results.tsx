import { useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, CheckCircle2, Download, Github, ExternalLink, Rocket,
  AlertTriangle, AlertCircle, Sparkles, FileCode2, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { k: "Visual accuracy", v: "94%", tone: "primary" },
  { k: "Responsive", v: "98%", tone: "accent" },
  { k: "Build status", v: "Passing", tone: "success" },
  { k: "Pages", v: "7", tone: "muted" },
  { k: "Components", v: "28", tone: "muted" },
  { k: "Assets", v: "46", tone: "muted" },
  { k: "Accessibility", v: "91", tone: "accent" },
  { k: "Prod readiness", v: "Medium", tone: "warning" },
];

const pages = [
  { path: "/", title: "Home", status: "ready", acc: 96 },
  { path: "/pricing", title: "Pricing", status: "ready", acc: 94 },
  { path: "/features", title: "Features", status: "ready", acc: 92 },
  { path: "/blog", title: "Blog index", status: "review", acc: 86 },
  { path: "/login", title: "Login", status: "ready", acc: 97 },
  { path: "/signup", title: "Sign up", status: "review", acc: 89 },
  { path: "/dashboard", title: "Dashboard", status: "draft", acc: 78 },
];

const components = [
  { name: "Navbar", count: 1, conf: 0.98 },
  { name: "Hero", count: 1, conf: 0.96 },
  { name: "FeatureGrid", count: 2, conf: 0.93 },
  { name: "PricingCard", count: 3, conf: 0.95 },
  { name: "TestimonialCard", count: 4, conf: 0.9 },
  { name: "FAQ", count: 1, conf: 0.92 },
  { name: "Footer", count: 1, conf: 0.99 },
  { name: "Modal", count: 2, conf: 0.88 },
  { name: "SignupForm", count: 1, conf: 0.94 },
  { name: "Badge", count: 6, conf: 0.97 },
  { name: "Avatar", count: 5, conf: 0.96 },
  { name: "Button", count: 9, conf: 0.99 },
];

const colors = [
  { name: "Primary", val: "#7C5CFC" },
  { name: "Primary Glow", val: "#A37BFE" },
  { name: "Accent", val: "#22D3EE" },
  { name: "Background", val: "#0B0B12" },
  { name: "Surface", val: "#13131C" },
  { name: "Border", val: "#23232E" },
];

const issues = [
  { sev: "high", title: "One unresolved SVG asset on /pricing", fix: "Re-fetch with auth header or replace with inline SVG fallback." },
  { sev: "med", title: "Missing hover animation on PricingCard CTA", fix: "Apply transition-transform + hover:-translate-y-0.5 to button." },
  { sev: "med", title: "Mobile spacing differs on Hero by 12px", fix: "Switch py-16 to py-20 at md breakpoint." },
  { sev: "low", title: "Font fallback mismatch on body", fix: "Add 'Inter' before sans-serif in fontFamily stack." },
  { sev: "low", title: "Alt text missing on 3 marketing images", fix: "Generate descriptive alt via vision agent." },
];

const tree = [
  { name: "app", type: "folder", children: ["layout.tsx", "page.tsx", "(marketing)/", "(auth)/"] },
  { name: "components", type: "folder", children: ["Navbar.tsx", "Hero.tsx", "PricingCard.tsx", "Footer.tsx", "ui/"] },
  { name: "styles", type: "folder", children: ["globals.css", "tokens.css"] },
  { name: "lib", type: "folder", children: ["utils.ts", "seo.ts"] },
  { name: "public", type: "folder", children: ["logo.svg", "og.png", "screenshots/"] },
];

export default function Results() {
  const [tab, setTab] = useState("overview");
  const url = (typeof window !== "undefined" && sessionStorage.getItem("cc:lastUrl")) || "https://example.com";
  const projectName = projectFromUrl(url);

  return (
    <AppShell>
      <div className="container max-w-7xl py-10">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div>
            <Link to="/app/projects" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-3 h-3 mr-1" /> Projects
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{projectName}</h1>
                <div className="text-xs text-muted-foreground font-mono">{url} · generated 2 minutes ago</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export ZIP</Button>
            <Button variant="outline"><Github className="w-4 h-4 mr-2" /> Push to GitHub</Button>
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow"><Rocket className="w-4 h-4 mr-2" /> Deploy preview</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {stats.map((s) => (
            <div key={s.k} className="glass rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.k}</div>
              <div className={cn(
                "text-xl font-display font-semibold mt-1",
                s.tone === "primary" && "gradient-text",
                s.tone === "success" && "text-success",
                s.tone === "warning" && "text-warning",
                s.tone === "accent" && "text-accent",
              )}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Side-by-side preview */}
        <div className="mt-6 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
            <div className="text-sm font-medium">Original vs Generated</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-secondary">Desktop</span>
              <span className="px-2 py-0.5 rounded bg-secondary/40">Tablet</span>
              <span className="px-2 py-0.5 rounded bg-secondary/40">Mobile</span>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-px bg-border/40">
            {(["Original", "Generated"] as const).map((label, i) => (
              <div key={label} className="bg-background p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  {label}
                  {i === 1 && <span className="px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/20">94% match</span>}
                </div>
                <MockPreview tinted={i === 1} />
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList className="bg-secondary/40 border border-border/60">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="design">Design System</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="code">Code Export</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-6 grid lg:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-6 lg:col-span-2">
              <div className="text-sm font-medium">Summary</div>
              <p className="text-sm text-muted-foreground mt-2">
                Generated 7 routes and 28 reusable components with a 94% visual match. Production readiness is medium pending 1 high-severity issue. Output stack: React + Tailwind.
              </p>
              <div className="mt-5 grid sm:grid-cols-3 gap-3">
                {[
                  { k: "Tokens extracted", v: "42" },
                  { k: "Total LOC", v: "3,184" },
                  { k: "Bundle size", v: "112 KB" },
                ].map((b) => (
                  <div key={b.k} className="rounded-xl border border-border/60 p-4 bg-secondary/30">
                    <div className="text-xs text-muted-foreground">{b.k}</div>
                    <div className="font-display text-lg font-semibold">{b.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="text-sm font-medium">Next steps</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-0.5" /> Review 5 detected issues</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-0.5" /> Customize brand tokens</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-0.5" /> Push to GitHub or export</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-0.5" /> Deploy a preview URL</li>
              </ul>
            </div>
          </TabsContent>

          {/* Pages */}
          <TabsContent value="pages" className="mt-6">
            <div className="glass rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 text-[11px] uppercase tracking-wider text-muted-foreground px-5 py-3 border-b border-border/60">
                <div className="col-span-5">Route</div>
                <div className="col-span-3">Title</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Accuracy</div>
              </div>
              {pages.map((p) => (
                <div key={p.path} className="grid grid-cols-12 px-5 py-3 border-b border-border/40 last:border-0 hover:bg-secondary/30 transition-smooth items-center">
                  <div className="col-span-5 font-mono text-sm">{p.path}</div>
                  <div className="col-span-3 text-sm">{p.title}</div>
                  <div className="col-span-2">
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={cn("font-mono text-sm", p.acc >= 95 ? "text-success" : p.acc >= 88 ? "text-warning" : "text-destructive")}>{p.acc}%</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Components */}
          <TabsContent value="components" className="mt-6">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {components.map((c) => (
                <div key={c.name} className="glass rounded-xl p-4 hover:border-primary/40 transition-smooth group">
                  <div className="aspect-video rounded-lg bg-secondary/50 mb-3 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-primary opacity-10 group-hover:opacity-20 transition-smooth" />
                    <div className="absolute inset-3 border border-border/70 rounded-md flex items-center justify-center">
                      <span className="text-xs font-mono text-muted-foreground">{c.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{c.name}</div>
                    <span className="text-[10px] font-mono text-muted-foreground">×{c.count}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">confidence {Math.round(c.conf * 100)}%</div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Design system */}
          <TabsContent value="design" className="mt-6 grid lg:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-6">
              <div className="text-sm font-medium">Colors</div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {colors.map((c) => (
                  <div key={c.name} className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="aspect-video" style={{ background: c.val }} />
                    <div className="p-2">
                      <div className="text-xs font-medium">{c.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{c.val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="text-sm font-medium">Typography</div>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Display / 56", cls: "text-5xl font-semibold" },
                  { label: "Heading / 32", cls: "text-3xl font-semibold" },
                  { label: "Body / 16", cls: "text-base" },
                  { label: "Mono / 13", cls: "text-[13px] font-mono" },
                ].map((t) => (
                  <div key={t.label} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0">
                    <span className={t.cls}>The quick brown fox</span>
                    <span className="text-xs text-muted-foreground font-mono">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="text-sm font-medium">Spacing scale</div>
              <div className="mt-4 space-y-2">
                {[4, 8, 12, 16, 24, 32, 48, 64].map((s) => (
                  <div key={s} className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                    <div className="bg-gradient-primary h-3 rounded" style={{ width: s * 2 }} />
                    {s}px
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="text-sm font-medium">Radius & Shadows</div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[6, 12, 20].map((r) => (
                  <div key={r} className="bg-secondary/50 h-20 flex items-center justify-center text-xs font-mono text-muted-foreground" style={{ borderRadius: r, boxShadow: "0 10px 30px -10px hsl(258 92% 66% / 0.4)" }}>
                    r{r}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-primary text-primary-foreground py-2 text-center text-xs">Primary</div>
                <div className="rounded-lg bg-secondary py-2 text-center text-xs">Secondary</div>
                <div className="rounded-lg border border-border py-2 text-center text-xs">Outline</div>
              </div>
            </div>
          </TabsContent>

          {/* Issues */}
          <TabsContent value="issues" className="mt-6">
            <div className="glass rounded-2xl divide-y divide-border/40">
              {issues.map((i, idx) => (
                <div key={idx} className="p-5 flex items-start gap-4">
                  <SeverityIcon sev={i.sev} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{i.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">Suggested fix: {i.fix}</div>
                  </div>
                  <SeverityBadge sev={i.sev} />
                  <Button size="sm" variant="outline">Apply fix</Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Code Export */}
          <TabsContent value="code" className="mt-6 grid lg:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5 lg:col-span-1">
              <div className="text-sm font-medium mb-3 flex items-center gap-2"><FolderOpen className="w-4 h-4" /> File tree</div>
              <div className="font-mono text-sm space-y-1">
                {tree.map((folder) => (
                  <div key={folder.name}>
                    <div className="text-foreground">▸ /{folder.name}</div>
                    <div className="pl-5 space-y-1 text-muted-foreground">
                      {folder.children.map((c) => (
                        <div key={c} className="flex items-center gap-2"><FileCode2 className="w-3 h-3" /> {c}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-5 lg:col-span-2 flex flex-col">
              <div className="text-sm font-medium mb-3">Export options</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <ExportCard icon={Download} title="Export ZIP" desc="Download the full project as a portable archive." />
                <ExportCard icon={Github} title="Push to GitHub" desc="Create a new repo or push to an existing branch." />
                <ExportCard icon={ExternalLink} title="Open in Editor" desc="Launch the in-browser editor with hot reload." />
                <ExportCard icon={Rocket} title="Deploy Preview" desc="One-click preview deploy to a shareable URL." />
              </div>
              <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-4 font-mono text-xs text-muted-foreground">
                <span className="text-success">$</span> clonecraft export --project={projectName.toLowerCase().replace(/\s+/g, "-")} --format=zip
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function projectFromUrl(u: string) {
  try {
    const host = new URL(u).hostname.replace("www.", "");
    return host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()) + " Clone";
  } catch {
    return "New Clone";
  }
}

function MockPreview({ tinted }: { tinted?: boolean }) {
  return (
    <div className="aspect-[16/10] rounded-lg bg-secondary/60 relative overflow-hidden border border-border/60">
      <div className={cn(
        "absolute inset-0",
        tinted
          ? "bg-[radial-gradient(circle_at_25%_30%,hsl(258_92%_66%/0.45),transparent_40%),radial-gradient(circle_at_75%_70%,hsl(188_95%_55%/0.35),transparent_40%)]"
          : "bg-[radial-gradient(circle_at_25%_30%,hsl(258_92%_66%/0.35),transparent_40%),radial-gradient(circle_at_75%_70%,hsl(188_95%_55%/0.25),transparent_40%)]"
      )} />
      <div className="absolute top-4 left-4 right-4 h-2.5 bg-foreground/10 rounded" />
      <div className="absolute top-8 left-4 w-1/3 h-2 bg-foreground/10 rounded" />
      <div className="absolute top-20 left-4 right-4 grid grid-cols-3 gap-3">
        {[0,1,2].map(i => <div key={i} className="h-20 rounded-md bg-foreground/5 border border-border/60" />)}
      </div>
      <div className="absolute bottom-4 left-4 right-4 h-10 rounded-md bg-foreground/5 border border-border/60" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "bg-success/15 text-success border-success/20",
    review: "bg-warning/15 text-warning border-warning/20",
    draft: "bg-muted text-muted-foreground border-border",
  };
  return <span className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded border", map[status])}>{status}</span>;
}

function SeverityIcon({ sev }: { sev: string }) {
  if (sev === "high") return <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />;
  if (sev === "med") return <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />;
  return <AlertTriangle className="w-5 h-5 text-muted-foreground mt-0.5" />;
}
function SeverityBadge({ sev }: { sev: string }) {
  const map: Record<string, string> = {
    high: "bg-destructive/15 text-destructive border-destructive/20",
    med: "bg-warning/15 text-warning border-warning/20",
    low: "bg-muted text-muted-foreground border-border",
  };
  return <span className={cn("text-[10px] uppercase font-mono px-2 py-0.5 rounded border self-center", map[sev])}>{sev}</span>;
}

function ExportCard({ icon: Icon, title, desc }: { icon: React.ComponentType<{className?:string}>; title: string; desc: string }) {
  return (
    <button className="text-left p-4 rounded-xl border border-border/60 bg-secondary/30 hover:border-primary/40 hover:bg-secondary/60 transition-smooth">
      <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow mb-3">
        <Icon className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}
