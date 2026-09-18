"use client";

import * as React from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  content: React.ReactNode;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface DynamicActionBarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  actions: ActionItem[];
}

const DynamicActionBar = React.forwardRef<
  HTMLDivElement,
  DynamicActionBarProps
>(({ actions, className, ...props }, ref) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeAction = activeIndex !== null ? actions[activeIndex] : null;

  const BUTTON_BAR_HEIGHT = 56;

  const containerAnimate = activeAction
    ? {
        width: activeAction.dimensions.width,
        height: activeAction.dimensions.height + BUTTON_BAR_HEIGHT,
      }
    : {
        width: 410,
        height: BUTTON_BAR_HEIGHT,
      };

  const transition = { type: "spring" as const, stiffness: 400, damping: 35 };

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onMouseLeave={() => setActiveIndex(null)}
      {...props}
    >
      <motion.div
        className={cn(
          "flex flex-col overflow-hidden rounded-2xl",
          "border border-white/65 bg-white/55",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_36px_rgba(39,33,86,0.12),0_2px_8px_rgba(39,33,86,0.06)]",
          "backdrop-blur-[28px] backdrop-saturate-150",
          "supports-[backdrop-filter]:bg-[rgba(255,255,255,0.48)]",
          "[@media(prefers-reduced-transparency:reduce)]:bg-white/95",
          "[@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
          "[@media(prefers-reduced-transparency:reduce)]:backdrop-saturate-100",
          "[@media(prefers-reduced-transparency:reduce)]:border-[#272156]/12",
          "dark:border-white/20 dark:bg-white/[0.12]",
          "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_40px_rgba(0,0,0,0.4)]",
          "dark:supports-[backdrop-filter]:bg-[rgba(22,20,31,0.55)]",
          "dark:[@media(prefers-reduced-transparency:reduce)]:bg-[#16141f]/95",
          "dark:[@media(prefers-reduced-transparency:reduce)]:border-white/15"
        )}
        animate={containerAnimate}
        transition={transition}
        initial={{ width: 410, height: BUTTON_BAR_HEIGHT }}
      >
        <div className="flex-grow overflow-hidden">
          <AnimatePresence>
            {activeAction && (
              <motion.div
                className="w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                {activeAction.content}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className="flex flex-shrink-0 items-center justify-center gap-2 px-2"
          style={{ height: `${BUTTON_BAR_HEIGHT}px` }}
        >
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[#272156] transition-colors duration-300 hover:bg-[#272156] hover:text-white dark:text-[#e8f7ff] dark:hover:bg-[#31CDFF]/20 dark:hover:text-white"
              >
                <Icon className="size-6" />
                <span className="font-bold">{action.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
});

DynamicActionBar.displayName = "DynamicActionBar";

export { DynamicActionBar };
export default DynamicActionBar;
