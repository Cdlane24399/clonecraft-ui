import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Code2,
  Palette,
  ShieldCheck,
  Workflow,
  Bot,
  Gauge,
  Layers,
  Check,
  Github,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BrandLogo } from "@/components/BrandLogo";
const HeroRemotionPlayer = lazy(() =>
  import("@/components/HeroRemotionPlayer").then((module) => ({ default: module.HeroRemotionPlayer })),
);

const features = [
  { icon: Bot, title: "Multi-agent analysis", desc: "Specialized agents handle crawling, vision, DOM extraction, and code generation in parallel." },
  { icon: Palette, title: "Design system extraction", desc: "Auto-detect colors, typography, spacing scales, radii, shadows, and reusable component tokens." },
  { icon: Code2, title: "Editable React codebase", desc: "Production-ready React and Tailwind output you can open, edit, and ship. Never a black box." },
  { icon: Gauge, title: "Visual accuracy scoring", desc: "Pixel-diff and structural comparison against the source for every page and breakpoint." },
  { icon: Layers, title: "Component library", desc: "Detects reusable components like navbars, hero sections, pricing tables, and forms." },
  { icon: ShieldCheck, title: "Ethical guardrails", desc: "Built for redesigns, migrations, and sites you own, with consent prompts and watermarked previews." },
];

const steps = [
  { n: "01", title: "Paste a URL", desc: "Drop in any site you own or have permission to analyze." },
  { n: "02", title: "Agents go to work", desc: "Browser automation captures screenshots, routes, DOM, and assets." },
  { n: "03", title: "Code is generated", desc: "Components, design tokens, and routes are scaffolded into a clean codebase." },
  { n: "04", title: "Edit and export", desc: "Customize in the editor or export to GitHub, ZIP, or a live preview." },
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
    features: ["50 clones / month", "Top 5 pages crawl", "All export stacks", "GitHub push and deploy preview", "Priority agents"],
    cta: "Start Pro trial", highlight: true,
  },
  {
    name: "Team", price: "$129", desc: "Migrations and prototyping at scale.",
    features: ["Unlimited clones", "Full-site crawl", "Shared workspaces and roles", "SSO and audit logs", "Dedicated support"],
    cta: "Talk to sales", highlight: false,
  },
];

const faqs = [
  { q: "Is CloneCraft legal to use?", a: "CloneCraft is built for redesigning, migrating, prototyping, and analyzing websites you own or have explicit permission to work with. We surface consent prompts, watermark previews, and block flagged domains. You are responsible for the rights to any URL you submit." },
  { q: "What does the output actually look like?", a: "A clean React and Tailwind (or Next.js) project with semantic components, extracted design tokens, route files, and an issues report. Every file is human-readable and editable, with no obfuscated bundles." },
  { q: "How accurate is the clone?", a: "Visual accuracy typically lands between 88% and 96% on marketing-style sites. We report per-page scores and flag anything below threshold as an issue with a suggested fix." },
  { q: "Can I push to GitHub?", a: "Yes. Pro and Team plans support GitHub push, ZIP export, and one-click deploy previews to Vercel-compatible hosts." },
  { q: "Do you store the original assets?", a: "Assets are stored temporarily in your workspace for editing, encrypted at rest, and auto-purged when a project is deleted." },
];

const proofPoints = [
  "Design audits",
  "Site migrations",
  "Prototype rebuilds",
  "Code exports",
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandLogo textClassName="text-[15px]" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-smooth">How it works</a>
            <a href="#features" className="hover:text-foreground transition-smooth">Features</a>
            <a href="#use-cases" className="hover:text-foreground transition-smooth">Use cases</a>
            <a href="#pricing" className="hover:text-foreground transition-smooth">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-smooth">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/app/new">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/app/new">Start cloning</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
        <div className="container relative grid lg:grid-cols-2 gap-12 lg:gap-10 items-center pt-20 pb-16 md:pt-24 md:pb-24">
          <div className="max-w-xl">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] animate-fade-in">
              Turn any website into an <span className="gradient-text">editable app.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-md animate-fade-in">
              Point CloneCraft at a site you own. It extracts the design system and ships a clean, editable React codebase.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-fade-in">
              <Button asChild size="lg" className="h-12 px-6 text-[15px]">
                <Link to="/app/new">Start cloning <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[15px]">
                <Link to="/app/results">View demo</Link>
              </Button>
            </div>
          </div>

          <div className="relative animate-fade-in">
            <Suspense
              fallback={
                <img
                  src="/hero-clone.jpg"
                  alt="CloneCraft turning a live website into an editable React codebase, side by side"
                  width={1376}
                  height={768}
                  className="w-full rounded-xl border border-border/70 shadow-soft"
                />
              }
            >
              <HeroRemotionPlayer />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/50 md:grid-cols-4">
          {proofPoints.map((item) => (
            <div key={item} className="bg-card/70 px-4 py-4 text-center text-sm font-medium text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container py-24">
        <SectionHeader title="From URL to working codebase in minutes" />
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-border/60 bg-border/40">
          {steps.map((s) => (
            <div key={s.n} className="bg-card p-6 transition-smooth hover:bg-secondary/40">
              <div className="text-sm font-medium text-accent tabular-nums">{s.n}</div>
              <div className="mt-3 font-display text-lg font-semibold">{s.title}</div>
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-24">
        <SectionHeader eyebrow="Features" title="A full stack of agents and tooling" />
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 bg-card/60 p-6 transition-smooth hover:border-accent/40">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-accent" strokeWidth={2} />
              </div>
              <div className="font-display text-lg font-semibold">{f.title}</div>
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="container py-24">
        <SectionHeader title="Built for the work designers actually do" />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {useCases.map((u) => (
            <div key={u.title} className="rounded-2xl border border-border/60 bg-card/60 p-6">
              <Workflow className="w-5 h-5 text-accent mb-4" strokeWidth={2} />
              <div className="font-display font-semibold">{u.title}</div>
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{u.desc}</div>
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
              className={`rounded-2xl p-6 flex flex-col border ${
                p.highlight ? "border-accent/60 bg-card" : "border-border/60 bg-card/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-semibold">{p.name}</div>
                {p.highlight && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">Most popular</span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-display font-semibold">{p.price}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{p.desc}</div>
              <ul className="mt-6 space-y-2.5 text-sm flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" strokeWidth={2.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant={p.highlight ? "default" : "outline"}>
                <Link to="/app/new">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container py-24">
        <SectionHeader title="Questions, answered" />
        <div className="mt-10 max-w-3xl mx-auto rounded-2xl border border-border/60 bg-card/60 p-2 md:p-4">
          <Accordion type="single" collapsible>
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="px-4 text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-10 md:p-16 text-center">
          <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
          <div className="relative">
            <h3 className="font-display text-3xl md:text-5xl font-semibold tracking-tight">
              Rebuild any site as <span className="gradient-text">code you can ship.</span>
            </h3>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Start with a URL you own and watch the agents rebuild it as an editable codebase.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-[15px]">
                <Link to="/app/new">Start cloning <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-[15px]">
                <Link to="/app/results">View demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <BrandLogo markClassName="h-6 w-6 rounded-md" showWordmark={false} />
            <span>© {new Date().getFullYear()} CloneCraft. Built for sites you own.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground transition-smooth">Privacy</a>
            <a href="#" className="hover:text-foreground transition-smooth">Terms</a>
            <a href="#" className="hover:text-foreground transition-smooth inline-flex items-center gap-1.5"><Github className="w-4 h-4" /> GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <div className="text-[13px] font-medium text-accent mb-3">{eyebrow}</div>}
      <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}
