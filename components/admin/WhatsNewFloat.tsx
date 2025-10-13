"use client";

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";

type Feature = { title: string; description: string };

export function WhatsNewFloat({
  features,
  imageSrc,
}: {
  features: Feature[];
  imageSrc?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("admin_whats_new_dismissed_v1");
      if (!dismissed) setOpen(true);
    } catch {}
  }, []);

  if (!open || features.length === 0) return null;

  const headerImage = imageSrc || "/whatsnew.jpg";

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <Card className="w-[320px] shadow-2xl border-primary/20 overflow-hidden">
        {/* Header image */}
        <div className="relative w-full h-28">
          <Image
            src={headerImage}
            alt="What's new"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold">What’s New</span>
            </div>
            <button
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                setOpen(false);
                try {
                  localStorage.setItem("admin_whats_new_dismissed_v1", "1");
                } catch {}
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {features.map((f, i) => (
              <li key={i} className="p-2 rounded-md bg-muted/50">
                <div className="font-medium">{f.title}</div>
                <div className="text-muted-foreground">{f.description}</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default WhatsNewFloat;
