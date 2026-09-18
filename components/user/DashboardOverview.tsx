"use client";

/**
 * Lightweight stats strip kept for legacy imports.
 * Primary dashboard UI lives in /dashboard/overview and /dashboard.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Briefcase, CheckCircle, Calendar, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const BRAND_NAVY = "#272156";
const BRAND_CYAN = "#31CDFF";
const SPRING_ENTER = { type: "spring" as const, bounce: 0, duration: 0.4 };

type OverviewItem = {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
};

const overviewItems: OverviewItem[] = [
  { title: "Applications", value: 0, icon: Briefcase },
  { title: "Shortlisted", value: 0, icon: CheckCircle },
  { title: "Interview", value: 0, icon: Calendar },
  { title: "Closed", value: 0, icon: XCircle },
];

export default function DashboardOverview() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 sm:gap-4">
      {overviewItems.map((item, index) => (
        <motion.div
          key={item.title}
          className={cn(
            "rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm",
            "backdrop-blur-sm sm:p-5"
          )}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : { ...SPRING_ENTER, delay: index * 0.05 }
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {item.title}
              </p>
              <h3
                className="mt-1 text-2xl font-semibold tabular-nums tracking-tight"
                style={{ color: BRAND_NAVY }}
              >
                {item.value}
              </h3>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${BRAND_CYAN}, ${BRAND_NAVY})`,
              }}
            >
              <item.icon className="h-5 w-5 text-white" aria-hidden />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
