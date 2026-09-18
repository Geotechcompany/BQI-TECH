"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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

export interface UploadEmployeeDocumentPayload {
  name: string;
  category: EmployeeDocumentCategory;
  file: File;
}

interface UploadEmployeeDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (payload: UploadEmployeeDocumentPayload) => Promise<void>;
}

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function UploadEmployeeDocumentDialog({
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: UploadEmployeeDocumentDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<EmployeeDocumentCategory>("national_id");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setCategory("national_id");
      setFile(null);
      setError(null);
    }
  }, [open]);

  const handleFileChange = (next: File | null) => {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_EXTENSIONS.has(extensionOf(next.name))) {
      setError("Use a PDF or image file (JPG, PNG, GIF, WEBP).");
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
      setError("Choose a file to upload.");
      return;
    }
    if (!name.trim()) {
      setError("Give this document a name.");
      return;
    }
    await onSubmit({
      name: name.trim(),
      category,
      file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Add an ID, contract, certificate, or other file to this employee.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emp-doc-type">Document type</Label>
            <Select
              value={category}
              onValueChange={(value) =>
                setCategory(value as EmployeeDocumentCategory)
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="emp-doc-type">
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
            <Label htmlFor="emp-doc-name">Document name</Label>
            <Input
              id="emp-doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="National ID – front"
              maxLength={200}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emp-doc-file">File</Label>
            <input
              ref={fileInputRef}
              id="emp-doc-file"
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-sm transition-colors hover:bg-muted/50"
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
                  PDF or image — click to choose (max 10 MB)
                </span>
              )}
            </button>
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
                  Uploading…
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
