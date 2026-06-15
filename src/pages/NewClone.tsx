import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Globe, Sparkles, Wand2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const depths = [
  { id: "landing", label: "Landing page", desc: "Single URL only" },
  { id: "top5", label: "Top 5 pages", desc: "Smart crawl of key routes" },
  { id: "full", label: "Full site crawl", desc: "Up to 200 pages" },
];
const stacks = [
  { id: "react", label: "React + Tailwind" },
  { id: "next", label: "Next.js + Tailwind" },
  { id: "html", label: "HTML / CSS static" },
];
const goals = [
  { id: "recreate", label: "Recreate", desc: "High-fidelity match" },
  { id: "redesign", label: "Redesign", desc: "Modernize the visual layer" },
  { id: "rebrand", label: "Rebrand", desc: "Swap palette, typography, logo" },
  { id: "saas", label: "Convert to SaaS", desc: "Add auth, dashboard, billing" },
];
const toggles = [
  { id: "responsive", label: "Responsive layout", desc: "Mobile, tablet, desktop" },
  { id: "animations", label: "Animations", desc: "Recreate motion and transitions" },
  { id: "a11y", label: "Accessibility pass", desc: "WCAG semantic upgrades" },
  { id: "seo", label: "SEO structure", desc: "Meta, sitemap, structured data" },
  { id: "backend", label: "Mock backend", desc: "Stub APIs and seed data" },
];

export default function NewClone() {
  const nav = useNavigate();
  const [url, setUrl] = useState("https://example.com");
  const [depth, setDepth] = useState("top5");
  const [stack, setStack] = useState("react");
  const [goal, setGoal] = useState("recreate");
  const [opts, setOpts] = useState<Record<string, boolean>>({
    responsive: true, animations: true, a11y: true, seo: false, backend: false,
  });

  const handleGenerate = () => {
    sessionStorage.setItem("cc:lastUrl", url);
    nav("/app/progress");
  };

  return (
    <AppShell>
      <div className="container max-w-5xl py-10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          New clone
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">Start a new clone</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Paste a URL you own or have permission to analyze. CloneCraft will plan a multi-agent run and produce an editable codebase.
        </p>

        <div className="mt-8 gradient-border">
          <div className="rounded-[inherit] glass-strong p-6 md:p-8">
            {/* URL */}
            <Label className="text-sm font-medium">Website URL</Label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 focus-within:border-primary/60 transition-smooth">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-12 text-base font-mono"
              />
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground border border-border/80 rounded px-1.5 py-0.5">
                <Info className="w-3 h-3" /> consent verified
              </span>
            </div>

            {/* Options grid */}
            <div className="mt-8 grid md:grid-cols-2 gap-8">
              <OptionGroup title="Clone depth">
                <div className="space-y-2">
                  {depths.map((d) => (
                    <OptionCard key={d.id} selected={depth === d.id} onClick={() => setDepth(d.id)} title={d.label} desc={d.desc} />
                  ))}
                </div>
              </OptionGroup>
              <OptionGroup title="Output stack">
                <div className="space-y-2">
                  {stacks.map((s) => (
                    <OptionCard key={s.id} selected={stack === s.id} onClick={() => setStack(s.id)} title={s.label} />
                  ))}
                </div>
              </OptionGroup>
            </div>

            <div className="mt-8">
              <OptionGroup title="Goal">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {goals.map((g) => (
                    <OptionCard key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)} title={g.label} desc={g.desc} />
                  ))}
                </div>
              </OptionGroup>
            </div>

            <div className="mt-8">
              <OptionGroup title="Additional passes">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {toggles.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-3 p-4 rounded-xl border border-border/60 bg-secondary/30">
                      <div>
                        <div className="text-sm font-medium">{t.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                      </div>
                      <Switch checked={opts[t.id]} onCheckedChange={(v) => setOpts({ ...opts, [t.id]: v })} />
                    </div>
                  ))}
                </div>
              </OptionGroup>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground max-w-md">
                Use for redesigns, migrations, internal prototypes, and owned websites. Submitting a URL confirms you have permission to analyze it.
              </p>
              <Button onClick={handleGenerate} size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow h-12 px-6">
                <Wand2 className="w-4 h-4 mr-2" /> Generate clone
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function OptionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">{title}</div>
      {children}
    </div>
  );
}

function OptionCard({ title, desc, selected, onClick }: { title: string; desc?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-smooth",
        selected
          ? "border-primary/60 bg-primary/10 shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
          : "border-border/60 bg-secondary/30 hover:border-border hover:bg-secondary/60"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <div className={cn("w-4 h-4 rounded-full border", selected ? "border-primary bg-primary" : "border-border")}>
          {selected && <div className="w-1.5 h-1.5 m-auto rounded-full bg-primary-foreground mt-[5px]" />}
        </div>
      </div>
      {desc && <div className="text-xs text-muted-foreground mt-1">{desc}</div>}
    </button>
  );
}
