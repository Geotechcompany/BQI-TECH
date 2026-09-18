"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WHATS_NEW_FLOAT_ENABLED,
  WHATS_NEW_FLOAT_FEATURES,
  WHATS_NEW_STORAGE_KEY,
} from "@/lib/admin-whats-new";
import { publicAdminHref } from "@/lib/admin-path";

export function WhatsNewFloat() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!WHATS_NEW_FLOAT_ENABLED) return;
    try {
      const dismissed = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
      if (!dismissed) {
        const timer = window.setTimeout(() => setOpen(true), 600);
        return () => window.clearTimeout(timer);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  if (!WHATS_NEW_FLOAT_ENABLED) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(WHATS_NEW_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Dismiss what's new backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-slate-950/20 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none md:pointer-events-none"
            onClick={dismiss}
          />

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-4 right-4 left-4 z-[9999] md:left-auto md:w-[380px]"
          >
            <div className="overflow-hidden rounded-2xl border border-violet-200/70 bg-white shadow-2xl shadow-violet-500/15 dark:border-violet-800/50 dark:bg-slate-950">
              <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 px-5 py-5 text-white">
                <motion.div
                  className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-blue-300/20"
                  animate={{ scale: [1.1, 0.95, 1.1] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                />

                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                      <Sparkles className="h-3.5 w-3.5" />
                      June 2026 release
                    </div>
                    <h2 className="text-lg font-bold leading-tight">What&apos;s New</h2>
                    <p className="mt-1 text-sm text-white/85">
                      AI-powered applicant ranking is here
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                    onClick={dismiss}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative mt-4 grid grid-cols-2 gap-2">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="rounded-xl bg-white/10 p-3 backdrop-blur-sm"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-white/70">BQI Intelligence</p>
                    <p className="mt-1 text-2xl font-bold">92<span className="text-sm font-medium text-white/70">/100</span></p>
                    <p className="mt-1 text-xs text-emerald-200">Strong Fit</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.22 }}
                    className="rounded-xl bg-white/10 p-3 backdrop-blur-sm"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-white/70">Assessment</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/90 line-clamp-3">
                      vs Full Stack Engineer — strong match on React, Python, and REST APIs.
                    </p>
                  </motion.div>
                </div>
              </div>

              <div className="space-y-2 p-4">
                {WHATS_NEW_FLOAT_FEATURES.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.08 }}
                      className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${feature.accent} text-white shadow-sm`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <Button size="sm" variant="ghost" asChild>
                  <Link href={publicAdminHref("/manage/releases/ai-applicant-ranking")}onClick={dismiss}>
                    Full release
                  </Link>
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={publicAdminHref("/manage/candidates")}onClick={dismiss}>
                      Try it
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button size="sm" onClick={dismiss}>
                    Got it
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default WhatsNewFloat;
