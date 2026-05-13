import { Layers2 } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeBase =
  "inline-flex shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide";

type BadgeVariant = "primary" | "slate" | "light" | "cyanDark";

const badgeVariantClass: Record<BadgeVariant, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  slate: "border-sky-200 bg-sky-50 text-sky-700",
  light: "border-white/40 bg-white/15 text-white",
  cyanDark: "border-cyan-400/50 bg-cyan-500/10 text-cyan-300",
};

export function Version2Badge({
  variant = "primary",
  className,
}: {
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(badgeBase, badgeVariantClass[variant], className)}
      title="Version 2"
      aria-label="Version 2"
    >
      <Layers2 className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      v2
    </span>
  );
}

type AdminBrandTitleProps = {
  className?: string;
  titleClassName?: string;
  badgeVariant?: BadgeVariant;
};

export function AdminBrandTitle({
  className,
  titleClassName,
  badgeVariant = "primary",
}: AdminBrandTitleProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span className={cn("font-bold tracking-tight", titleClassName ?? "text-lg")}>
        BQI HR
      </span>
      <Version2Badge variant={badgeVariant} />
    </span>
  );
}
