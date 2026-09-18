"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/employees";

export interface AdjustPayPayload {
  newBaseSalary: number;
  effectiveDate: string;
  note: string;
}

interface AdjustPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBase: number;
  currency: string;
  isSubmitting: boolean;
  onSubmit: (payload: AdjustPayPayload) => Promise<void>;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdjustPayDialog({
  open,
  onOpenChange,
  currentBase,
  currency,
  isSubmitting,
  onSubmit,
}: AdjustPayDialogProps) {
  const [newBase, setNewBase] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIsoDate());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNewBase(currentBase > 0 ? String(currentBase) : "");
    setEffectiveDate(todayIsoDate());
    setNote("");
    setError(null);
  }, [open, currentBase]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = Number(newBase);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid base salary (0 or greater).");
      return;
    }
    if (parsed === currentBase) {
      setError("New base salary is the same as the current amount.");
      return;
    }
    await onSubmit({
      newBaseSalary: parsed,
      effectiveDate: effectiveDate || todayIsoDate(),
      note: note.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust pay</DialogTitle>
          <DialogDescription>
            Current base: {formatMoney(currentBase, currency)}. Update salary
            and optionally note the effective date and reason.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjust-pay-base">New base salary</Label>
            <Input
              id="adjust-pay-base"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={newBase}
              onChange={(e) => setNewBase(e.target.value)}
              placeholder="0"
              disabled={isSubmitting}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-pay-date">Effective date</Label>
            <Input
              id="adjust-pay-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-pay-note">Reason / note (optional)</Label>
            <Textarea
              id="adjust-pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Merit increase, market adjustment…"
              rows={3}
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#272156] text-white hover:bg-[#272156]/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save pay"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
