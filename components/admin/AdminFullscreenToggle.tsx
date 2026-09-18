"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminFullscreenToggleProps {
  className?: string;
}

export function AdminFullscreenToggle({ className }: AdminFullscreenToggleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (!document.documentElement.requestFullscreen) {
        toast.error("Fullscreen is not supported in this browser");
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Browser blocked the request (user gesture policy, permissions, etc.)
      toast.error("Could not enter fullscreen");
    }
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "h-9 w-9 shrink-0 rounded-lg border-border/80 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        className
      )}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      aria-pressed={isFullscreen}
      onClick={() => void toggleFullscreen()}
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" aria-hidden />
      ) : (
        <Maximize className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
