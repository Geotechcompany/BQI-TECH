"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw, LogOut, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BRAND_NAVY = "#272156";
const BRAND_CYAN = "#31CDFF";

interface SessionExpiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  countdownDuration?: number; // in seconds
}

export function SessionExpiredDialog({
  isOpen,
  onClose,
  onRefresh,
  countdownDuration = 30,
}: SessionExpiredDialogProps) {
  const [countdown, setCountdown] = useState(countdownDuration);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const { logout, refreshToken } = useAuth();

  const isRefreshingRef = useRef(false);
  const hasLoggedOutRef = useRef(false);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(countdownDuration);
      setRefreshError(null);
      setIsRefreshing(false);
      isRefreshingRef.current = false;
      hasLoggedOutRef.current = false;
    }
  }, [isOpen, countdownDuration]);

  const handleLogout = async () => {
    if (hasLoggedOutRef.current) return;
    hasLoggedOutRef.current = true;
    isRefreshingRef.current = false;
    setIsRefreshing(false);

    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      onClose();
      // logout() already soft-navigates to the correct login route
    }
  };

  // Countdown — paused while refreshing; cancelled after successful stay-logged-in
  useEffect(() => {
    if (!isOpen || countdown <= 0 || isRefreshing) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (isRefreshingRef.current || hasLoggedOutRef.current || !isOpenRef.current) {
          return prev;
        }
        if (prev <= 1) {
          void handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown, isRefreshing]);

  const handleRefresh = async () => {
    if (isRefreshingRef.current || hasLoggedOutRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        await refreshToken();
      }
      // Success: parent dismisses via onRefresh/refreshSession; also close locally
      onClose();
    } catch (error) {
      console.error("Failed to refresh session:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to refresh session. Please try again.";
      setRefreshError(message);
      // Keep modal open for retry; do not logout
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  };

  const progressPercentage =
    ((countdownDuration - countdown) / countdownDuration) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="w-[95vw] max-w-md gap-0 overflow-hidden rounded-xl border border-[#272156]/10 bg-white p-0 shadow-xl sm:rounded-xl [&>button]:hidden"
        style={{ zIndex: 10000 }}
      >
        <div className="space-y-5 p-6">
          <DialogHeader className="space-y-3 text-center sm:text-center">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(245, 158, 11, 0.12)" }}
            >
              <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden />
            </div>

            <div className="space-y-1.5">
              <DialogTitle
                className="text-lg font-semibold"
                style={{ color: BRAND_NAVY }}
              >
                Session Expired
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Your session has expired. You will be logged out automatically
                in:
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5">
              <Clock className="h-4 w-4 text-amber-600" aria-hidden />
              <span className="font-mono text-xl font-semibold text-amber-700">
                {countdown}s
              </span>
            </div>

            <div className="space-y-1.5">
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
              <p className="text-xs text-muted-foreground">
                Auto-logout in progress…
              </p>
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
              onClick={handleRefresh}
              disabled={isRefreshing || countdown <= 0}
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
              onClick={handleLogout}
              variant="outline"
              disabled={isRefreshing}
              className="min-h-[44px] flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout Now
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Click Stay Logged In to refresh your session and continue working.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
