"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { getFeatureRelease } from "@/lib/feature-releases";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { notFound } from "next/navigation";
import { publicAdminHref } from "@/lib/admin-path";

export default function AiApplicantRankingReleasePage() {
  const release = getFeatureRelease("ai-applicant-ranking");
  if (!release) notFound();

  return (
    <AdminPageLayout title={release.title} showSearch={false}>
      <div className="mx-auto max-w-5xl space-y-10 pb-10">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={publicAdminHref("/manage/releases")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            All feature releases
          </Link>
        </Button>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`overflow-hidden rounded-3xl bg-gradient-to-br ${release.heroAccent} p-8 text-white shadow-xl shadow-violet-500/20 md:p-12`}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Feature Release · {release.date}
          </div>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-4xl">
            {release.title}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-white/90">{release.tagline}</p>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/80">
            {release.summary}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-violet-700 hover:bg-white/90">
              <Link href={publicAdminHref("/manage/candidates")}>
                Try on Applications
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href={publicAdminHref("/manage/whats-new")}>Changelog</Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-white/70">BQI Intelligence</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-bold">92</span>
                <span className="pb-1 text-sm text-white/70">/100</span>
              </div>
              <p className="mt-1 text-sm text-emerald-200">Strong Fit</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-white/70">BQI Intelligence assessment</p>
              <p className="mt-2 text-sm font-medium text-violet-100">vs Full Stack Engineer</p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                Strong match on React, Python, and REST API experience aligned to position requirements.
              </p>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-2">
          {release.highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.06 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-4 inline-flex rounded-xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h2 className="text-xl font-semibold text-foreground">How to use it</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Four steps to start ranking candidates with BQI Intelligence
          </p>
          <ol className="mt-6 space-y-4">
            {release.steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6 dark:border-violet-900 dark:bg-violet-950/20 md:p-8">
          <h2 className="text-xl font-semibold text-foreground">What&apos;s included</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {release.capabilities.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center md:p-10">
          <h2 className="text-xl font-semibold text-foreground">Ready to rank your pipeline?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Open Applications, click Score with BQI Intelligence, or rank individual
            candidates with the sparkle icon or BQI Intelligence button in the score column.
          </p>
          <Button asChild className="mt-6 bg-violet-600 hover:bg-violet-700">
            <Link href={publicAdminHref("/manage/candidates")}>
              Go to Applications
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </AdminPageLayout>
  );
}
