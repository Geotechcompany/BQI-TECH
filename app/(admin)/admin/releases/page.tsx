"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { FEATURE_RELEASES } from "@/lib/feature-releases";
import { ArrowRight, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FeatureReleasesPage() {
  return (
    <AdminPageLayout title="Feature Releases" showSearch={false}>
      <div className="mx-auto max-w-5xl space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-8 dark:border-violet-900 dark:from-violet-950/30 dark:via-slate-950 dark:to-blue-950/20"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
                <Rocket className="h-3.5 w-3.5" />
                Product releases
              </div>
              <h1 className="text-3xl font-bold text-foreground">Feature Releases</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Deep dives into major platform capabilities. Each release explains what
                shipped, why it matters, and how to use it in your hiring workflow.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/whats-new">View changelog</Link>
            </Button>
          </div>
        </motion.div>

        <div className="grid gap-6">
          {FEATURE_RELEASES.map((release, index) => (
            <motion.article
              key={release.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md"
            >
              <div className={`bg-gradient-to-r ${release.heroAccent} px-6 py-5 text-white`}>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
                  <span>{release.date}</span>
                  <span>•</span>
                  <span>{release.category}</span>
                  <span>•</span>
                  <span>v{release.version}</span>
                </div>
                <h2 className="mt-2 text-2xl font-bold">{release.title}</h2>
                <p className="mt-1 text-white/90">{release.tagline}</p>
              </div>

              <div className="space-y-4 p-6">
                <p className="text-muted-foreground leading-relaxed">{release.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {release.highlights.slice(0, 3).map((item) => (
                    <span
                      key={item.title}
                      className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
                    >
                      <Sparkles className="h-3 w-3" />
                      {item.title}
                    </span>
                  ))}
                </div>
                <Button asChild className="bg-violet-600 hover:bg-violet-700">
                  <Link href={`/admin/releases/${release.slug}`}>
                    Read release
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </AdminPageLayout>
  );
}
