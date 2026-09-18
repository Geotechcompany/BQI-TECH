"use client";

/**
 * Local-only preview cards for integrations that are not wired yet.
 * DocuSign and Linear now live in dedicated cards; this file keeps the
 * generic placeholder for future providers.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Unplug } from "lucide-react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "bqi.admin.integrations.";

function readConnected(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`) === "connected";
  } catch {
    return false;
  }
}

function writeConnected(storageKey: string, connected: boolean) {
  if (typeof window === "undefined") return;
  try {
    const key = `${STORAGE_PREFIX}${storageKey}`;
    if (connected) {
      window.localStorage.setItem(key, "connected");
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore quota / private-mode failures; UI still updates in-session.
  }
}

export interface PlaceholderIntegrationCardProps {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  manageBlurb: string;
}

export function PlaceholderIntegrationCard({
  id,
  name,
  description,
  icon,
  manageBlurb,
}: PlaceholderIntegrationCardProps) {
  const [connected, setConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  useEffect(() => {
    setConnected(readConnected(id));
    setHydrated(true);
  }, [id]);

  const handleConnect = useCallback(() => {
    setComingSoonOpen(true);
  }, []);

  const handleMarkConnected = useCallback(() => {
    writeConnected(id, true);
    setConnected(true);
    setComingSoonOpen(false);
    toast.success(`${name} marked connected (local only)`);
  }, [id, name]);

  const handleDisconnect = useCallback(() => {
    writeConnected(id, false);
    setConnected(false);
    setManageOpen(false);
    toast.success(`${name} disconnected`);
  }, [id, name]);

  return (
    <>
      <div
        className={cn(
          "rounded-xl border p-5 transition-colors",
          connected
            ? "border-[#272156]/25 bg-[#272156]/[0.03]"
            : "border-border/60 bg-muted/20"
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-white">
              {icon}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                {hydrated && connected ? (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 border-[#31CDFF]/40 text-[#272156]"
                  >
                    Available
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          <div className="shrink-0 sm:pt-0.5">
            {hydrated && connected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManageOpen(true)}
                className="border-[#272156]/20 text-[#272156] hover:bg-[#272156]/5"
              >
                Manage
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleConnect}
                className="bg-[#272156] text-white hover:bg-[#272156]/90"
              >
                Connect
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#272156]">Connect {name}</DialogTitle>
            <DialogDescription>
              This integration is not wired yet. You can preview the Connected
              state locally.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setComingSoonOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleMarkConnected}
              className="bg-[#272156] text-white hover:bg-[#272156]/90"
            >
              Preview as connected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#272156]">Manage {name}</DialogTitle>
            <DialogDescription>{manageBlurb}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored in this browser only. Disconnect clears the local preview.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDisconnect}
            >
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
