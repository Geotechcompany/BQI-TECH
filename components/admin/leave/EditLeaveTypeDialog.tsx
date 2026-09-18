"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import type { LeaveTypeCode, LeaveTypeDefinition } from "@/types/leave";

const LEAVE_TYPE_CODES: LeaveTypeCode[] = [
  "annual",
  "sick",
  "unpaid",
  "maternity",
  "paternity",
  "compassionate",
  "study",
  "birth_holiday",
  "toil",
];

export type LeaveTypeEditPayload = {
  name: string;
  code: LeaveTypeCode;
  color: string;
  paid: boolean;
  defaultAllowanceDays: number;
  requiresApproval: boolean;
  description: string;
  active: boolean;
  unlimited: boolean;
};

interface EditLeaveTypeDialogProps {
  open: boolean;
  leaveType: LeaveTypeDefinition | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: LeaveTypeEditPayload) => Promise<void>;
}

export function EditLeaveTypeDialog({
  open,
  leaveType,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: EditLeaveTypeDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState<LeaveTypeCode>("annual");
  const [color, setColor] = useState("#272156");
  const [paid, setPaid] = useState(true);
  const [defaultAllowanceDays, setDefaultAllowanceDays] = useState("0");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [unlimited, setUnlimited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !leaveType) return;
    setName(leaveType.name);
    setCode(leaveType.code);
    setColor(leaveType.color || "#272156");
    setPaid(leaveType.paid);
    setDefaultAllowanceDays(String(leaveType.defaultAllowanceDays ?? 0));
    setRequiresApproval(leaveType.requiresApproval);
    setDescription(leaveType.description || "");
    setActive(leaveType.active);
    setUnlimited(Boolean(leaveType.unlimited));
    setError(null);
  }, [open, leaveType]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    const days = Number(defaultAllowanceDays);
    if (!Number.isFinite(days) || !Number.isInteger(days) || days < 0) {
      setError("Allowance days must be a whole number ≥ 0.");
      return;
    }
    const hex = color.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setError("Color must be a hex value like #1e3a8a.");
      return;
    }
    try {
      await onSubmit({
        name: trimmedName,
        code,
        color: hex,
        paid,
        defaultAllowanceDays: days,
        requiresApproval,
        description: description.trim(),
        active,
        unlimited,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save leave type");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit leave type</DialogTitle>
          <DialogDescription>
            Changes save to MongoDB and are not overwritten by seed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leave-type-name">Name</Label>
            <Input
              id="leave-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="leave-type-code">Code</Label>
              <Select
                value={code}
                onValueChange={(v) => setCode(v as LeaveTypeCode)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="leave-type-code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPE_CODES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-type-color">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="leave-type-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={isSubmitting}
                  className="h-10 w-14 cursor-pointer p-1"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={isSubmitting}
                  className="font-mono text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-type-allowance">Default allowance (days)</Label>
            <Input
              id="leave-type-allowance"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={defaultAllowanceDays}
              onChange={(e) => setDefaultAllowanceDays(e.target.value)}
              disabled={isSubmitting || unlimited}
            />
            {unlimited ? (
              <p className="text-xs text-muted-foreground">
                Unlimited types do not use a fixed allowance.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-type-description">Description</Label>
            <Textarea
              id="leave-type-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[#272156]/10 px-3 py-2">
              <span className="text-sm">Paid</span>
              <Switch checked={paid} onCheckedChange={setPaid} disabled={isSubmitting} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[#272156]/10 px-3 py-2">
              <span className="text-sm">Requires approval</span>
              <Switch
                checked={requiresApproval}
                onCheckedChange={setRequiresApproval}
                disabled={isSubmitting}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[#272156]/10 px-3 py-2">
              <span className="text-sm">Unlimited</span>
              <Switch
                checked={unlimited}
                onCheckedChange={setUnlimited}
                disabled={isSubmitting}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[#272156]/10 px-3 py-2">
              <span className="text-sm">Active</span>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                disabled={isSubmitting}
              />
            </label>
          </div>

          {error ? (
            <p className="text-sm text-rose-700" role="alert">
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
