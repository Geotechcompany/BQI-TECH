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
    brandTitleClass: studio ? "text-lg text-white" : "text-lg",

    shell: cn(
      "fixed left-0 z-[9999] shadow-xl transition-[width] duration-300 ease-in-out",
      studio &&
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#31CDFF]/70 before:to-transparent",
      studio
        ? "border-r border-white/[0.1] bg-gradient-to-b from-[#272055] via-[#2a265c] to-[#1f1c42] text-white shadow-xl shadow-[#272055]/25"
        : "border-r-0 bg-card text-foreground"
    ),

    iconButton: studio ? "hover:bg-white/10" : "hover:bg-muted",

    navLink: (active: boolean) =>
      cn(
        "flex items-center w-full rounded-lg text-sm transition-colors",
        studio
          ? active
            ? "border border-[#31CDFF]/35 bg-[#31CDFF]/14 text-[#31CDFF]"
            : "border border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.08] hover:text-white"
          : active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
      ),

    navLinkCollapsed: (active: boolean) =>
      cn(
        "flex items-center justify-center w-full p-3 rounded-lg text-sm transition-colors",
        studio
          ? active
            ? "border border-[#31CDFF]/35 bg-[#31CDFF]/14 text-[#31CDFF]"
            : "border border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.08] hover:text-white"
          : active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
      ),

    sectionButton: cn(
      "flex items-center w-full p-3 rounded-lg transition-colors",
      studio ? "hover:bg-white/[0.06]" : "hover:bg-muted cursor-pointer"
    ),

    sectionIcon: studio ? "text-[#31CDFF]" : "text-primary",

    subLink: (active: boolean) =>
      cn(
        "flex items-center p-2 rounded-lg text-sm transition-colors",
        studio
          ? active
            ? "border border-[#31CDFF]/35 bg-[#31CDFF]/14 text-[#31CDFF]"
            : "text-white/65 hover:bg-white/[0.08] hover:text-white"
          : active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
      ),

    flyout: studio
      ? "bg-[#2a265c] text-white border border-white/12 shadow-2xl"
      : "bg-popover text-popover-foreground border border-border shadow-xl",

    flyoutHeading: studio
      ? "text-xs font-semibold text-white/45 mb-2 px-2"
      : "text-xs font-semibold text-muted-foreground mb-2 px-2",

    flyoutLink: (active: boolean) =>
      cn(
        "flex items-center p-2 rounded-md text-sm transition-colors w-full",
        studio
          ? active
            ? "border border-[#31CDFF]/35 bg-[#31CDFF]/14 text-[#31CDFF]"
            : "text-white/65 hover:bg-white/[0.08] hover:text-white"
          : active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted"
      ),

    logoutButton: cn(
      "group w-full flex items-center justify-center rounded-xl transition-all duration-200",
      studio
        ? "border border-white/10 bg-white/[0.05] px-3 py-2.5 text-white/75 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] hover:border-[#31CDFF]/35 hover:bg-[#31CDFF]/10 hover:text-white hover:shadow-[0_0_20px_rgba(49,205,255,0.12)]"
        : "bg-primary p-3 text-primary-foreground shadow-sm hover:opacity-90 hover:shadow-md"
    ),

    logoutIconWrap: studio
      ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 ring-1 ring-white/10 transition-all duration-200 group-hover:bg-[#31CDFF]/15 group-hover:text-[#31CDFF] group-hover:ring-[#31CDFF]/30"
      : "",

    logoutLabel: studio ? "text-sm font-medium tracking-wide" : "text-sm",

    logoutFooter: studio
      ? "border-t border-white/10 pt-3"
      : "",
  };
}
