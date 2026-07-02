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
  ListChecks,
  Sparkles,
} from "lucide-react";
import { notFound } from "next/navigation";

export default function HiringWorkflowRefinementsReleasePage() {
  const release = getFeatureRelease("hiring-workflow-refinements");
  if (!release) notFound();

  const features = release.features ?? [];

  return (
    <AdminPageLayout title={release.title} showSearch={false}>
      <div className="mx-auto max-w-5xl space-y-10 pb-10">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/admin/releases">
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
            {release.ctaHref ? (
              <Button asChild size="lg" className="bg-white text-violet-700 hover:bg-white/90">
                <Link href={release.ctaHref}>
                  {release.ctaLabel ?? "Open"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/admin/whats-new">Changelog</Link>
            </Button>
          </div>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.06 }}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-4 inline-flex w-fit rounded-xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>

                {feature.howToTest.length ? (
                  <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ListChecks className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      How to try it
                    </div>
                    <ol className="space-y-2.5">
                      {feature.howToTest.map((step, stepIndex) => (
                        <li key={step} className="flex gap-3">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
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

                {feature.href ? (
                  <div className="mt-4 pt-1">
                    <Button asChild variant="ghost" size="sm" className="-ml-2 text-violet-700 hover:text-violet-800 dark:text-violet-300">
                      <Link href={feature.href}>
                        {feature.ctaLabel ?? "Open"}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            );
          })}
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
      </div>
    </AdminPageLayout>
  );
}
