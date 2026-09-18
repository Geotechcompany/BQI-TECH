"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

function ThankYouPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="mx-auto flex max-w-lg flex-col items-center px-2 py-10 text-center sm:py-14"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="relative mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[#272156]/10 bg-[#272156]/5 shadow-sm"
        aria-hidden
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, rgba(49,205,255,0.25), transparent 70%)",
          }}
        />
        <CheckCircle2 className="relative h-10 w-10 text-[#272156]" strokeWidth={1.5} />
      </div>

      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#31CDFF]">
        Application received
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#272156] dark:text-foreground sm:text-3xl">
        Thanks — we got your application
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
        Hiring will review it and contact you if you move forward.
      </p>

      <div className="mt-8 w-full rounded-2xl border border-border/60 bg-card p-5 text-left shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-[#272156] dark:text-foreground">
          What happens next
        </h2>
        <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#31CDFF]" />
            Your application is in the review queue.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#31CDFF]" />
            If your profile fits, we&apos;ll reach out about next steps.
          </li>
        </ul>
      </div>

      <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          asChild
          className="bg-[#31CDFF] text-white hover:bg-[#31CDFF]/90"
        >
          <Link href="/dashboard/applications">
            Track status
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-[#272156]/20 text-[#272156] hover:bg-[#272156]/5"
        >
          <Link href="/dashboard/jobs">Browse more jobs</Link>
        </Button>
      </div>

      <p className="mt-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Questions?{" "}
        <a
          href="mailto:info@bqitech.com"
          className="font-medium text-[#272156] underline-offset-2 hover:underline dark:text-[#31CDFF]"
        >
          info@bqitech.com
        </a>
      </p>
    </motion.div>
  );
}

export default ThankYouPage;
