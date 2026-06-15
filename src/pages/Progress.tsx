import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Circle, Cpu, Eye, FileCode2, Layers, Palette, Route as RouteIcon, ScanLine, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const stages = [
  { id: "screens", label: "Capturing screenshots", icon: Eye, sub: "Headless Chromium · 3 viewports" },
  { id: "crawl", label: "Crawling routes", icon: RouteIcon, sub: "Sitemap + link graph traversal" },
  { id: "dom", label: "Extracting DOM structure", icon: ScanLine, sub: "Semantic tree + a11y roles" },
  { id: "components", label: "Detecting components", icon: Layers, sub: "Pattern matching across pages" },
  { id: "tokens", label: "Mapping design tokens", icon: Palette, sub: "Colors, type, spacing, radii" },
  { id: "code", label: "Generating code", icon: FileCode2, sub: "React + Tailwind scaffolding" },
  { id: "build", label: "Running build checks", icon: Cpu, sub: "Type check, lint, bundle" },
  { id: "diff", label: "Comparing visual accuracy", icon: ShieldCheck, sub: "Pixel + structural diff" },
];

const logSeed = [
  "[agent:planner] Plan generated · 7 routes queued",
  "[browser] Launched chromium@127 · viewport 1440x900",
  "[crawler] Discovered /pricing, /features, /login, /dashboard",
  "[vision] Captured hero region · 1.2MB",
  "[dom] Extracted 412 nodes · depth 11",
  "[detector] Found candidate: Navbar (confidence 0.97)",
  "[detector] Found candidate: PricingCard ×3 (confidence 0.93)",
  "[tokens] Palette: 6 colors · 2 gradients · 4 shadows",
  "[tokens] Type: Inter 400/500/600/700 · 8 sizes",
  "[codegen] Wrote app/(marketing)/page.tsx",
  "[codegen] Wrote components/Hero.tsx",
  "[build] tsc --noEmit · 0 errors",
  "[diff] Page / · visual 0.962 · layout 0.984",
];

export default function Progress() {
  const nav = useNavigate();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const url = sessionStorage.getItem("cc:lastUrl") || "https://example.com";
    setLogs([`[init] Run started for ${url}`, `[init] Agents: planner, vision, dom, codegen, qa`]);
  }, []);

  useEffect(() => {
    const i = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + Math.random() * 3 + 1.2);
        const stageIdx = Math.min(stages.length - 1, Math.floor((next / 100) * stages.length));
        setActive(stageIdx);
        if (next >= 100) {
          clearInterval(i);
          setTimeout(() => nav("/app/results"), 800);
        }
        return next;
      });
    }, 350);
    return () => clearInterval(i);
  }, [nav]);

  useEffect(() => {
    const i = setInterval(() => {
      setLogs((l) => {
        if (l.length >= logSeed.length + 2) return l;
        const next = logSeed[l.length - 2];
        return next ? [...l, next] : l;
      });
    }, 500);
    return () => clearInterval(i);
  }, []);

  return (
    <AppShell>
      <div className="container max-w-6xl py-10">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-mono text-accent uppercase tracking-wider">Run in progress</div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-1">
              Building your clone…
            </h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">{sessionStorage.getItem("cc:lastUrl") || "https://example.com"}</p>
          </div>
          <Button variant="outline" onClick={() => nav("/app/new")}>Cancel run</Button>
        </div>

        {/* Progress bar */}
        <div className="mt-8 glass rounded-2xl p-6">
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Overall progress</div>
            <div className="font-mono">{Math.floor(progress)}%</div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Stage {active + 1} of {stages.length}: {stages[active].label}</div>
        </div>

        <div className="mt-6 grid lg:grid-cols-5 gap-6">
          {/* Timeline */}
          <div className="lg:col-span-3 glass rounded-2xl p-6">
            <div className="text-sm font-medium mb-4">Pipeline</div>
            <ol className="relative space-y-1">
              {stages.map((s, idx) => {
                const done = idx < active;
                const current = idx === active;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border border-transparent transition-smooth",
                      current && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      done ? "bg-success/15 text-success" : current ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    )}>
                      {done ? <Check className="w-4 h-4" /> : current ? <Loader2 className="w-4 h-4 animate-spin" /> : <s.icon className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {s.label}
                        {current && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">running</span>}
                        {done && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/15 text-success">done</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
                    </div>
                    {!done && !current && <Circle className="w-3 h-3 text-muted-foreground/40 mt-2" />}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Live log */}
          <div className="lg:col-span-2 glass rounded-2xl p-6 flex flex-col">
            <div className="text-sm font-medium mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Live activity log
            </div>
            <div className="flex-1 rounded-xl bg-background/60 border border-border/60 p-3 font-mono text-xs space-y-1 overflow-auto max-h-[520px]">
              {logs.map((line, i) => (
                <div key={i} className="animate-fade-in">
                  <span className="text-muted-foreground mr-2">{String(i).padStart(2, "0")}</span>
                  <span className={line.includes("error") ? "text-destructive" : line.includes("[diff]") ? "text-accent" : "text-foreground/80"}>{line}</span>
                </div>
              ))}
              <div className="text-muted-foreground">▍</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              {[
                { k: "Routes", v: Math.min(7, Math.ceil((progress / 100) * 7)) },
                { k: "Components", v: Math.min(28, Math.ceil((progress / 100) * 28)) },
                { k: "Assets", v: Math.min(46, Math.ceil((progress / 100) * 46)) },
              ].map((s) => (
                <div key={s.k} className="rounded-lg bg-secondary/40 p-2 text-center">
                  <div className="text-muted-foreground text-[10px] uppercase">{s.k}</div>
                  <div className="font-mono">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
