"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WHATS_NEW_PAGE_RELEASES, type WhatsNewRelease } from "@/lib/admin-whats-new";

const categoryColors: Record<
  WhatsNewRelease["category"],
  { bg: string; text: string; badge: string }
> = {
  "New Feature": {
    bg: "bg-purple-500",
    text: "text-purple-500",
    badge: "text-purple-700",
  },
  Improvement: {
    bg: "bg-blue-500",
    text: "text-blue-500",
    badge: "text-blue-700",
  },
  Security: {
    bg: "bg-green-500",
    text: "text-green-500",
    badge: "text-green-700",
  },
  Performance: {
    bg: "bg-orange-500",
    text: "text-orange-500",
    badge: "text-orange-700",
  },
};

export default function WhatsNewPage() {
  return (
    <AdminPageLayout title="What's New" showSearch={false}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <AdminPageWelcomeBanner
            bannerKey="whats-new"
            actions={
              <>
                <Button
                  asChild
                  variant="secondary"
                  className="bg-white text-[#272055] hover:bg-white/90"
                >
                  <Link href="/manage/releases/ai-applicant-ranking">
                    Read feature release
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <Link href="/manage/releases">All releases</Link>
                </Button>
              </>
            }
          />
        </div>

        <div className="space-y-6">
          {WHATS_NEW_PAGE_RELEASES.map((update, index) => {
            const Icon = update.icon;
            const colors = categoryColors[update.category];

            return (
              <motion.div
                key={`${update.title}-${update.date}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06 }}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-xl bg-opacity-10 p-3 ${colors.bg}`}>
                      <Icon className={`h-6 w-6 ${colors.text}`} />
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {update.title}
                        </h3>
                        <span className="whitespace-nowrap text-sm text-gray-500">
                          {update.date}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-slate-300">{update.description}</p>
                      <div className="mt-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${colors.bg} bg-opacity-10 ${colors.badge}`}
                        >
                          {update.category}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 rounded-xl border border-border bg-card p-6 text-center"
        >
          <Rocket className="mx-auto mb-4 h-8 w-8 text-[#272055]" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            More updates ship here
          </h2>
          <p className="text-muted-foreground">
            Smaller fixes and feature notes land on this changelog as they go live.
          </p>
        </motion.div>
      </div>
    </AdminPageLayout>
  );
}
