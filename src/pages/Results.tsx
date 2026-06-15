import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, CheckCircle2, Download, Github, ExternalLink, Rocket,
  AlertTriangle, AlertCircle, Boxes, FileCode2, FolderOpen, Loader2,
  MonitorPlay, RefreshCw, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getRun, relaunchPreview } from "@/lib/api";
import { toast } from "sonner";

export default function Results() {
  const [tab, setTab] = useState("overview");
  const [params] = useSearchParams();
  const nav = useNavigate();
  const id = params.get("id");
  const [activeFile, setActiveFile] = useState(0);

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["run", id],
    queryFn: () => getRun(id!),
    enabled: !!id,
  });

  const preview = useMutation({
    mutationFn: () => relaunchPreview(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["run", id] });
      toast.success("Live preview is ready");
    },
    onError: (e: Error) => toast.error(e.message || "Could not launch preview"),
  });

  if (!id) {
    return (
      <AppShell>
        <div className="container max-w-3xl py-20 text-center">
          <p className="text-muted-foreground">No run specified.</p>
          <Button className="mt-4" onClick={() => nav("/app/projects")}>View projects</Button>
        </div>
      </AppShell>
    );
  }

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="container max-w-3xl py-20 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /> Loading result…
        </div>
      </AppShell>
    );
  }

  if (data.status !== "succeeded" || !data.result) {
    return (
      <AppShell>
        <div className="container max-w-3xl py-20 text-center">
          <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground">
            This run {data.status === "failed" ? "failed" : "hasn’t finished"}.
          </p>
          {data.error && <p className="text-xs text-destructive font-mono mt-2 max-w-lg mx-auto">{data.error}</p>}
          <Button className="mt-4" onClick={() => nav(`/app/progress?id=${id}`)}>View progress</Button>
        </div>
      </AppShell>
    );
  }

  const r = data.result;
  const projectName = r.title || data.url;
  const files = r.files;

  const stats = [
    { k: "Pages", v: String(r.routes.length), tone: "muted" },
    { k: "Components", v: String(r.components.length), tone: "muted" },
    { k: "Colors", v: String(r.tokens.colors.length), tone: "accent" },
    { k: "Fonts", v: String(r.tokens.fonts.length), tone: "muted" },
    { k: "Files", v: String(files.length), tone: "muted" },
    { k: "Build", v: r.build.ran ? (r.build.passed ? "Passing" : "Errors") : "Skipped", tone: r.build.passed ? "success" : r.build.ran ? "warning" : "muted" },
  ];

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
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Boxes className="w-5 h-5 text-primary-foreground" strokeWidth={2} />
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{projectName}</h1>
                <div className="text-xs text-muted-foreground font-mono">{data.url}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled><Download className="w-4 h-4 mr-2" /> Export ZIP</Button>
            <Button variant="outline" disabled><Github className="w-4 h-4 mr-2" /> Push to GitHub</Button>
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow" disabled><Rocket className="w-4 h-4 mr-2" /> Deploy preview</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((s) => (
            <div key={s.k} className="glass rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.k}</div>
              <div className={cn(
                "text-xl font-display font-semibold mt-1",
                s.tone === "success" && "text-success",
                s.tone === "warning" && "text-warning",
                s.tone === "accent" && "text-accent",
              )}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Side-by-side: captured original vs rendered clone (from e2b sandbox) */}
        <div className="mt-6 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between">
            <div className="text-sm font-medium">Captured original vs rendered clone</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Visual diff</div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 p-4 pt-0">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Captured screenshot</div>
              {r.screenshotDataUrl ? (
                <img src={r.screenshotDataUrl} alt="Captured page" className="w-full rounded-lg" />
              ) : (
                <div className="aspect-video rounded-lg bg-secondary/60" />
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Rendered clone · e2b sandbox</div>
              {r.renderedScreenshotDataUrl ? (
                <img src={r.renderedScreenshotDataUrl} alt="Rendered clone" className="w-full rounded-lg" />
              ) : (
                <div className="aspect-video rounded-lg bg-secondary/40 flex flex-col items-center justify-center text-center px-4">
                  <MonitorPlay className="w-5 h-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {r.build.ran && !r.build.passed
                      ? "Build failed — see the Build tab for errors."
                      : "No rendered screenshot. Launch the live preview below to generate one."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live, interactive preview of the running clone */}
        <div className="mt-6 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MonitorPlay className="w-4 h-4" /> Live preview
              {r.previewUrl && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
            </div>
            <div className="flex items-center gap-2">
              {r.previewUrl && (
                <a href={r.previewUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm"><ExternalLink className="w-3.5 h-3.5 mr-2" /> Open full app</Button>
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => preview.mutate()}
                disabled={preview.isPending}
              >
                {preview.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Launching…</>
                  : <><RefreshCw className="w-3.5 h-3.5 mr-2" /> {r.previewUrl ? "Relaunch" : "Launch preview"}</>}
              </Button>
            </div>
          </div>
          {r.previewUrl ? (
            <iframe
              key={r.previewUrl}
              src={r.previewUrl}
              title="Live clone preview"
              className="w-full h-[640px] bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {preview.isPending
                  ? "Booting an isolated sandbox, bundling the generated code, and serving it…"
                  : "Launch a sandbox to run the generated app and interact with it here. Previews expire after a while — relaunch any time."}
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList className="bg-secondary/40 border border-border/60">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="design">Design System</TabsTrigger>
            <TabsTrigger value="build">Build</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-6 grid lg:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-6 lg:col-span-2">
              <div className="text-sm font-medium">Summary</div>
              <p className="text-sm text-muted-foreground mt-2">{r.summary}</p>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="text-sm font-medium">Next steps</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-0.5" /> Review the generated files</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-0.5" /> Check the build report</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-0.5" /> Customize brand tokens</li>
              </ul>
            </div>
          </TabsContent>

          {/* Pages */}
          <TabsContent value="pages" className="mt-6">
            <div className="glass rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 text-[11px] uppercase tracking-wider text-muted-foreground px-5 py-3">
                <div className="col-span-10">Route</div>
                <div className="col-span-2 text-right">Depth</div>
              </div>
              {r.routes.map((p) => (
                <div key={p} className="grid grid-cols-12 px-5 py-3 odd:bg-secondary/20 hover:bg-secondary/40 transition-smooth items-center rounded-lg">
                  <div className="col-span-10 font-mono text-sm">{p}</div>
                  <div className="col-span-2 text-right text-xs text-muted-foreground">{data.config.depth}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Components */}
          <TabsContent value="components" className="mt-6">
            {r.components.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No components detected.</div>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {r.components.map((c) => (
                  <div key={c.name} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{c.name}</div>
                      <span className="text-[10px] font-mono text-muted-foreground">×{c.count}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">confidence {Math.round(c.confidence * 100)}%</div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Design system */}
          <TabsContent value="design" className="mt-6 grid lg:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-6">
              <div className="text-sm font-medium">Colors</div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {r.tokens.colors.map((c) => (
                  <div key={c.name + c.value} className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="aspect-video" style={{ background: c.value }} />
                    <div className="p-2">
                      <div className="text-xs font-medium">{c.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-6 space-y-6">
              <div>
                <div className="text-sm font-medium">Typography</div>
                <div className="mt-4 space-y-3">
                  {r.tokens.fonts.map((f) => (
                    <div key={f} className="flex items-center justify-between">
                      <span className="text-lg" style={{ fontFamily: f }}>The quick brown fox</span>
                      <span className="text-xs text-muted-foreground font-mono">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(r.tokens.radii?.length || r.tokens.spacingBase) && (
                <div>
                  <div className="text-sm font-medium">Spacing &amp; radii</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono">
                    {r.tokens.spacingBase && (
                      <span className="px-2 py-1 rounded bg-secondary/60 text-muted-foreground">base {r.tokens.spacingBase}</span>
                    )}
                    {r.tokens.radii?.map((rad) => (
                      <span key={rad} className="px-2 py-1 rounded bg-secondary/60 text-muted-foreground">radius {rad}</span>
                    ))}
                  </div>
                </div>
              )}

              {(r.tokens.buttons?.primary || r.tokens.buttons?.secondary) && (
                <div>
                  <div className="text-sm font-medium">Buttons</div>
                  <div className="mt-3 space-y-2">
                    {(["primary", "secondary"] as const).map((k) => {
                      const style = r.tokens.buttons?.[k];
                      if (!style) return null;
                      return (
                        <div key={k} className="rounded-lg border border-border/60 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{k}</div>
                          <div className="font-mono text-[11px] text-muted-foreground break-all">
                            {Object.entries(style).map(([p, v]) => `${p}: ${v}`).join("  ·  ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Build */}
          <TabsContent value="build" className="mt-6">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {r.build.passed ? <CheckCircle2 className="w-4 h-4 text-success" /> : r.build.ran ? <AlertTriangle className="w-4 h-4 text-warning" /> : <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                  {r.build.ran ? (r.build.passed ? "Build passed (esbuild bundle)" : "Build found errors") : "Build check skipped"}
                </div>
                <div className="flex items-center gap-2">
                  {!!r.fixAttempts && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-accent/10 text-accent">
                      <Wrench className="w-3 h-3" /> {r.fixAttempts} auto-fix pass{r.fixAttempts > 1 ? "es" : ""}
                    </span>
                  )}
                  {r.build.ran && !r.build.passed && (
                    <Button size="sm" variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
                      {preview.isPending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                      Rebuild
                    </Button>
                  )}
                </div>
              </div>
              <pre className="mt-4 text-[11px] font-mono rounded-lg border border-border/60 bg-background/60 p-3 overflow-auto max-h-[420px] whitespace-pre-wrap">
                {r.build.output}
              </pre>
            </div>
          </TabsContent>

          {/* Code */}
          <TabsContent value="code" className="mt-6 grid lg:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5 lg:col-span-1">
              <div className="text-sm font-medium mb-3 flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Files</div>
              <div className="font-mono text-sm space-y-1">
                {files.map((f, i) => (
                  <button
                    key={f.path}
                    onClick={() => setActiveFile(i)}
                    className={cn(
                      "w-full text-left flex items-center gap-2 px-2 py-1 rounded transition-smooth",
                      i === activeFile ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    <FileCode2 className="w-3 h-3 shrink-0" /> {f.path}
                  </button>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-5 lg:col-span-2">
              <div className="text-sm font-medium mb-3">{files[activeFile]?.path}</div>
              <pre className="text-[11px] font-mono leading-relaxed rounded-lg border border-border/60 bg-background/60 p-3 overflow-auto max-h-[520px]">
                {files[activeFile]?.content}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
