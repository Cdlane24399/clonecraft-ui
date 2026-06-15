import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Boxes, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { listProjects } from "@/lib/api";

export default function Projects() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  return (
    <AppShell>
      <div className="container max-w-7xl py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">All clones generated in this workspace.</p>
          </div>
          <Button asChild className="bg-gradient-primary text-primary-foreground shadow-glow">
            <Link to="/app/new"><Plus className="w-4 h-4 mr-2" /> New clone</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="mt-8 glass rounded-2xl p-12 text-center">
            <Boxes className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <div className="font-medium">No clones yet</div>
            <p className="text-sm text-muted-foreground mt-1">Start your first clone to see it here.</p>
            <Button asChild className="mt-4 bg-gradient-primary text-primary-foreground shadow-glow">
              <Link to="/app/new"><Plus className="w-4 h-4 mr-2" /> New clone</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const run = p.latestRun;
              const to = run ? (run.status === "succeeded" ? `/app/results?id=${run.id}` : `/app/progress?id=${run.id}`) : "/app/new";
              return (
                <Link to={to} key={p.id} className="glass rounded-2xl p-5 hover:border-primary/40 transition-smooth group block">
                  <div className="aspect-video rounded-lg bg-secondary/50 relative overflow-hidden mb-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(20_78%_52%/0.4),transparent_40%),radial-gradient(circle_at_80%_70%,hsl(240_5%_42%/0.3),transparent_40%)]" />
                    {run?.accuracy != null && (
                      <div className="absolute top-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/70 border border-border/60">
                        {run.accuracy}% match
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-accent" strokeWidth={2} />
                      <div className="font-medium">{p.name}</div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono uppercase px-2 py-0.5 rounded border",
                      run?.status === "succeeded" ? "border-success/20 bg-success/15 text-success"
                        : run?.status === "failed" ? "border-destructive/20 bg-destructive/15 text-destructive"
                        : "border-border bg-secondary text-muted-foreground"
                    )}>{run?.status ?? "—"}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground font-mono">{p.url}</div>
                  <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                    <span>{run?.pages != null ? `${run.pages} pages` : "—"}</span>
                    <span>{run?.components != null ? `${run.components} components` : ""}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
