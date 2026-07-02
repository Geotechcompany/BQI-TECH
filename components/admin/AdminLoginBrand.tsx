"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { Version2Badge } from "@/components/admin/AdminBrandTitle";

type AdminLoginBrandProps = {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  showBadge?: boolean;
  showCard?: boolean;
  badgeVariant?: "primary" | "slate" | "light" | "cyanDark";
};

const sizeClasses = {
  sm: "h-8 w-auto",
  md: "h-11 w-auto",
  lg: "h-14 w-auto",
};

const dimensions = {
  sm: { width: 120, height: 36 },
  md: { width: 160, height: 48 },
  lg: { width: 200, height: 60 },
};

export function AdminLoginBrand({
  variant = "light",
  size = "md",
  className,
  showBadge = true,
  showCard = true,
  badgeVariant = "primary",
}: AdminLoginBrandProps) {
  const logoSrc = variant === "dark" ? "/bqilogo-light.png" : "/bqilogo.png";
  const dims = dimensions[size];

  const logo = (
    <Image
      src={logoSrc}
      alt="BQI"
      width={dims.width}
      height={dims.height}
      priority
      className={cn(sizeClasses[size], "object-contain")}
    />
  );

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {showCard ? (
        <div
          className={cn(
            "relative flex items-center justify-center rounded-2xl px-5 py-3",
            variant === "dark"
              ? "bg-white/10 ring-1 ring-white/20 backdrop-blur-sm"
              : "bg-gradient-to-b from-muted/30 to-muted/60 ring-1 ring-border/60 shadow-sm"
          )}
        >
          {logo}
        </div>
      ) : (
        logo
      )}
      {showBadge && <Version2Badge variant={badgeVariant} className="shrink-0" />}
    </div>
  );
}
