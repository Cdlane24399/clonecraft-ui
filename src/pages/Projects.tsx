import { Link } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";

const projects = [
  { name: "Linear Clone", url: "linear.app", acc: 96, pages: 5, status: "ready", updated: "2m ago" },
  { name: "Vercel Clone", url: "vercel.com", acc: 94, pages: 8, status: "ready", updated: "1h ago" },
  { name: "Stripe Clone", url: "stripe.com", acc: 88, pages: 12, status: "review", updated: "Yesterday" },
  { name: "Notion Clone", url: "notion.so", acc: 91, pages: 6, status: "ready", updated: "2d ago" },
  { name: "Framer Clone", url: "framer.com", acc: 79, pages: 4, status: "draft", updated: "5d ago" },
  { name: "Cursor Clone", url: "cursor.com", acc: 93, pages: 3, status: "ready", updated: "1w ago" },
];

export default function Projects() {
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

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link to="/app/results" key={p.name} className="glass rounded-2xl p-5 hover:border-primary/40 transition-smooth group block">
              <div className="aspect-video rounded-lg bg-secondary/50 relative overflow-hidden mb-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(258_92%_66%/0.4),transparent_40%),radial-gradient(circle_at_80%_70%,hsl(188_95%_55%/0.3),transparent_40%)]" />
                <div className="absolute top-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/70 border border-border/60">
                  {p.acc}% match
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <div className="font-medium">{p.name}</div>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-border bg-secondary text-muted-foreground">{p.status}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground font-mono">{p.url}</div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>{p.pages} pages</span><span>updated {p.updated}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
