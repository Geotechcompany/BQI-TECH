"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Upload } from "lucide-react";
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
import { CATEGORY_OPTIONS, type DocumentCategory } from "@/types/company-document";
import {
  detectFormatFromFilename,
  formatFileSize,
} from "@/components/admin/documents/document-utils";

export interface UploadDocumentPayload {
  title: string;
  description: string;
  category: DocumentCategory;
  file: File;
}

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (payload: UploadDocumentPayload) => Promise<void>;
}

const ACCEPTED =
  ".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function UploadDocumentDialog({
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: UploadDocumentDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("policies");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setCategory("policies");
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
    if (!detectFormatFromFilename(next.name)) {
      setError("Use a PDF, Word, or Excel file.");
      setFile(null);
      return;
    }
    setFile(next);
    if (!title.trim()) {
      setTitle(next.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a company policy, handbook, template, or form to the library.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-file">File</Label>
            <input
              ref={fileInputRef}
              id="doc-file"
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
                  PDF, DOC, or XLS — click to choose
                </span>
              )}
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Employee handbook"
              maxLength={200}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as DocumentCategory)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="doc-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-description">Description</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary for the document list"
              rows={3}
              maxLength={1000}
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
