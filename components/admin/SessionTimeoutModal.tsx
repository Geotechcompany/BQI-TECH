"use client";

import { useState, useEffect } from "react";
import { Clock, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BRAND_NAVY = "#272156";
const BRAND_CYAN = "#31CDFF";

interface SessionTimeoutModalProps {
  isOpen: boolean;
  onStayLoggedIn: () => void | Promise<void>;
  onLogout: () => void;
  timeRemaining: number;
  totalTime: number;
}

export function SessionTimeoutModal({
  isOpen,
  onStayLoggedIn,
  onLogout,
  timeRemaining,
  totalTime,
}: SessionTimeoutModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setMinutes(Math.floor(timeRemaining / 60));
    setSeconds(timeRemaining % 60);
  }, [timeRemaining]);

  useEffect(() => {
    if (isOpen) {
      setRefreshError(null);
      setIsRefreshing(false);
    }
  }, [isOpen]);

  const handleStayLoggedIn = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await onStayLoggedIn();
    } catch (error) {
      console.error("Failed to refresh session:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to refresh session. Please try again.";
      setRefreshError(message);
      // Do not logout on failure — allow retry
    } finally {
      setIsRefreshing(false);
    }
  };

  const progressPercentage =
    totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="w-[95vw] max-w-md gap-0 overflow-hidden rounded-xl border border-[#272156]/10 bg-white p-0 shadow-xl sm:rounded-xl [&>button]:hidden">
        <div className="space-y-5 p-6">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(49, 205, 255, 0.15)" }}
            >
              <Clock className="h-6 w-6" style={{ color: BRAND_NAVY }} aria-hidden />
            </div>
            <div className="space-y-1.5">
              <DialogTitle
                className="text-lg font-semibold"
                style={{ color: BRAND_NAVY }}
              >
                Session Timeout Warning
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Your session will expire soon. Click Stay Logged In to continue.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-3 text-center">
            <div
              className="font-mono text-3xl font-semibold"
              style={{ color: BRAND_NAVY }}
            >
              {minutes.toString().padStart(2, "0")}:
              {seconds.toString().padStart(2, "0")}
            </div>
            <p className="text-sm text-muted-foreground">Time remaining</p>

            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-[#272156]/10"
              role="progressbar"
              aria-valuenow={Math.round(progressPercentage)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: BRAND_CYAN,
                }}
              />
            </div>
          </div>

          {refreshError ? (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700"
              role="alert"
            >
              {refreshError}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleStayLoggedIn}
              disabled={isRefreshing}
              className="min-h-[44px] flex-1 text-white hover:opacity-90"
              style={{ backgroundColor: BRAND_NAVY }}
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Stay Logged In
                </>
              )}
            </Button>

            <Button
              onClick={onLogout}
              variant="outline"
              disabled={isRefreshing}
              className="min-h-[44px] flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Your session will expire automatically if no action is taken.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
