"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  EMPLOYEE_DOCUMENT_TYPE_OPTIONS,
  type EmployeeDocumentCategory,
} from "@/types/employee";
import { formatFileSize } from "@/components/admin/documents/document-utils";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
]);
const ACCEPTED =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp";

const SPRING = { type: "spring" as const, bounce: 0, duration: 0.35 };

export interface EmployeeSelfDocumentPayload {
  name: string;
  category: EmployeeDocumentCategory;
  file: File;
}

interface EmployeeDocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  uploadPercent: number | null;
  mode?: "add" | "replace";
  initialCategory?: EmployeeDocumentCategory;
  initialName?: string;
  onSubmit: (payload: EmployeeSelfDocumentPayload) => Promise<void>;
}

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function EmployeeDocumentUploadDialog({
  open,
  onOpenChange,
  isSubmitting,
  uploadPercent,
  mode = "add",
  initialCategory = "national_id",
  initialName = "",
  onSubmit,
}: EmployeeDocumentUploadDialogProps) {
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [category, setCategory] =
    useState<EmployeeDocumentCategory>(initialCategory);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setError(null);
      return;
    }
    setName(initialName);
    setCategory(initialCategory);
    setFile(null);
    setError(null);
  }, [open, initialCategory, initialName]);

  const handleFileChange = (next: File | null) => {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_EXTENSIONS.has(extensionOf(next.name))) {
      setError("Use a PDF or image (JPG, PNG, GIF, WEBP).");
      setFile(null);
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError("File must be 10 MB or smaller.");
      setFile(null);
      return;
    }
    setFile(next);
    if (!name.trim()) {
      setName(next.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a file.");
      return;
    }
    if (!name.trim()) {
      setError("Name this document.");
      return;
    }
    await onSubmit({
      name: name.trim(),
      category,
      file,
    });
  };

  const progressLabel =
    uploadPercent == null
      ? null
      : uploadPercent < 100
        ? `Uploading… ${uploadPercent}%`
        : "Saving to your record…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden border-border/60 bg-background/95 p-0 shadow-[0_24px_70px_-30px_rgba(39,33,86,0.45)] backdrop-blur-xl sm:max-w-md sm:rounded-2xl"
        )}
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={SPRING}
          className="p-6"
        >
          <DialogHeader>
            <DialogTitle>
              {mode === "replace" ? "Replace document" : "Upload document"}
            </DialogTitle>
            <DialogDescription>
              {mode === "replace"
                ? "Swap the file on your employee record."
                : "Add an ID, CV, certificate, or other file to your employee record."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emp-self-doc-type">Document type</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(value as EmployeeDocumentCategory)
                }
                disabled={isSubmitting || mode === "replace"}
              >
                <SelectTrigger id="emp-self-doc-type" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-self-doc-name">Document name</Label>
              <Input
                id="emp-self-doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="National ID – front"
                maxLength={200}
                disabled={isSubmitting}
                required
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-self-doc-file">File</Label>
              <input
                ref={fileInputRef}
                id="emp-self-doc-file"
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <motion.button
                type="button"
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-sm transition-colors hover:bg-muted/50 active:bg-muted/60 disabled:opacity-60"
              >
                <Upload className="h-5 w-5 text-[#272156]" strokeWidth={1.75} />
                {file ? (
                  <span className="text-center">
                    <span className="font-medium text-foreground">{file.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    PDF or image — tap to choose (max 10 MB)
                  </span>
                )}
              </motion.button>
            </div>

            <AnimatePresence>
              {uploadPercent != null ? (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#272156]/10">
                    <motion.div
                      className="h-full rounded-full bg-[#31CDFF]"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(100, Math.max(0, uploadPercent))}%`,
                      }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", bounce: 0, duration: 0.25 }
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{progressLabel}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl active:scale-[0.97]"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-[#272156] text-white hover:bg-[#272156]/90 active:scale-[0.97]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    {mode === "replace" ? "Replacing…" : "Uploading…"}
                  </>
                ) : mode === "replace" ? (
                  "Replace"
                ) : (
                  "Upload"
                )}
              </Button>
            </DialogFooter>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
