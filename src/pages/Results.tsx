import { useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, CheckCircle2, Download, Github, ExternalLink, Rocket,
  AlertTriangle, AlertCircle, FileCode2, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { k: "Accuracy", v: "94%" },
  { k: "Responsive", v: "98%" },
  { k: "Build", v: "Pass" },
  { k: "Pages", v: "07" },
  { k: "Components", v: "28" },
  { k: "Assets", v: "46" },
  { k: "A11y", v: "91" },
  { k: "Readiness", v: "Mid" },
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
  { name: "Ink", val: "#0d0d0d" },
  { name: "Graphite", val: "#2d2d2d" },
  { name: "Paper", val: "#f5f3ee" },
  { name: "Linen", val: "#e8e4dd" },
  { name: "Moss", val: "#3c5a4a" },
  { name: "Tobacco", val: "#a36b2a" },
];

const issues = [
  { sev: "high", title: "One unresolved SVG asset on /pricing", fix: "Re-fetch with auth header or replace with inline SVG fallback." },
  { sev: "med", title: "Missing hover animation on PricingCard CTA", fix: "Apply transition-transform + hover:-translate-y-0.5 to button." },
  { sev: "med", title: "Mobile spacing differs on Hero by 12px", fix: "Switch py-16 to py-20 at md breakpoint." },
  { sev: "low", title: "Font fallback mismatch on body", fix: "Add 'Epilogue' before sans-serif in fontFamily stack." },
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
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const url = (typeof window !== "undefined" && sessionStorage.getItem("cc:lastUrl")) || "https://example.com";
  const projectName = projectFromUrl(url);

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-10">
        <div className="max-w-7xl mx-auto border border-border bg-card">
          {/* Header */}
          <div className="p-8 md:p-10 border-b border-border flex flex-col md:flex-row justify-between md:items-end gap-6">
            <div className="space-y-2">
              <Link to="/app/projects" className="inline-flex items-center gap-1.5 eyebrow hover:text-foreground transition-colors">
                <ArrowLeft className="w-3 h-3" strokeWidth={2} /> Projects · Workspace
              </Link>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">{projectName}</h1>
              <p className="text-sm text-muted-foreground font-light">
                <span className="font-mono">{url}</span>
                <span className="mx-2 text-border">|</span>
                Generated 2 minutes ago
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-none border-foreground hover:bg-foreground hover:text-background">
                <Download className="w-4 h-4 mr-2" strokeWidth={1.5} /> Export ZIP
              </Button>
              <Button variant="outline" className="rounded-none border-foreground hover:bg-foreground hover:text-background">
                <Github className="w-4 h-4 mr-2" strokeWidth={1.5} /> Push to GitHub
              </Button>
              <Button className="rounded-none bg-foreground text-background hover:bg-foreground/85">
                <Rocket className="w-4 h-4 mr-2" strokeWidth={1.5} /> Deploy preview
              </Button>
            </div>
          </div>

          {/* Metrics bar */}
          <div className="grid grid-cols-4 md:grid-cols-8 divide-x divide-border border-b border-border">
            {stats.map((s) => (
              <div key={s.k} className="p-5 md:p-6">
                <p className="eyebrow mb-1">{s.k}</p>
                <p className="font-display text-2xl font-bold tracking-tight">{s.v}</p>
              </div>
            ))}
          </div>

          {/* Asymmetric 60/40 comparator */}
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-[60%] border-r border-border p-8 md:p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="font-display text-2xl font-bold tracking-tight">Generated Output</h2>
                <span className="bg-foreground text-background px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] font-bold">94% Match</span>
              </div>
              <MockPreview tinted />
            </div>
            <div className="w-full md:w-[40%] p-8 md:p-10 bg-secondary/40">
              <div className="flex justify-between items-center mb-8">
                <h2 className="font-display text-2xl font-bold tracking-tight opacity-50">Reference</h2>
                <div className="flex gap-4">
                  {(["desktop", "mobile"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDevice(d)}
                      className={cn(
                        "text-[10px] uppercase tracking-[0.2em] font-bold pb-0.5 border-b-2 transition-colors",
                        device === d ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <MockPreview compact />
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-border p-8 md:p-10">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 gap-8">
                {[
                  { v: "overview", l: "Overview" },
                  { v: "pages", l: "Pages" },
                  { v: "components", l: "Components" },
                  { v: "design", l: "Design System" },
                  { v: "issues", l: "Issues" },
                  { v: "code", l: "Code Export" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="rounded-none border-0 border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground data-[state=active]:text-foreground"
                  >
                    {t.l}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="mt-8 grid lg:grid-cols-3 gap-px bg-border border border-border">
                <div className="lg:col-span-2 p-6 bg-card">
                  <p className="eyebrow">Summary</p>
                  <p className="font-display text-xl mt-2 leading-snug max-w-2xl">
                    Generated 7 routes and 28 reusable components with a 94% visual match. Production readiness is medium pending one high-severity issue.
                  </p>
                  <div className="mt-6 grid sm:grid-cols-3 gap-px bg-border">
                    {[
                      { k: "Tokens extracted", v: "42" },
                      { k: "Total LOC", v: "3,184" },
                      { k: "Bundle size", v: "112 KB" },
                    ].map((b) => (
                      <div key={b.k} className="p-4 bg-card">
                        <div className="eyebrow">{b.k}</div>
                        <div className="font-display text-2xl font-bold mt-1">{b.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-card">
                  <p className="eyebrow">Next steps</p>
                  <ul className="mt-3 space-y-3 text-sm">
                    {["Review 5 detected issues", "Customize brand tokens", "Push to GitHub or export", "Deploy a preview URL"].map((s) => (
                      <li key={s} className="flex gap-2 items-start">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-foreground" strokeWidth={1.5} /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>

              {/* Pages */}
              <TabsContent value="pages" className="mt-8">
                <div className="border border-border">
                  <div className="grid grid-cols-12 eyebrow px-5 py-3 border-b border-border bg-secondary/40">
                    <div className="col-span-5">Route</div>
                    <div className="col-span-3">Title</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Accuracy</div>
                  </div>
                  {pages.map((p) => (
                    <div key={p.path} className="grid grid-cols-12 px-5 py-4 border-b border-border last:border-0 hover:bg-secondary/40 items-center">
                      <div className="col-span-5 font-mono text-sm">{p.path}</div>
                      <div className="col-span-3 text-sm">{p.title}</div>
                      <div className="col-span-2"><StatusBadge status={p.status} /></div>
                      <div className="col-span-2 text-right font-mono text-sm">{p.acc}%</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Components */}
              <TabsContent value="components" className="mt-8">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-border border border-border">
                  {components.map((c) => (
                    <div key={c.name} className="p-4 bg-card hover:bg-secondary/40 transition-colors group">
                      <div className="aspect-video bg-secondary/60 border border-border mb-3 relative flex items-center justify-center">
                        <span className="font-mono text-[11px] text-muted-foreground">{c.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{c.name}</div>
                        <span className="text-[10px] font-mono text-muted-foreground">×{c.count}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">conf {Math.round(c.conf * 100)}%</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Design system */}
              <TabsContent value="design" className="mt-8 grid lg:grid-cols-2 gap-px bg-border border border-border">
                <div className="p-6 bg-card">
                  <p className="eyebrow">Colors</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {colors.map((c) => (
                      <div key={c.name} className="border border-border">
                        <div className="aspect-video" style={{ background: c.val }} />
                        <div className="p-2">
                          <div className="text-xs font-medium">{c.name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">{c.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-card">
                  <p className="eyebrow">Typography</p>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Display / 56", cls: "font-display text-5xl font-bold tracking-tight" },
                      { label: "Heading / 32", cls: "font-display text-3xl font-bold" },
                      { label: "Body / 16", cls: "text-base font-light" },
                      { label: "Mono / 13", cls: "text-[13px] font-mono" },
                    ].map((t) => (
                      <div key={t.label} className="flex items-baseline justify-between border-b border-border pb-3 last:border-0 gap-4">
                        <span className={cn("truncate", t.cls)}>The quick brown fox</span>
                        <span className="eyebrow shrink-0">{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-card">
                  <p className="eyebrow">Spacing scale</p>
                  <div className="mt-4 space-y-2">
                    {[4, 8, 12, 16, 24, 32, 48, 64].map((s) => (
                      <div key={s} className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                        <div className="bg-foreground h-2" style={{ width: s * 2 }} />
                        {s}px
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-card">
                  <p className="eyebrow">Buttons</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="bg-foreground text-background py-2 text-center text-xs uppercase tracking-widest font-bold">Primary</div>
                    <div className="bg-secondary py-2 text-center text-xs uppercase tracking-widest font-bold">Secondary</div>
                    <div className="border border-foreground py-2 text-center text-xs uppercase tracking-widest font-bold">Outline</div>
                  </div>
                </div>
              </TabsContent>

              {/* Issues */}
              <TabsContent value="issues" className="mt-8">
                <div className="border border-border">
                  {issues.map((i, idx) => (
                    <div key={idx} className="p-5 flex items-start gap-4 border-b border-border last:border-0">
                      <SeverityIcon sev={i.sev} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{i.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">Suggested fix · {i.fix}</div>
                      </div>
                      <SeverityBadge sev={i.sev} />
                      <Button size="sm" variant="outline" className="rounded-none border-foreground hover:bg-foreground hover:text-background">Apply</Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Code Export */}
              <TabsContent value="code" className="mt-8 grid lg:grid-cols-3 gap-px bg-border border border-border">
                <div className="p-5 bg-card lg:col-span-1">
                  <p className="eyebrow mb-3 flex items-center gap-2"><FolderOpen className="w-3 h-3" strokeWidth={1.5} /> File tree</p>
                  <div className="font-mono text-sm space-y-1">
                    {tree.map((folder) => (
                      <div key={folder.name}>
                        <div className="text-foreground">▸ /{folder.name}</div>
                        <div className="pl-5 space-y-1 text-muted-foreground">
                          {folder.children.map((c) => (
                            <div key={c} className="flex items-center gap-2"><FileCode2 className="w-3 h-3" strokeWidth={1.5} /> {c}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5 bg-card lg:col-span-2 flex flex-col">
                  <p className="eyebrow mb-3">Export options</p>
                  <div className="grid sm:grid-cols-2 gap-px bg-border border border-border">
                    <ExportCard icon={Download} title="Export ZIP" desc="Download the full project as a portable archive." />
                    <ExportCard icon={Github} title="Push to GitHub" desc="Create a new repo or push to an existing branch." />
                    <ExportCard icon={ExternalLink} title="Open in Editor" desc="Launch the in-browser editor with hot reload." />
                    <ExportCard icon={Rocket} title="Deploy Preview" desc="One-click preview deploy to a shareable URL." />
                  </div>
                  <div className="mt-4 border border-border bg-background p-4 font-mono text-xs text-muted-foreground">
                    <span className="text-foreground">$</span> clonecraft export --project={projectName.toLowerCase().replace(/\s+/g, "-")} --format=zip
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer rule */}
          <div className="px-8 md:px-10 py-4 border-t border-foreground flex justify-between items-center eyebrow">
            <span>Build · CC-7729-AX</span>
            <span>Editorial Engine · v4.2</span>
          </div>
        </div>
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

function MockPreview({ tinted, compact }: { tinted?: boolean; compact?: boolean }) {
  return (
    <div className={cn("bg-white border border-border relative overflow-hidden", compact ? "aspect-[3/4]" : "aspect-video")}>
      <div className="absolute inset-0 p-6 md:p-8 space-y-4">
        <div className="h-3 w-1/3 bg-secondary" />
        <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-3")}>
          {Array.from({ length: compact ? 2 : 3 }).map((_, i) => (
            <div key={i} className="aspect-square bg-secondary/70" />
          ))}
        </div>
        <div className={cn("w-full bg-secondary/60", compact ? "h-16" : "h-20")} />
        <div className="h-2 w-2/3 bg-secondary" />
        <div className="h-2 w-1/2 bg-secondary" />
      </div>
      {tinted && (
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <div className="w-1.5 h-1.5 bg-foreground" />
          <div className="w-1.5 h-1.5 bg-foreground/20" />
          <div className="w-1.5 h-1.5 bg-foreground/20" />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "border-foreground text-foreground",
    review: "border-foreground/50 text-foreground/70",
    draft: "border-border text-muted-foreground",
  };
  return <span className={cn("text-[10px] uppercase tracking-[0.2em] font-bold font-mono px-2 py-0.5 border", map[status])}>{status}</span>;
}

function SeverityIcon({ sev }: { sev: string }) {
  if (sev === "high") return <AlertCircle className="w-5 h-5 text-foreground mt-0.5" strokeWidth={1.5} />;
  if (sev === "med") return <AlertTriangle className="w-5 h-5 text-foreground/70 mt-0.5" strokeWidth={1.5} />;
  return <AlertTriangle className="w-5 h-5 text-muted-foreground mt-0.5" strokeWidth={1.5} />;
}
function SeverityBadge({ sev }: { sev: string }) {
  const map: Record<string, string> = {
    high: "bg-foreground text-background border-foreground",
    med: "border-foreground text-foreground",
    low: "border-border text-muted-foreground",
  };
  return <span className={cn("text-[10px] uppercase tracking-[0.2em] font-bold font-mono px-2 py-0.5 border self-center", map[sev])}>{sev}</span>;
}

function ExportCard({ icon: Icon, title, desc }: { icon: React.ComponentType<{className?:string; strokeWidth?: number}>; title: string; desc: string }) {
  return (
    <button className="text-left p-4 bg-card hover:bg-secondary/40 transition-colors">
      <div className="w-9 h-9 bg-foreground text-background flex items-center justify-center mb-3">
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}
