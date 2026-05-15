"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlogAiButtonProps {
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  size?: "sm" | "default";
}

export function BlogAiButton({
  label = "AI",
  loading = false,
  disabled = false,
  onClick,
  className,
  size = "sm",
}: BlogAiButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}
