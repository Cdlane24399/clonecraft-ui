import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showWordmark?: boolean;
};

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-primary shadow-card",
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-full w-full">
        <path
          d="M19.8 7.8h-7.5a4.5 4.5 0 0 0-4.5 4.5v7.4a4.5 4.5 0 0 0 4.5 4.5h7.5"
          fill="none"
          stroke="hsl(var(--primary-foreground))"
          strokeLinecap="round"
          strokeWidth="2.7"
        />
        <path
          d="M13.2 12.2h6.5a4.5 4.5 0 0 1 4.5 4.5v3a4.5 4.5 0 0 1-4.5 4.5h-6.5"
          fill="none"
          stroke="hsl(var(--primary-foreground) / 0.66)"
          strokeLinecap="round"
          strokeWidth="2.3"
        />
      </svg>
    </span>
  );
}

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  showWordmark = true,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className={markClassName} />
      {showWordmark && (
        <span className={cn("font-display font-semibold tracking-tight", textClassName)}>
          CloneCraft
        </span>
      )}
    </span>
  );
}
