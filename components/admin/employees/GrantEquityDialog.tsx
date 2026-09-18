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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/employees";

export interface GrantEquityPayload {
  grantValue: number;
  grantType: "rsu" | "options";
  shares: number;
  vestNotes: string;
  effectiveDate: string;
}

interface GrantEquityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEquityValue: number;
  currency: string;
  isSubmitting: boolean;
  onSubmit: (payload: GrantEquityPayload) => Promise<void>;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GrantEquityDialog({
  open,
  onOpenChange,
  currentEquityValue,
  currency,
  isSubmitting,
  onSubmit,
}: GrantEquityDialogProps) {
  const [grantValue, setGrantValue] = useState("");
  const [grantType, setGrantType] = useState<"rsu" | "options">("rsu");
  const [shares, setShares] = useState("");
  const [vestNotes, setVestNotes] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIsoDate());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGrantValue("");
    setGrantType("rsu");
    setShares("");
    setVestNotes("");
    setEffectiveDate(todayIsoDate());
    setError(null);
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const value = Number(grantValue);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a grant value greater than zero.");
      return;
    }
    const shareCount = shares.trim() === "" ? 0 : Number(shares);
    if (!Number.isFinite(shareCount) || shareCount < 0) {
      setError("Shares must be zero or a positive number.");
      return;
    }
    if (!Number.isInteger(shareCount)) {
      setError("Shares must be a whole number.");
      return;
    }
    await onSubmit({
      grantValue: value,
      grantType,
      shares: shareCount,
      vestNotes: vestNotes.trim(),
      effectiveDate: effectiveDate || todayIsoDate(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant equity</DialogTitle>
          <DialogDescription>
            Outstanding equity value:{" "}
            {formatMoney(currentEquityValue, currency)}. Add a grant to the
            employee&apos;s equity and compensation history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grant-equity-value">Grant value</Label>
            <Input
              id="grant-equity-value"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              value={grantValue}
              onChange={(e) => setGrantValue(e.target.value)}
              placeholder="0"
              disabled={isSubmitting}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-equity-type">Type</Label>
            <Select
              value={grantType}
              onValueChange={(value) =>
                setGrantType(value as "rsu" | "options")
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="grant-equity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rsu">RSU</SelectItem>
                <SelectItem value="options">Options</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-equity-shares">Shares (optional)</Label>
            <Input
              id="grant-equity-shares"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="0"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-equity-date">Effective date</Label>
            <Input
              id="grant-equity-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-equity-vest">Vest notes (optional)</Label>
            <Textarea
              id="grant-equity-vest"
              value={vestNotes}
              onChange={(e) => setVestNotes(e.target.value)}
              placeholder="4-year monthly after 1-year cliff"
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
                "Grant equity"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
