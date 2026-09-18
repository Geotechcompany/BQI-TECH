"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, Share } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const BRAND = "#272156";
const APP_NAME = "BQI HR SOFTWARE";
const ICON_SRC = "/icons/icon-192.png";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

type InstallPwaButtonProps = {
  className?: string;
  /** Icon-only control for collapsed sidebar */
  compact?: boolean;
  /**
   * Icon-rail control: always-visible trigger with expandable popover
   * (short label + Download action). Prefer for dual-rail employee sidebar.
   */
  rail?: boolean;
  /** `brand` = primary fill; `on-dark` = glass on studio chrome; `subtle` = light surfaces */
  tone?: "brand" | "on-dark" | "subtle";
};

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const displayStandalone = window.matchMedia(
    "(display-mode: standalone)"
  ).matches;
  const iosStandalone =
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayStandalone || Boolean(iosStandalone);
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const classicIos = /iPad|iPhone|iPod/i.test(ua);
  const ipadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return classicIos || ipadOs;
}

async function hasRelatedInstalledApp(): Promise<boolean> {
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ id?: string }>>;
  };
  if (typeof nav.getInstalledRelatedApps !== "function") return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return false;
  }
}

const enterSpring = { type: "spring" as const, bounce: 0, duration: 0.4 };
const fadeOnly = { duration: 0.18, ease: "easeOut" as const };
const pressTap = { scale: 0.97 };

export function InstallPwaButton({
  className,
  compact = false,
  rail = false,
  tone = "brand",
}: InstallPwaButtonProps) {
  const reduceMotion = useReducedMotion();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosTip, setIosTip] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const markInstalled = () => {
      if (!cancelled) {
        setInstalled(true);
        setDeferredPrompt(null);
        setIosTip(false);
        setRailOpen(false);
      }
    };

    if (isStandaloneMode()) {
      markInstalled();
      return;
    }

    void hasRelatedInstalledApp().then((related) => {
      if (!cancelled && related) markInstalled();
    });

    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      if (cancelled) return;
      setDeferredPrompt(event);
      setIosTip(false);
    };

    const onAppInstalled = () => markInstalled();

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    if (isIosDevice() && !isStandaloneMode()) {
      setIosTip(true);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt || prompting) return;
    setPrompting(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
      }
      setDeferredPrompt(null);
      setRailOpen(false);
    } catch {
      // Browser may reject a second prompt; keep UI quiet.
    } finally {
      setPrompting(false);
    }
  }, [deferredPrompt, prompting]);

  if (installed) return null;

  const showInstall = Boolean(deferredPrompt);
  const showIosHint = iosTip && !showInstall;

  if (!showInstall && !showIosHint) return null;

  const surfaceClass =
    tone === "on-dark"
      ? "border-white/15 bg-white/[0.08] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-md hover:bg-white/[0.12]"
      : tone === "subtle"
        ? "border-border/70 bg-card/80 text-foreground shadow-sm backdrop-blur-md hover:bg-card"
        : "border-white/20 text-white shadow-[0_8px_24px_-12px_rgba(39,33,86,0.55)] backdrop-blur-md hover:brightness-[1.06]";

  const brandStyle =
    tone === "brand"
      ? { backgroundColor: BRAND }
      : undefined;

  const enterTransition = reduceMotion ? fadeOnly : enterSpring;
  const enterInitial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.94, y: 8 };
  const enterAnimate = { opacity: 1, scale: 1, y: 0 };

  if (rail) {
    const flyoutOnDark = tone === "on-dark";

    return (
      <Popover open={railOpen} onOpenChange={setRailOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <motion.button
                type="button"
                aria-label={
                  showIosHint
                    ? `Install ${APP_NAME}`
                    : `Download ${APP_NAME}`
                }
                aria-expanded={railOpen}
                initial={enterInitial}
                animate={enterAnimate}
                transition={enterTransition}
                whileTap={reduceMotion ? undefined : pressTap}
                className={cn(className)}
                data-tour="employee-nav-install-app"
              >
                {showIosHint ? (
                  <Share
                    className="h-[18px] w-[18px]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                ) : (
                  <Image
                    src={ICON_SRC}
                    alt=""
                    width={18}
                    height={18}
                    className="rounded-md object-contain"
                    unoptimized
                  />
                )}
              </motion.button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!railOpen ? (
            <TooltipContent side="right" sideOffset={10}>
              {APP_NAME}
            </TooltipContent>
          ) : null}
        </Tooltip>
        <PopoverContent
          side="right"
          align="end"
          sideOffset={12}
          className={cn(
            "z-[10000] w-[13.5rem] origin-left p-3",
            flyoutOnDark &&
              "border-white/12 bg-[#272156] text-white shadow-xl"
          )}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                flyoutOnDark ? "bg-white/10" : "bg-primary/10"
              )}
            >
              {showIosHint ? (
                <Share
                  className={cn(
                    "h-3.5 w-3.5",
                    flyoutOnDark ? "text-white/85" : "text-primary"
                  )}
                  aria-hidden
                />
              ) : (
                <Image
                  src={ICON_SRC}
                  alt=""
                  width={18}
                  height={18}
                  className="rounded-md"
                  unoptimized
                />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[12px] font-semibold leading-tight tracking-wide",
                  flyoutOnDark ? "text-white" : "text-foreground"
                )}
              >
                {APP_NAME}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] leading-snug",
                  flyoutOnDark ? "text-white/55" : "text-muted-foreground"
                )}
              >
                {showIosHint
                  ? "Share → Add to Home Screen"
                  : "Install the desktop app"}
              </p>
            </div>
          </div>

          {showIosHint ? null : (
            <motion.button
              type="button"
              onClick={() => void handleInstall()}
              disabled={prompting}
              whileTap={reduceMotion ? undefined : pressTap}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold tracking-wide transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                flyoutOnDark
                  ? "bg-[#31CDFF]/18 text-[#31CDFF] hover:bg-[#31CDFF]/28 focus-visible:ring-[#31CDFF]/40 focus-visible:ring-offset-[#272156]"
                  : "bg-[#272156] text-white hover:bg-[#272156]/90 focus-visible:ring-primary/40 focus-visible:ring-offset-background",
                prompting && "opacity-80"
              )}
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {prompting ? "Opening…" : "Download"}
            </motion.button>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  if (showIosHint) {
    const tipLabel = `Install ${APP_NAME}: tap Share, then Add to Home Screen`;
    const tipSurface =
      tone === "on-dark"
        ? "border-white/10 bg-white/[0.05] text-white/75 backdrop-blur-sm"
        : tone === "subtle"
          ? "border-border/60 bg-muted/40 text-muted-foreground"
          : "border-primary/15 bg-primary/[0.06] text-muted-foreground";
    const tipIconWrap =
      tone === "on-dark" ? "bg-white/10 text-white/80" : "bg-primary/10 text-primary";
    const tipIcon =
      tone === "on-dark" ? "text-white/80" : "text-primary";
    const nameClass =
      tone === "on-dark" ? "font-semibold text-white" : "font-semibold text-foreground/90";

    const tipBody = compact ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            key="ios-pwa-tip-compact"
            initial={enterInitial}
            animate={enterAnimate}
            transition={enterTransition}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border",
              tipSurface,
              className
            )}
            role="note"
            aria-label={tipLabel}
          >
            <Share className={cn("h-4 w-4", tipIcon)} aria-hidden />
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="right">Share → Add to Home Screen</TooltipContent>
      </Tooltip>
    ) : (
      <motion.div
        key="ios-pwa-tip"
        initial={enterInitial}
        animate={enterAnimate}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={enterTransition}
        className={cn("rounded-xl border px-3 py-2.5 text-left", tipSurface, className)}
        role="note"
      >
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              tipIconWrap
            )}
          >
            <Share className="h-3.5 w-3.5" aria-hidden />
          </span>
          <p className="text-[11px] leading-snug tracking-wide">
            Install <span className={nameClass}>{APP_NAME}</span>: tap Share, then
            Add to Home Screen.
          </p>
        </div>
      </motion.div>
    );

    return <AnimatePresence>{tipBody}</AnimatePresence>;
  }

  const button = (
    <motion.button
      type="button"
      onClick={handleInstall}
      disabled={prompting}
      aria-label={`Install ${APP_NAME}`}
      initial={enterInitial}
      animate={enterAnimate}
      transition={enterTransition}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      className={cn(
        "group relative flex w-full items-center justify-center overflow-hidden rounded-xl border transition-[filter,background-color] duration-150 ease-out will-change-transform",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        tone === "on-dark"
          ? "focus-visible:ring-white/40 focus-visible:ring-offset-[#272156]"
          : "focus-visible:ring-primary/40 focus-visible:ring-offset-background",
        compact ? "h-11 w-11 p-0" : "gap-2.5 px-3 py-2.5",
        surfaceClass,
        prompting && "opacity-80",
        className
      )}
      style={brandStyle}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />
      <Image
        src={ICON_SRC}
        alt=""
        width={compact ? 22 : 20}
        height={compact ? 22 : 20}
        className="relative z-[1] shrink-0 rounded-md"
        unoptimized
      />
      {!compact && (
        <span className="relative z-[1] min-w-0 text-left">
          <span className="block text-[10px] font-medium uppercase tracking-[0.08em] opacity-70">
            Install
          </span>
          <span className="block truncate text-[12px] font-semibold leading-tight tracking-wide">
            {APP_NAME}
          </span>
        </span>
      )}
    </motion.button>
  );

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">Install {APP_NAME}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
