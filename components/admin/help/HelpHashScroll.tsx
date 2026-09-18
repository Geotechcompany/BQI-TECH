"use client";

import { useEffect } from "react";

/** Scroll to hash targets after client navigation (e.g. Learn More#stage-actions). */
export function HelpHashScroll() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return null;
}
