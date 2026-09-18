"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { FEATURE_RELEASES } from "@/lib/feature-releases";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicAdminHref } from "@/lib/admin-path";

export default function FeatureReleasesPage() {
  return (
    <AdminPageLayout title="Feature Releases" showSearch={false}>
      <div className="mx-auto max-w-5xl space-y-8">
        <AdminPageWelcomeBanner
          bannerKey="releases"
          actions={
            <Button
              asChild
              variant="secondary"
              className="bg-white text-[#272055] hover:bg-white/90"
            >
              <Link href={publicAdminHref("/manage/whats-new")}>View changelog</Link>
            </Button>
          }
        />

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
                  <Link href={publicAdminHref(`/manage/releases/${release.slug}`)}>
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
