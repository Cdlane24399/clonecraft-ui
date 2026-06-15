import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowRight,
  Globe2,
  Code2,
  Palette,
  ShieldCheck,
  Workflow,
  Bot,
  Gauge,
  Layers,
  Check,
  Github,
  ChevronRight,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const features = [
  { icon: Bot, title: "Multi-agent analysis", desc: "Specialized agents handle crawling, vision, DOM extraction, and code generation in parallel." },
  { icon: Palette, title: "Design system extraction", desc: "Auto-detect colors, typography, spacing scales, radii, shadows, and reusable component tokens." },
  { icon: Code2, title: "Editable React codebase", desc: "Production-ready React + Tailwind output you can open, edit, and ship — never a black box." },
  { icon: Gauge, title: "Visual accuracy scoring", desc: "Pixel-diff and structural comparison against the source for every page and breakpoint." },
  { icon: Layers, title: "Component library", desc: "Detects reusable components like navbars, hero sections, pricing tables, and forms." },
  { icon: ShieldCheck, title: "Ethical guardrails", desc: "Built for redesigns, migrations, internal prototypes, and sites you own — with consent prompts and watermarks." },
];

const steps = [
  { n: "01", title: "Paste a URL", desc: "Drop in any site you own or have permission to analyze." },
  { n: "02", title: "Agents go to work", desc: "Browser automation captures screenshots, routes, DOM, and assets." },
  { n: "03", title: "Code is generated", desc: "Components, design tokens, and routes are scaffolded into a clean codebase." },
  { n: "04", title: "Edit & export", desc: "Customize in our editor or export to GitHub, ZIP, or a live preview." },
];

const useCases = [
  { title: "Redesign sprints", desc: "Bring an existing site into a modern stack to redesign with confidence." },
  { title: "Migrations", desc: "Move legacy marketing sites onto React, Next.js, or Tailwind in hours." },
  { title: "Internal prototypes", desc: "Stand up clickable internal demos based on real UI patterns." },
  { title: "Inspiration boards", desc: "Capture and study design systems from your own portfolio of sites." },
];

const plans = [
  {
    name: "Starter", price: "$0", desc: "Try the platform on your own sites.",
    features: ["3 clones / month", "Landing page only", "React + Tailwind export", "Community support"],
    cta: "Get started", highlight: false,
  },
  {
    name: "Pro", price: "$39", desc: "For designers, founders, and freelancers.",
    features: ["50 clones / month", "Top 5 pages crawl", "All export stacks", "GitHub push & deploy preview", "Priority agents"],
    cta: "Start Pro trial", highlight: true,
  },
  {
    name: "Team", price: "$129", desc: "Migrations and prototyping at scale.",
    features: ["Unlimited clones", "Full-site crawl", "Shared workspaces & roles", "SSO & audit logs", "Dedicated support"],
    cta: "Talk to sales", highlight: false,
  },
];

const faqs = [
  { q: "Is CloneCraft AI legal to use?", a: "CloneCraft is built for redesigning, migrating, prototyping, and analyzing websites you own or have explicit permission to work with. We surface consent prompts, watermark previews, and block flagged domains. You are responsible for the rights to any URL you submit." },
  { q: "What does the output actually look like?", a: "A clean React + Tailwind (or Next.js) project with semantic components, extracted design tokens, route files, and an issues report. No obfuscated bundles — every file is human-readable and editable." },
  { q: "How accurate is the clone?", a: "Typical visual accuracy lands between 88% and 96% on marketing-style sites. We report per-page scores and flag anything below threshold as an issue with a suggested fix." },
  { q: "Can I push to GitHub?", a: "Yes. Pro and Team plans support GitHub push, ZIP export, and one-click deploy previews to Vercel-compatible hosts." },
  { q: "Do you store the original assets?", a: "Assets are stored temporarily in your workspace for editing, encrypted at rest, and auto-purged when a project is deleted." },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold tracking-tight">CloneCraft</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">AI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-smooth">How it works</a>
            <a href="#features" className="hover:text-foreground transition-smooth">Features</a>
            <a href="#use-cases" className="hover:text-foreground transition-smooth">Use cases</a>
            <a href="#pricing" className="hover:text-foreground transition-smooth">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-smooth">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/app/new">Sign in</Link>
            </Button>
            <Button asChild className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
              <Link to="/app/new">Start cloning <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="container relative pt-24 pb-28 md:pt-32 md:pb-36 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-muted-foreground mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            New · Agent v2 with 96% visual accuracy
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] animate-fade-in">
            Turn any website into <br className="hidden md:block" />
            an <span className="gradient-text">editable app.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground animate-fade-in">
            CloneCraft AI analyzes a website, extracts its design system, generates a working React/Next.js codebase, and lets you customize and ship it — built for redesigns, migrations, and prototypes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in">
            <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow h-12 px-6">
              <Link to="/app/new">Start cloning <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 border-border/80 bg-card/40 backdrop-blur">
              <Link to="/app/results">View demo</Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Use for redesigns, migrations, internal prototypes, and owned websites.
          </p>

          {/* Hero mock */}
          <div className="relative mt-16 mx-auto max-w-5xl animate-scale-in">
            <div className="absolute -inset-8 bg-gradient-primary opacity-30 blur-3xl rounded-full" />
            <div className="relative gradient-border">
              <div className="rounded-[inherit] glass-strong overflow-hidden">
                <div className="flex items-center gap-2 px-4 h-10 border-b border-border/60 bg-card/60">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
                  </div>
                  <div className="mx-auto text-xs text-muted-foreground font-mono">clonecraft.ai/app/results</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/40">
                  <div className="bg-background p-5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Original</div>
                    <div className="aspect-[16/10] rounded-lg bg-secondary/60 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,hsl(258_92%_66%/0.4),transparent_40%),radial-gradient(circle_at_80%_70%,hsl(188_95%_55%/0.3),transparent_40%)]" />
                      <div className="absolute top-3 left-3 right-3 h-2 bg-foreground/10 rounded" />
                      <div className="absolute top-7 left-3 w-1/3 h-2 bg-foreground/10 rounded" />
                      <div className="absolute bottom-6 left-3 right-3 h-16 bg-foreground/5 rounded-md" />
                    </div>
                  </div>
                  <div className="bg-background p-5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      Generated <span className="px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/20">96% match</span>
                    </div>
                    <div className="aspect-[16/10] rounded-lg bg-secondary/60 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,hsl(258_92%_66%/0.45),transparent_40%),radial-gradient(circle_at_75%_65%,hsl(188_95%_55%/0.35),transparent_40%)]" />
                      <div className="absolute top-3 left-3 right-3 h-2 bg-foreground/10 rounded" />
                      <div className="absolute top-7 left-3 w-1/3 h-2 bg-foreground/10 rounded" />
                      <div className="absolute bottom-6 left-3 right-3 h-16 bg-foreground/5 rounded-md border border-primary/30" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 border-t border-border/40">
                  {[
                    { k: "Visual", v: "96%" },
                    { k: "Responsive", v: "98%" },
                    { k: "A11y", v: "91%" },
                    { k: "Pages", v: "7" },
                  ].map((s) => (
                    <div key={s.k} className="bg-background p-4">
                      <div className="text-xs text-muted-foreground">{s.k}</div>
                      <div className="text-lg font-semibold">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Logos */}
          <div className="mt-16 text-xs text-muted-foreground tracking-widest uppercase">Trusted by teams at</div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
            {["Linear", "Vercel", "Stripe", "Framer", "Notion", "Cursor"].map((n) => (
              <div key={n} className="font-display text-lg font-semibold tracking-tight">{n}</div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container py-24">
        <SectionHeader eyebrow="How it works" title="From URL to working codebase in minutes" />
        <div className="mt-14 grid md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div key={s.n} className="relative group">
              <div className="glass rounded-2xl p-6 h-full transition-smooth hover:-translate-y-1">
                <div className="text-xs font-mono text-primary">{s.n}</div>
                <div className="mt-3 font-display text-lg font-semibold">{s.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{s.desc}</div>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-24">
        <SectionHeader eyebrow="Features" title="A full stack of AI agents and tooling" />
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 transition-smooth hover:border-primary/40 hover:-translate-y-0.5 group">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow mb-4 group-hover:scale-110 transition-smooth">
                <f.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="font-display text-lg font-semibold">{f.title}</div>
              <div className="mt-2 text-sm text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="container py-24">
        <SectionHeader eyebrow="Use cases" title="Built for the work designers actually do" />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {useCases.map((u, i) => (
            <div key={u.title} className="relative overflow-hidden rounded-2xl glass p-6">
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-primary opacity-10 blur-2xl" />
              <Workflow className="w-5 h-5 text-accent mb-3" />
              <div className="font-display font-semibold">{u.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{u.desc}</div>
              <div className="mt-4 text-xs font-mono text-muted-foreground">0{i + 1}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container py-24">
        <SectionHeader eyebrow="Pricing" title="Simple plans that scale with your team" />
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-6 flex flex-col ${
                p.highlight
                  ? "gradient-border shadow-glow"
                  : "glass"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-semibold">{p.name}</div>
                {p.highlight && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gradient-primary text-primary-foreground">Most popular</span>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-display font-semibold">{p.price}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{p.desc}</div>
              <ul className="mt-6 space-y-2.5 text-sm flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className={`mt-6 ${p.highlight ? "bg-gradient-primary text-primary-foreground" : ""}`} variant={p.highlight ? "default" : "outline"}>
                <Link to="/app/new">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container py-24">
        <SectionHeader eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-10 max-w-3xl mx-auto glass rounded-2xl p-2 md:p-4">
          <Accordion type="single" collapsible>
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="px-4 text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="relative overflow-hidden rounded-3xl gradient-border p-10 md:p-16 text-center">
          <div className="absolute inset-0 bg-gradient-hero opacity-80" />
          <div className="relative">
            <Globe2 className="w-10 h-10 text-accent mx-auto mb-4" />
            <h3 className="font-display text-3xl md:text-5xl font-semibold tracking-tight">
              Ship your next redesign <span className="gradient-text">10× faster.</span>
            </h3>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Start with a URL you own and watch our agents rebuild it as an editable codebase.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow h-12 px-6">
                <Link to="/app/new">Start cloning <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6">
                <Link to="/app/results">View demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span>© {new Date().getFullYear()} CloneCraft AI. Use ethically.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground inline-flex items-center gap-1"><Github className="w-4 h-4" /> GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-widest text-accent font-mono">{eyebrow}</div>
      <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}
