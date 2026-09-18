"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, FileUp, Loader2 } from "lucide-react";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import type { Application } from "@/types/application";
import { PIPELINE_STAGES } from "./pipeline-utils";
import {
  importResumeAndExtract,
  parseCandidateCsv,
  RESUME_ACCEPT,
} from "@/components/admin/candidates/resume-import";
import { toast } from "react-hot-toast";

interface AddCandidateDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStage?: string;
  onCreated: (application: Application) => void;
}

export function AddCandidateDialog({
  jobId,
  open,
  onOpenChange,
  defaultStage = "New",
  onCreated,
}: AddCandidateDialogProps) {
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [location, setLocation] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [status, setStatus] = useState(defaultStage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCsvImporting, setIsCsvImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setPhoneNumber("");
    setLocation("");
    setCvUrl("");
    setResumeFileName("");
    setStatus(defaultStage);
    setIsExtracting(false);
    setIsCsvImporting(false);
  }, [open, defaultStage]);

  const busy = isSubmitting || isExtracting || isCsvImporting;

  const handleResumePick = async (file: File | undefined) => {
    if (!file) return;
    setIsExtracting(true);
    try {
      const imported = await importResumeAndExtract(file);
      setCvUrl(imported.cvUrl);
      setResumeFileName(imported.fileName);
      if (imported.extracted.name) setName(imported.extracted.name);
      if (imported.extracted.email) setEmail(imported.extracted.email);
      if (imported.extracted.phoneNumber) {
        setPhoneNumber(imported.extracted.phoneNumber);
      }
      if (imported.extracted.location) {
        setLocation(imported.extracted.location);
      }
      if (imported.warning) {
        toast.error(imported.warning);
      } else {
        toast.success("Resume extracted — review fields before adding");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to extract resume"
      );
    } finally {
      setIsExtracting(false);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };

  const handleCsvPick = async (file: File | undefined) => {
    if (!file) return;
    setIsCsvImporting(true);
    try {
      const text = await file.text();
      const rows = parseCandidateCsv(text);
      let createdCount = 0;
      let lastApplication: Application | null = null;

      for (const row of rows) {
        const result = await adminApplicationsApi.createManualApplication({
          jobId,
          name: row.name,
          email: row.email,
          status: row.status || status,
          cvUrl: row.cvUrl,
          phoneNumber: row.phoneNumber,
          location: row.location,
        });
        createdCount += 1;
        const application = result.application as unknown as Application;
        lastApplication = {
          ...application,
          id: application.id || result.applicationId,
        };
      }

      if (lastApplication) onCreated(lastApplication);
      toast.success(
        createdCount === 1
          ? "Candidate imported from CSV"
          : `${createdCount} candidates imported from CSV`
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import CSV"
      );
    } finally {
      setIsCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("A valid email is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await adminApplicationsApi.createManualApplication({
        jobId,
        name: trimmedName,
        email: trimmedEmail,
        status,
        cvUrl: cvUrl.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        location: location.trim() || undefined,
      });

      const application = result.application as unknown as Application;
      onCreated({
        ...application,
        id: application.id || result.applicationId,
      });
      toast.success(
        result.userCreated
          ? "Candidate added — account invite emailed"
          : "Candidate added to pipeline"
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add candidate"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Candidates</DialogTitle>
          <DialogDescription>
            Import a resume or CSV, or enter details manually. A user account is
            created if one does not exist.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <input
            ref={resumeInputRef}
            type="file"
            accept={RESUME_ACCEPT}
            className="hidden"
            onChange={(event) => handleResumePick(event.target.files?.[0])}
          />
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => handleCsvPick(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => resumeInputRef.current?.click()}
            className="h-auto flex-col gap-1 border-[#272055]/20 bg-[#272055] py-3 text-white hover:bg-[#1f1a45] hover:text-white"
          >
            {isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            <span className="text-xs font-medium">
              {isExtracting ? "Extracting…" : "Import by Resume"}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => csvInputRef.current?.click()}
            className="h-auto flex-col gap-1 border-[#272055]/20 bg-[#272055] py-3 text-white hover:bg-[#1f1a45] hover:text-white"
          >
            {isCsvImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span className="text-xs font-medium">
              {isCsvImporting ? "Importing…" : "Import from CSV"}
            </span>
          </Button>
        </div>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#272055]/15" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-candidate-name">Name</Label>
            <Input
              id="add-candidate-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              required
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-candidate-email">Email</Label>
            <Input
              id="add-candidate-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane@example.com"
              autoComplete="email"
              required
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="add-candidate-phone">Phone</Label>
              <Input
                id="add-candidate-phone"
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+254…"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-candidate-location">Location</Label>
              <Input
                id="add-candidate-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Nairobi, Kenya"
                disabled={busy}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-candidate-stage">Pipeline stage</Label>
            <Select
              value={status}
              onValueChange={setStatus}
              disabled={busy}
            >
              <SelectTrigger id="add-candidate-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-candidate-cv">CV</Label>
            {resumeFileName ? (
              <p className="rounded-md border border-[#272055]/15 bg-[#fafbfd] px-3 py-2 text-sm text-[#272055]">
                {resumeFileName}
              </p>
            ) : (
              <Input
                id="add-candidate-cv"
                type="url"
                value={cvUrl}
                onChange={(event) => setCvUrl(event.target.value)}
                placeholder="https://… (optional)"
                disabled={busy}
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-[#272055] text-white hover:bg-[#1f1a45]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add candidate"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
