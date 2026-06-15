import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Circle, Cpu, Eye, FileCode2, MonitorPlay, Palette, Route as RouteIcon, ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRun } from "@/lib/api";

// Maps the server's stage label to a display row. Order matches the pipeline.
const stages = [
  { id: "screens", label: "Capturing screenshot", icon: Eye, match: "Capturing", sub: "Firecrawl · screenshot + design system" },
  { id: "crawl", label: "Crawling routes", icon: RouteIcon, match: "Crawling", sub: "Same-origin link graph" },
  { id: "tokens", label: "Mapping design tokens", icon: Palette, match: "Mapping", sub: "Colors, type, components (vision + branding)" },
  { id: "code", label: "Generating code", icon: FileCode2, match: "Generating", sub: "Codegen model" },
  { id: "build", label: "Building & live preview", icon: Cpu, match: "Building", sub: "esbuild bundle + live preview (e2b) · auto-fixes errors" },
  { id: "render", label: "Rendering clone preview", icon: MonitorPlay, match: "Rendering", sub: "Screenshotting the running app" },
  { id: "diff", label: "Comparing visual accuracy", icon: ShieldCheck, match: "Comparing", sub: "Finalizing result" },
];

function stageIndex(stage: string): number {
  const i = stages.findIndex((s) => stage?.startsWith(s.match));
  return i === -1 ? 0 : i;
}

export default function Progress() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const id = params.get("id");
  const navigatedRef = useRef(false);

  const { data } = useQuery({
    queryKey: ["run", id],
    queryFn: () => getRun(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "succeeded" || s === "failed" ? false : 1000;
    },
  });

  useEffect(() => {
    if (data?.status === "succeeded" && !navigatedRef.current) {
      navigatedRef.current = true;
      setTimeout(() => nav(`/app/results?id=${id}`), 600);
    }
  }, [data?.status, id, nav]);

  if (!id) {
    return (
      <AppShell>
        <div className="container max-w-3xl py-20 text-center">
          <p className="text-muted-foreground">No run specified.</p>
          <Button className="mt-4" onClick={() => nav("/app/new")}>Start a clone</Button>
        </div>
      </AppShell>
    );
  }

  const progress = data?.progress ?? 0;
  const active = stageIndex(data?.stage ?? "");
  const logs = data?.logs ?? [];
  const failed = data?.status === "failed";

  return (
    <AppShell>
      <div className="container max-w-6xl py-10">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className={cn("text-xs font-mono uppercase tracking-wider", failed ? "text-destructive" : "text-accent")}>
              {failed ? "Run failed" : data?.status === "succeeded" ? "Run complete" : "Run in progress"}
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-1">
              {failed ? "Run failed" : "Building your clone…"}
            </h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">{data?.url ?? ""}</p>
          </div>
          <Button variant="outline" onClick={() => nav("/app/new")}>{failed ? "Start over" : "Cancel run"}</Button>
        </div>

        <div className="mt-8 glass rounded-2xl p-6">
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">Overall progress</div>
            <div className="font-mono">{Math.floor(progress)}%</div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
            <div className={cn("h-full transition-all duration-300", failed ? "bg-destructive" : "bg-gradient-primary")} style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {failed ? "Pipeline stopped — see the log." : `Stage ${active + 1} of ${stages.length}: ${stages[active].label}`}
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 glass rounded-2xl p-6">
            <div className="text-sm font-medium mb-4">Pipeline</div>
            <ol className="relative space-y-1">
              {stages.map((s, idx) => {
                const done = idx < active || data?.status === "succeeded";
                const current = idx === active && !failed && data?.status !== "succeeded";
                return (
                  <li key={s.id} className={cn("flex items-start gap-3 p-3 rounded-xl border border-transparent transition-smooth", current && "border-primary/40 bg-primary/5")}>
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

          <div className="lg:col-span-2 glass rounded-2xl p-6 flex flex-col">
            <div className="text-sm font-medium mb-3 flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", failed ? "bg-destructive" : "bg-success animate-pulse")} /> Live activity log
            </div>
            <div className="flex-1 rounded-xl bg-background/60 border border-border/60 p-3 font-mono text-xs space-y-1 overflow-auto max-h-[520px]">
              {logs.map((line, i) => (
                <div key={i} className="animate-fade-in">
                  <span className="text-muted-foreground mr-2">{String(i).padStart(2, "0")}</span>
                  <span className={line.includes("[error]") ? "text-destructive" : line.includes("[diff]") || line.includes("[done]") ? "text-accent" : "text-foreground/80"}>{line}</span>
                </div>
              ))}
              {!failed && data?.status !== "succeeded" && <div className="text-muted-foreground">▍</div>}
            </div>
            {failed && (
              <div className="mt-3 flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{data?.error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
