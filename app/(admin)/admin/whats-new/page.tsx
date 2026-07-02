"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { Sparkles, Rocket, ArrowRight } from "lucide-react";
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-8 text-center dark:border-violet-900 dark:from-violet-950/40 dark:via-slate-950 dark:to-blue-950/30"
        >
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-violet-100 p-3 dark:bg-violet-900/40">
            <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-300" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            Latest Updates & Improvements
          </h1>
          <p className="mx-auto mb-6 max-w-2xl text-gray-600 dark:text-slate-300">
            AI applicant ranking helps you prioritize candidates faster with scores,
            role-specific assessments, and inline status updates.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="bg-violet-600 hover:bg-violet-700">
              <Link href="/admin/releases/ai-applicant-ranking">
                Read feature release
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/releases">All releases</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/applications">Open Applications</Link>
            </Button>
          </div>
        </motion.div>

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
          className="mt-12 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 p-6 text-center dark:from-purple-950/30 dark:to-blue-950/30"
        >
          <Rocket className="mx-auto mb-4 h-8 w-8 text-purple-500" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            More Updates Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-slate-300">
            We&apos;re continuously improving your hiring workflow.
          </p>
        </motion.div>
      </div>
    </AdminPageLayout>
  );
}
