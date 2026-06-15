import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";

const templates = [
  { name: "SaaS Marketing", desc: "Hero, features, pricing, testimonials, FAQ.", tag: "Marketing" },
  { name: "Docs Site", desc: "Sidebar, search, MDX-ready content layout.", tag: "Docs" },
  { name: "AI Product", desc: "Agentic landing with live demo embed.", tag: "AI" },
  { name: "Portfolio", desc: "Editorial portfolio with case studies.", tag: "Personal" },
  { name: "Dashboard Shell", desc: "Sidebar app shell with auth and settings.", tag: "App" },
  { name: "Ecommerce", desc: "PDP, cart, checkout, account.", tag: "Commerce" },
];

export default function Templates() {
  return (
    <AppShell>
      <div className="container max-w-6xl py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Templates</h1>
        <p className="text-muted-foreground text-sm mt-1">Start from a curated base instead of a URL.</p>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.name} className="glass rounded-2xl p-5 hover:border-primary/40 transition-smooth">
              <div className="aspect-video rounded-lg bg-secondary/50 relative overflow-hidden mb-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,hsl(258_92%_66%/0.4),transparent_40%),radial-gradient(circle_at_70%_60%,hsl(188_95%_55%/0.3),transparent_40%)]" />
              </div>
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.name}</div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground">{t.tag}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              <Button size="sm" className="mt-4 w-full bg-gradient-primary text-primary-foreground">Use template</Button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
