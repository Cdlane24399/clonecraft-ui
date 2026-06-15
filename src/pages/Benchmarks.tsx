import AppShell from "@/components/AppShell";
import { Trophy } from "lucide-react";

const rows = [
  { site: "linear.app", visual: 96, a11y: 94, build: "pass", runs: 12 },
  { site: "vercel.com", visual: 94, a11y: 91, build: "pass", runs: 9 },
  { site: "stripe.com", visual: 88, a11y: 87, build: "pass", runs: 7 },
  { site: "notion.so", visual: 91, a11y: 90, build: "pass", runs: 5 },
  { site: "framer.com", visual: 79, a11y: 83, build: "warn", runs: 3 },
];

export default function Benchmarks() {
  return (
    <AppShell>
      <div className="container max-w-6xl py-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Benchmarks</h1>
            <p className="text-muted-foreground text-sm mt-1">Aggregate accuracy across recent runs.</p>
          </div>
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            { k: "Avg visual accuracy", v: "91.6%" },
            { k: "Avg accessibility", v: "89.0%" },
            { k: "Build pass rate", v: "94%" },
          ].map(s => (
            <div key={s.k} className="glass rounded-2xl p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.k}</div>
              <div className="mt-2 font-display text-3xl gradient-text font-semibold">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-6 text-[11px] uppercase tracking-wider text-muted-foreground px-5 py-3">
            <div className="col-span-2">Site</div>
            <div>Visual</div><div>A11y</div><div>Build</div><div className="text-right">Runs</div>
          </div>
          {rows.map(r => (
            <div key={r.site} className="grid grid-cols-6 px-5 py-3 odd:bg-secondary/20 text-sm items-center">
              <div className="col-span-2 font-mono">{r.site}</div>
              <div className="font-mono">{r.visual}%</div>
              <div className="font-mono">{r.a11y}%</div>
              <div>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${r.build === "pass" ? "bg-success/15 text-success border-success/20" : "bg-warning/15 text-warning border-warning/20"}`}>
                  {r.build}
                </span>
              </div>
              <div className="text-right font-mono text-muted-foreground">{r.runs}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
