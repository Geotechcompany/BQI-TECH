"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ListChecks,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getLatestFeatureRelease,
  type FeatureRelease,
  type FeatureReleaseItem,
} from "@/lib/feature-releases";
import {
  FEATURE_PREVIEW_DIALOG_ENABLED,
  getSeenFeatureRelease,
  markFeatureReleaseSeen,
} from "@/lib/admin-whats-new";

interface BuildFeatureListArgs {
  release: FeatureRelease;
}

function buildFeatureList({ release }: BuildFeatureListArgs): FeatureReleaseItem[] {
  if (release.features?.length) return release.features;
  return release.highlights.map((highlight) => ({
    title: highlight.title,
    description: highlight.description,
    icon: highlight.icon,
    howToTest: [],
  }));
}

const slideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -28 : 28 }),
};

export function FeaturePreviewDialog() {
  const release = useMemo(
    () => (FEATURE_PREVIEW_DIALOG_ENABLED ? getLatestFeatureRelease() : undefined),
    [],
  );
  const features = useMemo(
    () => (release ? buildFeatureList({ release }) : []),
    [release],
  );
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (!FEATURE_PREVIEW_DIALOG_ENABLED || !release) return;
    if (getSeenFeatureRelease() === release.slug) return;
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [release]);

  const acknowledge = useCallback(() => {
    if (release) markFeatureReleaseSeen(release.slug);
    setOpen(false);
  }, [release]);

  const goTo = useCallback(
    (next: number) => {
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index],
  );

  const total = features.length;
  const isLast = index === total - 1;
  const isFirst = index === 0;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowRight" && !isLast) {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === "ArrowLeft" && !isFirst) {
        event.preventDefault();
        goTo(index - 1);
      }
    },
    [goTo, index, isFirst, isLast],
  );

  if (!release || total === 0) return null;

  const feature = features[index];
  const Icon = feature.icon;
  const ctaHref = feature.href ?? release.ctaHref ?? `/manage/releases/${release.slug}`;
  const ctaLabel = feature.ctaLabel ?? release.ctaLabel ?? "Try it now";
  const badgeLabel =
    total > 1 ? `${total} new features` : `New in v${release.version}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) acknowledge();
      }}
    >
      <DialogContent
        onKeyDown={handleKeyDown}
        className="overflow-hidden p-0 sm:max-w-3xl"
      >
        <div
          className={`relative bg-gradient-to-br ${release.heroAccent} px-6 py-5 text-primary-foreground`}
        >
          <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-foreground/10 blur-2xl" />
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {badgeLabel}
          </div>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-xl font-bold text-primary-foreground">
              {release.title}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/85">
              {release.tagline}
            </DialogDescription>
          </DialogHeader>
        </div>

        {total > 1 && (
          <div className="flex items-center justify-between px-6 pt-4">
            <div
              role="tablist"
              aria-label="Feature preview steps"
              className="flex items-center gap-1.5"
            >
              {features.map((item, dotIndex) => {
                const isActive = dotIndex === index;
                return (
                  <button
                    key={item.title}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Go to ${item.title}`}
                    onClick={() => goTo(dotIndex)}
                    className={`h-1.5 rounded-full transition-all ${
                      isActive
                        ? "w-6 bg-primary"
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                );
              })}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {index + 1} of {total}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={feature.title}
            custom={direction}
            variants={reduceMotion ? undefined : slideVariants}
            initial={reduceMotion ? false : "enter"}
            animate={reduceMotion ? undefined : "center"}
            exit={reduceMotion ? undefined : "exit"}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-0 px-6 pb-2 pt-4 md:grid-cols-[0.8fr_1fr] md:gap-6 md:px-6"
          >
            <div className="relative mb-4 h-36 overflow-hidden rounded-xl border border-border bg-accent md:mb-0 md:h-auto md:min-h-[12rem]">
              {feature.imageUrl ? (
                <img
                  src={feature.imageUrl}
                  alt={feature.imageAlt ?? feature.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/60" />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/25 via-transparent to-transparent" />
            </div>

            <div className="min-w-0 space-y-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>

              {feature.highlights?.length ? (
                <div className="flex flex-wrap gap-2">
                  {feature.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      <Sparkles className="h-3 w-3" />
                      {highlight}
                    </span>
                  ))}
                </div>
              ) : null}

              {feature.howToTest.length ? (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ListChecks className="h-4 w-4 text-primary" />
                    How to try it
                  </div>
                  <ol className="space-y-2.5">
                    {feature.howToTest.map((step, stepIndex) => (
                      <li key={step} className="flex gap-3">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                          {stepIndex + 1}
                        </span>
                        <span className="text-sm leading-relaxed text-muted-foreground">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
          <div>
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goTo(index - 1)}
                aria-label="Previous feature"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" asChild>
              <Link href={ctaHref} onClick={acknowledge}>
                {ctaLabel}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            {isLast ? (
              <Button variant="outline" size="sm" onClick={acknowledge}>
                Done
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => goTo(index + 1)}
                aria-label="Next feature"
              >
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FeaturePreviewDialog;
