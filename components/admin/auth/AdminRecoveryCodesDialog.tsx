"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminRecoveryCodesDialogProps {
  codes: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminRecoveryCodesDialog({
  codes,
  open,
  onOpenChange,
}: AdminRecoveryCodesDialogProps) {
  const copyRecovery = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Recovery codes copied");
    } catch {
      toast.error("Could not copy codes");
    }
  };

  if (!codes.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save your recovery codes</DialogTitle>
          <DialogDescription>
            Authenticator is on. Store these codes somewhere safe — they
            won&apos;t be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 font-mono text-sm">
          <ul className="grid gap-2 sm:grid-cols-2">
            {codes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void copyRecovery()}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy recovery codes
          </Button>
          <Button
            type="button"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
