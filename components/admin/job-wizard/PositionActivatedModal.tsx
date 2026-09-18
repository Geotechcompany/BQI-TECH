"use client";

import { useState } from "react";
import { Check, Copy, Facebook, Linkedin } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PositionActivatedModalProps {
  open: boolean;
  onClose: () => void;
  jobTitle: string;
  jobUrl: string;
  isActive: boolean;
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function PositionActivatedModal({
  open,
  onClose,
  jobTitle,
  jobUrl,
  isActive,
}: PositionActivatedModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const encodedUrl = encodeURIComponent(jobUrl);
  const encodedTitle = encodeURIComponent(jobTitle);
  const shareLinks = [
    {
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      className: "bg-[#1877F2] hover:bg-[#166FE5]",
      icon: Facebook,
    },
    {
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      className: "bg-[#272055] hover:bg-[#1e1840]",
      icon: XIcon,
    },
    {
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      className: "bg-[#0A66C2] hover:bg-[#095196]",
      icon: Linkedin,
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        className="max-w-md gap-0 overflow-hidden rounded-2xl border-[#272055]/10 p-0 sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="px-6 pb-6 pt-10 text-center">
          <div
            className={cn(
              "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full",
              isActive ? "bg-emerald-50" : "bg-[#31CDFF]/10"
            )}
          >
            <Check
              className={cn(
                "h-9 w-9 stroke-[2.5]",
                isActive ? "text-emerald-600" : "text-[#31CDFF]"
              )}
            />
          </div>

          <DialogTitle className="text-center text-xl font-semibold text-[#272055]">
            {isActive
              ? "Your position has been activated."
              : "Your position has been saved."}
          </DialogTitle>

          <DialogDescription className="mt-2 text-center text-sm text-[#272055]/65">
            {isActive
              ? "It will appear on your careers site and start accepting applications."
              : "Publish it when you're ready for candidates to see this position on your careers site."}
          </DialogDescription>

          {isActive && (
            <div className="mt-8">
              <p className="mb-2 text-sm text-[#272055]/55">Here&apos;s the link:</p>
              <div className="relative">
                <Input
                  readOnly
                  value={jobUrl}
                  onClick={() => void handleCopy()}
                  className="cursor-pointer border-[#272055]/15 bg-[#fafbfd] pr-10 text-center text-sm text-[#272055] focus-visible:ring-[#31CDFF]"
                  aria-label="Public careers link"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#272055]/50 transition-colors hover:bg-[#31CDFF]/10 hover:text-[#31CDFF]"
                  aria-label="Copy link"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {isActive && (
          <div className="border-t border-[#272055]/10 bg-[#fafbfd] px-6 py-5 text-center">
            <p className="mb-4 text-sm text-[#272055]/55">Don&apos;t forget to share it!</p>
            <div className="flex items-center justify-center gap-3">
              {shareLinks.map(({ label, href, className, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md text-white transition-colors",
                    className
                  )}
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
