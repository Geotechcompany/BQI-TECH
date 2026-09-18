import { cn } from "@/lib/utils";
import type { AdminTheme } from "@/contexts/AdminThemeContext";

export function isStudioTheme(theme: AdminTheme) {
  return theme === "studio";
}

export function getSidebarSkin(theme: AdminTheme) {
  const studio = theme === "studio";

  return {
    studio,
    logoSrc: studio ? "/bqilogo-light.png" : "/bqilogo.png",
    collapseIconSrc: studio
      ? "/collapse-svg-white.svg"
      : "/collapse-svg-black.svg",
    collapseIconDarkSrc: "/collapse-svg-white.svg",
    brandBadge: studio ? ("cyanDark" as const) : ("primary" as const),
    brandTitleClass: studio ? "text-base text-white" : "text-base",

    shell: cn(
      "fixed left-0 z-[9999] shadow-xl transition-[width] duration-300 ease-in-out",
      studio &&
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#31CDFF]/70 before:to-transparent",
      studio
        ? "border-r border-white/[0.1] bg-gradient-to-b from-[#272156] via-[#2a265c] to-[#1f1c42] text-white shadow-xl shadow-[#272156]/25"
        : "border-r-0 bg-card text-foreground"
    ),

    iconButton: studio ? "hover:bg-white/10" : "hover:bg-muted",

    /** Small uppercase group label (TeamPulse-style density). */
    sectionLabel: studio
      ? "px-2.5 pb-1 pt-0 text-[10px] font-medium uppercase tracking-[0.08em] text-white/40"
      : "px-2.5 pb-1 pt-0 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/75",

    navSection: "space-y-0.5 pt-3 first:pt-0",

    navLink: (active: boolean) =>
      cn(
        "flex items-center w-full rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        studio
          ? active
            ? "bg-[#31CDFF]/14 text-[#31CDFF]"
            : "text-white/65 hover:bg-white/[0.06] hover:text-white"
          : active
            ? "bg-[#272156]/10 text-[#272156]"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      ),

    /** Icon-rail button (collapsed sidebar). Soft rounded active pill. */
    navLinkCollapsed: (active: boolean) =>
      cn(
        "flex items-center justify-center w-full rounded-lg p-2 transition-colors",
        studio
          ? active
            ? "bg-[#31CDFF]/18 text-[#31CDFF]"
            : "text-white/65 hover:bg-white/[0.06] hover:text-white"
          : active
            ? "bg-[#272156]/12 text-[#272156]"
            : "text-muted-foreground hover:bg-muted/80"
      ),

    /** Thin rule before Settings/Help in the collapsed icon rail. */
    railDivider: studio
      ? "mx-2 my-1.5 h-px bg-white/15"
      : "mx-2 my-1.5 h-px bg-border",

    railNav: "flex flex-col gap-0.5",

    sectionIcon: studio ? "text-[#31CDFF]/80" : "text-[#272156]/70",

    navIcon: "h-4 w-4 shrink-0",

    sectionButton: cn(
      "flex items-center w-full rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
      studio ? "hover:bg-white/[0.06]" : "hover:bg-muted cursor-pointer"
    ),

    sectionButtonActive: (active: boolean) =>
      cn(
        "flex w-full items-center rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        studio
          ? active
            ? "bg-[#31CDFF]/10 text-[#31CDFF]"
            : "text-white/75 hover:bg-white/[0.06] hover:text-white"
          : active
            ? "bg-[#272156]/08 text-[#272156]"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      ),

    subLink: (active: boolean) =>
      cn(
        "relative flex items-center rounded-md py-1.5 pl-3 pr-2.5 text-[13px] font-medium transition-colors",
        studio
          ? active
            ? "bg-[#31CDFF]/14 text-[#31CDFF]"
            : "text-white/60 hover:bg-white/[0.06] hover:text-white"
          : active
            ? "bg-[#272156]/10 text-[#272156]"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      ),

    /** Vertical guide + bullet rail for nested children (Talenta-style). */
    childRail: studio
      ? "ml-[18px] space-y-0.5 border-l border-white/15 pl-3"
      : "ml-[18px] space-y-0.5 border-l border-[#272156]/15 pl-3",

    childBullet: studio
      ? "mr-2 h-1 w-1 shrink-0 rounded-full bg-white/35"
      : "mr-2 h-1 w-1 shrink-0 rounded-full bg-[#272156]/35",

    chevron: studio ? "h-3.5 w-3.5 shrink-0 text-white/45" : "h-3.5 w-3.5 shrink-0 text-muted-foreground/70",

    // Fully opaque solid panel — ! overrides DropdownMenuContent `bg-popover`
    flyout: studio
      ? "rounded-xl border border-white/15 !bg-[#2a265c] !opacity-100 text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.55)] backdrop-blur-none"
      : "rounded-xl border border-[#272156]/10 !bg-white !opacity-100 text-foreground shadow-[0_16px_40px_-12px_rgba(39,33,86,0.2)] backdrop-blur-none",

    flyoutBg: studio ? "#2a265c" : "#ffffff",

    flyoutHeading: studio
      ? "mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-white/45"
      : "mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground",

    flyoutLink: (active: boolean) =>
      cn(
        "flex w-full items-center rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
        studio
          ? active
            ? "bg-[#31CDFF]/14 text-[#31CDFF]"
            : "text-white/80 hover:bg-white/10 hover:text-white"
          : active
            ? "bg-[#272156]/10 text-[#272156]"
            : "text-foreground hover:bg-muted"
      ),

    profileFooter: studio ? "border-t border-white/10 pt-3" : "border-t border-border/60 pt-3",
  };
}
