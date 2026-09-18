"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Editor } from "@/components/editor";
import { DescriptionTemplatePicker } from "@/components/admin/job-postings/DescriptionTemplatePicker";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobWizardState, JobWizardStepId } from "@/types/job-wizard";
import {
  canActivateJob,
  formatMissingActivationMessage,
  getMissingActivationFields,
} from "@/lib/job-activation";
import { AutoOpenCloseSection } from "./AutoOpenCloseSection";
import { ApplicationStep } from "./ApplicationStep";
import {
  GenerateJobDescriptionDialog,
  type GenerateJobDescriptionMode,
} from "./GenerateJobDescriptionDialog";
import { JobCareersPreviewDialog } from "./JobCareersPreviewDialog";
import { getCareersJobPreviewPath } from "./job-preview-urls";
import { PipelineStep } from "./PipelineStep";

export { ApplicationStep } from "./ApplicationStep";
export { PipelineStep } from "./PipelineStep";

interface StepProps {
  state: JobWizardState;
  onChange: (patch: Partial<JobWizardState>) => void;
  jobId?: string;
  /** Saves if needed, then opens isolated careers preview (`preview=1`). */
  onOpenCareersPreview?: () => Promise<boolean>;
}

export function DetailsStep({ state, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="title">Position title</Label>
        <Input
          id="title"
          className="mt-1.5"
          value={state.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Senior Data Analyst"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            className="mt-1.5"
            value={state.department}
            onChange={(e) => onChange({ department: e.target.value })}
            placeholder="e.g. Finance"
          />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            className="mt-1.5"
            value={state.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="e.g. Nairobi, Kenya"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Employment type</Label>
          <Select
            value={state.employmentType}
            onValueChange={(value) => onChange({ employmentType: value })}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Full-time">Full-time</SelectItem>
              <SelectItem value="Part-time">Part-time</SelectItem>
              <SelectItem value="Contract">Contract</SelectItem>
              <SelectItem value="Internship">Internship</SelectItem>
              <SelectItem value="Temporary">Temporary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="postedDate">Posted date</Label>
          <Input
            id="postedDate"
            type="date"
            className="mt-1.5"
            value={state.postedDate}
            onChange={(e) => onChange({ postedDate: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function descriptionHasContent(html: string): boolean {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}

export function DescriptionStep({
  state,
  onChange,
  jobId,
  onOpenCareersPreview,
}: StepProps) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<GenerateJobDescriptionMode>("generate");
  const [previewOpen, setPreviewOpen] = useState(false);
  const careersHref = getCareersJobPreviewPath(jobId);

  const hasExistingContent = useMemo(
    () => descriptionHasContent(state.description),
    [state.description]
  );

  const openGenerate = () => {
    setAiMode("generate");
    setAiOpen(true);
  };

  const openAdjust = () => {
    setAiMode("adjust");
    setAiOpen(true);
  };

  const handleOpenCareersPage = async () => {
    if (jobId) return;
    if (onOpenCareersPreview) {
      const opened = await onOpenCareersPreview();
      if (opened) return;
    }
    toast.error("Save progress first to open the careers page.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-bold leading-[1.15] tracking-[-0.02em] text-[#272055]">
            Position Description
          </h3>
          <p className="mt-2.5 max-w-2xl text-sm font-normal leading-relaxed text-muted-foreground">
            A strong description draws the people you want. Pull a starting
            point from the searchable library, or let BQI Intelligence draft
            one from your notes.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#31CDFF] hover:underline"
          >
            Preview
          </button>
          {jobId ? (
            <a
              href={careersHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-[#31CDFF] hover:underline"
            >
              Open live careers page
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void handleOpenCareersPage()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-[#31CDFF] hover:underline"
              title="Save this position first to open the careers page"
            >
              Open live careers page
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {!hasExistingContent ? (
        <GenerateButton
          label="Help Me Write"
          generatingLabel="Writing…"
          onClick={openGenerate}
          className="text-sm"
        />
      ) : null}

      <Editor
        value={state.description}
        onChange={(value) => onChange({ description: value })}
        toolbarAccessory={
          <DescriptionTemplatePicker
            hasExistingContent={hasExistingContent}
            onSelect={(template) => {
              onChange({
                description: template.content,
                ...(state.title.trim() ? {} : { title: template.title }),
              });
            }}
          />
        }
        footer={
          hasExistingContent ? (
            <GenerateButton
              label="Adjust"
              generatingLabel="Adjusting…"
              onClick={openAdjust}
              className="text-sm"
            />
          ) : null
        }
      />

      <GenerateJobDescriptionDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        mode={aiMode}
        title={state.title}
        department={state.department}
        location={state.location}
        employmentType={state.employmentType}
        existingDescription={state.description}
        onGenerated={(html) => onChange({ description: html })}
      />

      <JobCareersPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        state={state}
        variant="description"
      />
    </div>
  );
}

export function ScreeningStep({ state, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-[#272055]/10 bg-[#fafbfd] px-4 py-3">
        <div>
          <p className="font-medium text-[#272055]">Enable BQI Intelligence ranking</p>
          <p className="text-sm text-muted-foreground">
            Score applicants against the job description and your extra criteria.
          </p>
        </div>
        <Switch
          checked={state.enableAiRank}
          onCheckedChange={(checked) => onChange({ enableAiRank: checked })}
        />
      </div>

      <div>
        <Label htmlFor="aiRequirements">BQI Intelligence requirements (private)</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Hiring-manager notes used during BQI Intelligence scoring. Not shown on the public careers page.
        </p>
        <Textarea
          id="aiRequirements"
          className="mt-2 min-h-[180px]"
          value={state.aiRequirements}
          onChange={(e) => onChange({ aiRequirements: e.target.value })}
          placeholder="e.g. Must have experience using AI tools for financial reporting."
        />
      </div>
    </div>
  );
}

export function AdvertiseStep({
  state,
  onChange,
  jobId,
  onOpenCareersPreview,
}: StepProps) {
  const careersHref = getCareersJobPreviewPath(jobId);

  const handleOpenCareersPage = async () => {
    if (jobId) return;
    if (onOpenCareersPreview) {
      const opened = await onOpenCareersPreview();
      if (opened) return;
    }
    toast.error("Save progress first to open the careers page.");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-[#272055]/10 bg-[#fafbfd] px-4 py-3">
        <div>
          <p className="font-medium text-[#272055]">Publish on careers site</p>
          <p className="text-sm text-muted-foreground">
            Turn this on when the position is ready to accept applications.
          </p>
        </div>
        <Switch
          checked={state.isActive}
          onCheckedChange={(checked) => {
            if (checked && !canActivateJob(state)) {
              toast.error(
                formatMissingActivationMessage(getMissingActivationFields(state))
              );
              return;
            }
            onChange({
              isActive: checked,
              status: checked
                ? "active"
                : state.status === "active" || state.status === "inactive"
                  ? "inactive"
                  : "draft",
            });
          }}
        />
      </div>

      <AutoOpenCloseSection state={state} onChange={onChange} />

      <div className="rounded-xl border border-[#272055]/10 bg-white p-4">
        <p className="text-sm font-medium text-[#272055]">Careers preview</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Open this position alone on the public careers page. Unpublished positions
          show a Preview banner; candidates cannot apply until you publish.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {jobId ? (
            <a
              href={careersHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#31CDFF] hover:underline"
            >
              Open live careers page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void handleOpenCareersPage()}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#31CDFF] hover:underline"
              title="Save this position first to open the careers page"
            >
              Open live careers page
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function HiringTeamStep({ state, onChange }: StepProps) {
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("Hiring Manager");
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");

  const addMember = () => {
    if (!memberName.trim() || !memberEmail.trim()) return;
    onChange({
      hiringTeam: [
        ...state.hiringTeam,
        {
          id: `member-${Date.now()}`,
          name: memberName.trim(),
          email: memberEmail.trim(),
          role: memberRole,
        },
      ],
    });
    setMemberName("");
    setMemberEmail("");
  };

  const addRecruiter = () => {
    if (!recruiterName.trim() || !recruiterEmail.trim()) return;
    onChange({
      externalRecruiters: [
        ...state.externalRecruiters,
        {
          id: `recruiter-${Date.now()}`,
          name: recruiterName.trim(),
          email: recruiterEmail.trim(),
        },
      ],
    });
    setRecruiterName("");
    setRecruiterEmail("");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#272055]/10 bg-white p-4">
        <h3 className="font-medium text-[#272055]">Internal hiring team</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add people who can review and move candidates for this position.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Name"
          />
          <Input
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder="Email"
          />
          <Select value={memberRole} onValueChange={setMemberRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Hiring Manager">Hiring Manager</SelectItem>
              <SelectItem value="Recruiter">Recruiter</SelectItem>
              <SelectItem value="Interviewer">Interviewer</SelectItem>
              <SelectItem value="Reviewer">Reviewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" className="mt-3" onClick={addMember}>
          <Plus className="mr-2 h-4 w-4" />
          Add to hiring team
        </Button>

        {state.hiringTeam.length > 0 && (
          <div className="mt-4 space-y-2">
            {state.hiringTeam.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-[#272055]/10 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-[#272055]">{member.name}</p>
                  <p className="text-muted-foreground">{member.email}</p>
                </div>
                <span className="rounded-full bg-[#31CDFF]/15 px-2.5 py-1 text-xs font-medium text-[#272055]">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#272055]/10 bg-white p-4">
        <h3 className="font-medium text-[#272055]">External recruiters</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional contacts outside your organisation.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            value={recruiterName}
            onChange={(e) => setRecruiterName(e.target.value)}
            placeholder="Recruiter name"
          />
          <Input
            value={recruiterEmail}
            onChange={(e) => setRecruiterEmail(e.target.value)}
            placeholder="Email address"
          />
        </div>
        <Button type="button" variant="outline" className="mt-3" onClick={addRecruiter}>
          Add recruiter
        </Button>
      </div>
    </div>
  );
}

export function renderWizardStep(
  step: JobWizardStepId,
  props: StepProps
) {
  switch (step) {
    case "details":
      return <DetailsStep {...props} />;
    case "description":
      return <DescriptionStep {...props} />;
    case "application":
      return <ApplicationStep {...props} />;
    case "pipeline":
      return <PipelineStep {...props} />;
    case "screening":
      return <ScreeningStep {...props} />;
    case "advertise":
      return <AdvertiseStep {...props} />;
    case "hiring-team":
      return <HiringTeamStep {...props} />;
    default:
      return null;
  }
}
