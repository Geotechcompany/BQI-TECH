"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";
import { AlertTriangle, Info, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AppleToastVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "loading"
  | "default";

export type AppleToastAction = {
  label: ReactNode;
  onClick: () => void;
};

/** Extra fields accepted by react-hot-toast via option spread (runtime). */
export type AppleHotToastExtras = {
  action?: AppleToastAction;
  cancel?: AppleToastAction;
  actions?: AppleToastAction[];
  description?: ReactNode;
};

const SURFACE =
  "bg-[#f7f7f8]/[0.96] border border-black/[0.08] shadow-[0_10px_32px_-10px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.04)] backdrop-blur-xl";

export const appleToastSpring: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.36,
};

export const appleToastReduced: Transition = {
  duration: 0.18,
  ease: [0.32, 0.72, 0, 1],
};

const accentByVariant: Record<
  AppleToastVariant,
  { ring: string; icon: string; iconBg: string }
> = {
  success: {
    ring: "border-emerald-500/45",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-500/[0.08]",
  },
  error: {
    ring: "border-rose-500/45",
    icon: "text-rose-600",
    iconBg: "bg-rose-500/[0.08]",
  },
  warning: {
    ring: "border-amber-500/45",
    icon: "text-amber-600",
    iconBg: "bg-amber-500/[0.08]",
  },
  info: {
    ring: "border-cyan-500/45",
    icon: "text-cyan-600",
    iconBg: "bg-cyan-500/[0.08]",
  },
  loading: {
    ring: "border-black/15",
    icon: "text-black/45",
    iconBg: "bg-black/[0.04]",
  },
  default: {
    ring: "border-cyan-500/40",
    icon: "text-cyan-600",
    iconBg: "bg-cyan-500/[0.08]",
  },
};

function SuccessCheck({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className="h-[14px] w-[14px] text-emerald-600"
      fill="none"
      aria-hidden
      initial={reducedMotion ? false : { opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
    >
      <motion.path
        d="M5.5 12.5 10 17l8.5-9"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reducedMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: reducedMotion ? 0 : 0.32,
          ease: [0.32, 0.72, 0, 1],
          delay: reducedMotion ? 0 : 0.06,
        }}
      />
    </motion.svg>
  );
}

export function AppleToastStatusIcon({
  variant,
}: {
  variant: AppleToastVariant;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const accent = accentByVariant[variant];

  return (
    <span
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px]",
        accent.ring,
        accent.iconBg
      )}
      aria-hidden
    >
      {variant === "success" ? (
        <SuccessCheck reducedMotion={reducedMotion} />
      ) : variant === "error" ? (
        <span className={cn("text-sm font-semibold leading-none", accent.icon)}>
          !
        </span>
      ) : variant === "warning" ? (
        <AlertTriangle className={cn("h-3.5 w-3.5", accent.icon)} strokeWidth={2.25} />
      ) : variant === "loading" ? (
        <Loader2 className={cn("h-3.5 w-3.5 animate-spin", accent.icon)} />
      ) : (
        <Info className={cn("h-3.5 w-3.5", accent.icon)} strokeWidth={2.25} />
      )}
    </span>
  );
}

export type AppleToastCardProps = {
  variant?: AppleToastVariant;
  title: ReactNode;
  description?: ReactNode;
  actions?: AppleToastAction[];
  onDismiss?: () => void;
  className?: string;
  icon?: ReactNode;
  visible?: boolean;
  animateEntrance?: boolean;
};

export function resolveAppleToastActions(
  extras: AppleHotToastExtras | null | undefined
): AppleToastAction[] {
  if (!extras) return [];
  if (extras.actions?.length) return extras.actions;
  const list: AppleToastAction[] = [];
  if (extras.action) list.push(extras.action);
  if (extras.cancel) list.push(extras.cancel);
  return list;
}

export function AppleToastCard({
  variant = "default",
  title,
  description,
  actions,
  onDismiss,
  className,
  icon,
  visible = true,
  animateEntrance = true,
}: AppleToastCardProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const transition = reducedMotion ? appleToastReduced : appleToastSpring;

  const body = (
    <div
      className={cn(
        "pointer-events-auto relative flex w-[min(100vw-2rem,360px)] gap-3 rounded-[14px] px-3.5 py-3.5 text-left",
        SURFACE,
        className
      )}
      role="status"
    >
      <div className="pt-0.5">
        {icon ?? <AppleToastStatusIcon variant={variant} />}
      </div>

      <div className="min-w-0 flex-1 pr-5">
        <div className="text-[13.5px] font-semibold leading-snug tracking-[-0.01em] text-neutral-900">
          {title}
        </div>
        {description ? (
          <div className="mt-0.5 text-[12.5px] leading-snug text-neutral-500">
            {description}
          </div>
        ) : null}

        {actions && actions.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1">
            {actions.map((action, index) => (
              <button
                key={index}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick();
                }}
                className={cn(
                  "text-[12.5px] font-medium transition-opacity duration-150 hover:opacity-80 active:opacity-60",
                  index === 0
                    ? "text-cyan-700"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-[color,background-color,transform] duration-150 hover:bg-black/[0.05] hover:text-neutral-700 active:scale-[0.94]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );

  if (!animateEntrance) {
    return body;
  }

  return (
    <motion.div
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 28 }
      }
      animate={
        visible
          ? reducedMotion
            ? { opacity: 1 }
            : { opacity: 1, x: 0 }
          : reducedMotion
            ? { opacity: 0 }
            : { opacity: 0, x: 28 }
      }
      transition={transition}
      style={{ willChange: "transform, opacity" }}
    >
      {body}
    </motion.div>
  );
}
