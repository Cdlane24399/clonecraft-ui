import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  return (
    <AppShell>
      <div className="container max-w-3xl py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Workspace, defaults, and integrations.</p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="text-sm font-medium">Workspace</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input defaultValue="Acme Studio" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Default stack</Label>
              <Input defaultValue="React + Tailwind" className="mt-1" />
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="text-sm font-medium">Agent defaults</div>
          {[
            { k: "Always extract accessibility roles", on: true },
            { k: "Generate SEO metadata by default", on: false },
            { k: "Watermark preview deploys", on: true },
            { k: "Block flagged domains", on: true },
          ].map(s => (
            <div key={s.k} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0">
              <div className="text-sm">{s.k}</div>
              <Switch defaultChecked={s.on} />
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="text-sm font-medium">Danger zone</div>
          <p className="text-xs text-muted-foreground">Delete all projects in this workspace. This action cannot be undone.</p>
          <Button variant="destructive">Delete workspace data</Button>
        </div>
      </div>
    </AppShell>
  );
}
