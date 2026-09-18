"use client";

import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Transition,
} from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  FileText,
  IdCard,
  ShieldCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { useCallback, type PointerEvent } from "react";
import {
  APP_VERSION_LABEL,
  APP_VERSION_TITLE,
} from "@/components/admin/AdminBrandTitle";
import { criticallyDampedSpring } from "@/components/auth/portal-auth-styles";
import { cn } from "@/lib/utils";

/** User portal cover — modern office atmosphere (distinct from admin). */
export const PORTAL_COVER_SRC = "/images/portal-user-login-cover.jpg";
/** Admin console cover — graded under navy/cyan materials. */
export const ADMIN_COVER_SRC = "/images/admin-login-cover.png";

const LOGO_SRC = "/bqilogo-light.png";

const DEFAULT_PORTAL_SUBTITLE =
  "Sign in to view your applications, manage your profile, and access your BQI Tech account.";

const ADMIN_HEADLINE = "Your organization, under one secure console.";
const ADMIN_SUBTITLE =
  "Manage teams, hiring, and operations from one admin workspace.";

const EMPLOYEE_HEADLINE = "Your work life, in one place.";
const EMPLOYEE_SUBTITLE =
  "Check your profile, leave balances, and documents from the BQI employee portal.";

const ADMIN_FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: ShieldCheck, text: "Role-based, secure admin access" },
  { icon: BarChart3, text: "Live hiring and team insights" },
  { icon: Users2, text: "Built for the whole BQI organization" },
];

const EMPLOYEE_FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: IdCard, text: "Your HR profile, always current" },
  { icon: CalendarDays, text: "Leave balances and request history" },
  { icon: FileText, text: "Personal documents in one vault" },
];

type PortalBrandPanelProps = {
  variant?: "portal" | "admin" | "employee";
  subtitle?: string;
  footerLabel?: string;
  coverSrc?: string;
  className?: string;
};

function fadeUpMotion(
  reduceMotion: boolean | null,
  delay: number,
  spring: Transition = criticallyDampedSpring
) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.35, delay },
    };
  }
  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { ...spring, delay },
  };
}

function FeatureRow({
  icon: Icon,
  text,
  delay,
  reduceMotion,
}: {
  icon: LucideIcon;
  text: string;
  delay: number;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.li
      {...fadeUpMotion(reduceMotion, delay)}
      className="group flex items-center gap-3.5"
      whileHover={
        reduceMotion
          ? undefined
          : {
              x: 2,
              transition: { type: "spring", bounce: 0, duration: 0.28 },
            }
      }
    >
      <span
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
          "bg-white/[0.12] text-[#31CDFF]",
          "ring-1 ring-inset ring-white/25",
          "shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.28)]",
          "backdrop-blur-xl backdrop-saturate-150",
          "transition-[transform,box-shadow,background-color] duration-200 ease-out",
          "group-hover:bg-white/[0.18] group-hover:shadow-[0_0_0_1px_rgba(49,205,255,0.35),0_10px_28px_-10px_rgba(49,205,255,0.45)]",
          "group-active:scale-[0.96]",
          "motion-reduce:backdrop-blur-none motion-reduce:bg-white/20"
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="text-[15px] leading-snug tracking-[-0.01em] text-white/85 transition-colors duration-200 group-hover:text-white">
        {text}
      </span>
    </motion.li>
  );
}

export function PortalBrandPanel({
  variant = "portal",
  subtitle,
  footerLabel,
  coverSrc,
  className,
}: PortalBrandPanelProps) {
  const reduceMotion = useReducedMotion();
  const isAdmin = variant === "admin";
  const isEmployee = variant === "employee";
  const isSplitBrand = isAdmin || isEmployee;

  const resolvedCover =
    coverSrc ??
    (isSplitBrand ? ADMIN_COVER_SRC : PORTAL_COVER_SRC);
  const resolvedSubtitle =
    subtitle ??
    (isEmployee
      ? EMPLOYEE_SUBTITLE
      : isAdmin
        ? ADMIN_SUBTITLE
        : DEFAULT_PORTAL_SUBTITLE);
  const resolvedFooter =
    footerLabel ??
    (isEmployee ? "Employee Portal" : isAdmin ? "Admin Console" : "Secure Login");
  const headline = isEmployee ? EMPLOYEE_HEADLINE : ADMIN_HEADLINE;
  const features = isEmployee ? EMPLOYEE_FEATURES : ADMIN_FEATURES;
  const ariaLabel = isEmployee
    ? "BQI Employee Portal"
    : isAdmin
      ? "BQI Admin Console"
      : "BQI Tech Portal";

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const springX = useSpring(pointerX, { stiffness: 80, damping: 28, mass: 0.6 });
  const springY = useSpring(pointerY, { stiffness: 80, damping: 28, mass: 0.6 });
  const parallaxX = useTransform(springX, [0, 1], [14, -14]);
  const parallaxY = useTransform(springY, [0, 1], [10, -10]);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (reduceMotion || !isSplitBrand) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerX.set((event.clientX - rect.left) / rect.width);
      pointerY.set((event.clientY - rect.top) / rect.height);
    },
    [isSplitBrand, pointerX, pointerY, reduceMotion]
  );

  const onPointerLeave = useCallback(() => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }, [pointerX, pointerY]);

  return (
    <aside
      className={cn(
        "relative hidden min-h-[100dvh] overflow-hidden bg-[#272156] p-12 text-white lg:flex lg:flex-col xl:p-16",
        className
      )}
      aria-label={ariaLabel}
      onPointerMove={isSplitBrand ? onPointerMove : undefined}
      onPointerLeave={isSplitBrand ? onPointerLeave : undefined}
    >
      {isSplitBrand && !reduceMotion ? (
        <motion.img
          src={resolvedCover}
          alt=""
          loading="eager"
          decoding="async"
          className="pointer-events-none absolute inset-[-3%] h-[106%] w-[106%] max-w-none object-cover will-change-transform"
          style={{ x: parallaxX, y: parallaxY, scale: 1.06 }}
        />
      ) : (
        <img
          src={resolvedCover}
          alt=""
          loading="eager"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Navy readability stack */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isSplitBrand
            ? "linear-gradient(165deg, rgba(39,33,86,0.92) 0%, rgba(39,33,86,0.72) 38%, rgba(15,12,40,0.94) 100%)"
            : "linear-gradient(165deg, rgba(39,33,86,0.88) 0%, rgba(39,33,86,0.62) 42%, rgba(15,12,40,0.92) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isSplitBrand
            ? "radial-gradient(90% 70% at 0% 0%, rgba(49,205,255,0.34), transparent 58%), radial-gradient(70% 55% at 100% 100%, rgba(49,205,255,0.12), transparent 55%)"
            : "radial-gradient(85% 70% at 0% 0%, rgba(49,205,255,0.28), transparent 55%)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col justify-between gap-12">
        <motion.div {...fadeUpMotion(reduceMotion, 0)}>
          <div
            className={cn(
              "inline-flex items-center rounded-2xl px-5 py-4",
              "bg-white/10 ring-1 ring-inset ring-white/20",
              "shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.22)]",
              "backdrop-blur-xl backdrop-saturate-150",
              "motion-reduce:backdrop-blur-none motion-reduce:bg-white/20"
            )}
          >
            <Image
              src={LOGO_SRC}
              alt="BQI Tech"
              width={isSplitBrand ? 200 : 220}
              height={isSplitBrand ? 60 : 66}
              priority
              className={cn(
                "w-auto object-contain",
                isSplitBrand ? "h-14 xl:h-16" : "h-16 xl:h-[4.5rem]"
              )}
            />
          </div>
        </motion.div>

        {isSplitBrand ? (
          <div className="max-w-md space-y-4">
            <motion.h1
              {...fadeUpMotion(reduceMotion, 0.07)}
              className="text-4xl font-semibold leading-[1.12] tracking-[-0.03em] xl:text-[2.75rem]"
            >
              {headline}
            </motion.h1>
            <motion.p
              {...fadeUpMotion(reduceMotion, 0.13)}
              className="text-lg leading-relaxed tracking-[-0.01em] text-white/78"
            >
              {resolvedSubtitle}
            </motion.p>
          </div>
        ) : (
          <motion.div {...fadeUpMotion(reduceMotion, 0.08)} className="max-w-md space-y-4">
            <h2 className="text-4xl font-semibold leading-[1.15] tracking-[-0.025em] xl:text-[2.75rem]">
              BQI Tech Portal
            </h2>
            <p className="text-lg leading-relaxed text-white/80">{resolvedSubtitle}</p>
          </motion.div>
        )}

        {isSplitBrand ? (
          <div className="space-y-8">
            <ul className="space-y-4">
              {features.map((feature, index) => (
                <FeatureRow
                  key={feature.text}
                  icon={feature.icon}
                  text={feature.text}
                  delay={0.2 + index * 0.07}
                  reduceMotion={reduceMotion}
                />
              ))}
            </ul>
            <motion.div
              {...fadeUpMotion(reduceMotion, 0.42)}
              className="flex items-center gap-3 text-sm tracking-wide text-white/55"
            >
              <span title={APP_VERSION_TITLE} aria-label={APP_VERSION_TITLE}>
                {APP_VERSION_LABEL}
              </span>
              <span aria-hidden className="text-white/35">
                ·
              </span>
              <span>{resolvedFooter}</span>
            </motion.div>
          </div>
        ) : (
          <motion.div
            {...fadeUpMotion(reduceMotion, 0.14)}
            className="flex items-center gap-3 text-sm tracking-wide text-white/65"
          >
            <span title={APP_VERSION_TITLE} aria-label={APP_VERSION_TITLE}>
              {APP_VERSION_LABEL}
            </span>
            <span aria-hidden className="text-white/40">
              ·
            </span>
            <span>{resolvedFooter}</span>
          </motion.div>
        )}
      </div>
    </aside>
  );
}
