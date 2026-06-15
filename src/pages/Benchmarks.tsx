import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { Trophy, Loader2 } from "lucide-react";

type BenchmarkRow = {
  site: string;
  visual: number;
  a11y: number;
  build: "pass" | "warn" | "fail";
  runs: number;
};

type BenchmarksResponse = {
  rows: BenchmarkRow[];
  totals: { visual: number; a11y: number; buildPassRate: number };
};

/**
 * Benchmarks are computed from this workspace's own runs (visual diff vs. a
 * pixel-comparison of the original capture and the rendered clone). Until a
 * real comparator exists in the pipeline, the backend returns an empty list
 * and we show an honest "no data yet" state.
 */
export default function Benchmarks() {
  const { data, isLoading } = useQuery<BenchmarksResponse>({
    queryKey: ["benchmarks"],
    queryFn: async () => {
      const res = await fetch("/api/benchmarks", { credentials: "include" });
      if (!res.ok) throw new Error(`Benchmarks failed: ${res.status}`);
      return res.json();
    },
  });

  return (
    <AppShell>
      <div className="container max-w-6xl py-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Benchmarks</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Visual and accessibility accuracy from your completed runs.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="mt-8 glass rounded-2xl p-12 text-center">
            <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <div className="font-medium">No benchmark data yet</div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Benchmarks are computed from your completed clones. Start a few runs and check back.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              {[
                { k: "Avg visual accuracy", v: `${data.totals.visual.toFixed(1)}%` },
                { k: "Avg accessibility", v: `${data.totals.a11y.toFixed(1)}%` },
                { k: "Build pass rate", v: `${(data.totals.buildPassRate * 100).toFixed(0)}%` },
              ].map((s) => (
                <div key={s.k} className="glass rounded-2xl p-5">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.k}</div>
                  <div className="mt-2 font-display text-3xl gradient-text font-semibold">{s.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 glass rounded-2xl overflow-hidden">
              <div className="grid grid-cols-6 text-[11px] uppercase tracking-wider text-muted-foreground px-5 py-3">
                <div className="col-span-2">Site</div>
                <div>Visual</div>
                <div>A11y</div>
                <div>Build</div>
                <div className="text-right">Runs</div>
              </div>
              {data.rows.map((r) => (
                <div key={r.site} className="grid grid-cols-6 px-5 py-3 odd:bg-secondary/20 text-sm items-center">
                  <div className="col-span-2 font-mono">{r.site}</div>
                  <div className="font-mono">{r.visual}%</div>
                  <div className="font-mono">{r.a11y}%</div>
                  <div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                        r.build === "pass"
                          ? "bg-success/15 text-success border-success/20"
                          : r.build === "warn"
                          ? "bg-warning/15 text-warning border-warning/20"
                          : "bg-destructive/15 text-destructive border-destructive/20"
                      }`}
                    >
                      {r.build}
                    </span>
                  </div>
                  <div className="text-right font-mono text-muted-foreground">{r.runs}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
