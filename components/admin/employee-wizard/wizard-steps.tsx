"use client";

import { useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  FileUp,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import type { Employee, Department } from "@/types/employee";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  type EmployeeStatus,
  type EmploymentType,
} from "@/types/employee";
import { fullName } from "@/lib/employees";
import { adminApi } from "@/lib/api-backend";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EmployeeWizardState,
  EmployeeWizardStepId,
  PendingWizardDocument,
} from "./employee-wizard-config";
import { EMPLOYEE_WIZARD_STEPS } from "./employee-wizard-config";
import { EmployeeWizardRoleSkeleton } from "@/components/admin/hr-skeletons";
import { publicAdminHref } from "@/lib/admin-path";

export interface StepProps {
  state: EmployeeWizardState;
  onChange: (patch: Partial<EmployeeWizardState>) => void;
  departments: Department[];
  departmentsLoading: boolean;
  managers: Employee[];
  onGoToStep?: (step: EmployeeWizardStepId) => void;
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#272156]/10 bg-white p-4 md:p-5">
      <h3 className="font-medium text-[#272156]">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

export function PersonalStep({ state, onChange }: StepProps) {
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatar = (file: File | null) => {
    if (state.avatarPreviewUrl) {
      URL.revokeObjectURL(state.avatarPreviewUrl);
    }
    if (!file) {
      onChange({ avatarFile: null, avatarPreviewUrl: "" });
      return;
    }
    onChange({
      avatarFile: file,
      avatarPreviewUrl: URL.createObjectURL(file),
    });
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="Profile photo"
        description="Shown on the employee profile and directory."
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#272156]/15 bg-[#fafbfd] text-[#272156]/50 transition-colors hover:border-[#31CDFF] hover:text-[#31CDFF]"
            aria-label="Upload profile photo"
          >
            {state.avatarPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.avatarPreviewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Camera className="h-6 w-6" />
            )}
          </button>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload photo
            </Button>
            {state.avatarFile ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => handleAvatar(null)}
              >
                Remove
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">JPG or PNG, up to 5 MB.</p>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleAvatar(e.target.files?.[0] ?? null)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Identity">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              className="mt-1.5"
              value={state.firstName}
              onChange={(e) => onChange({ firstName: e.target.value })}
              placeholder="e.g. Amina"
              autoComplete="given-name"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              className="mt-1.5"
              value={state.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              placeholder="e.g. Otieno"
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              className="mt-1.5"
              value={state.displayName}
              onChange={(e) => onChange({ displayName: e.target.value })}
              placeholder="How they prefer to be shown"
            />
          </div>
          <div>
            <Label htmlFor="pronouns">Pronouns</Label>
            <Select
              value={state.pronouns || undefined}
              onValueChange={(value) => onChange({ pronouns: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="she/her">she/her</SelectItem>
                <SelectItem value="he/him">he/him</SelectItem>
                <SelectItem value="they/them">they/them</SelectItem>
                <SelectItem value="prefer_not">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              className="mt-1.5"
              value={state.dateOfBirth}
              onChange={(e) => onChange({ dateOfBirth: e.target.value })}
            />
          </div>
          <div>
            <Label>Gender</Label>
            <Select
              value={state.gender || undefined}
              onValueChange={(value) => onChange({ gender: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="non_binary">Non-binary</SelectItem>
                <SelectItem value="prefer_not">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Marital status</Label>
            <Select
              value={state.maritalStatus || undefined}
              onValueChange={(value) => onChange({ maritalStatus: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married">Married</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
                <SelectItem value="widowed">Widowed</SelectItem>
                <SelectItem value="prefer_not">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="nationality">Nationality</Label>
          <Input
            id="nationality"
            className="mt-1.5 max-w-md"
            value={state.nationality}
            onChange={(e) => onChange({ nationality: e.target.value })}
            placeholder="e.g. Kenyan"
          />
        </div>
      </SectionCard>

      <SectionCard title="Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="personalEmail">Personal email</Label>
            <Input
              id="personalEmail"
              type="email"
              className="mt-1.5"
              value={state.personalEmail}
              onChange={(e) => onChange({ personalEmail: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              className="mt-1.5"
              value={state.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="e.g. +254 700 000 000"
              autoComplete="tel"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Home address">
        <div>
          <Label htmlFor="addressLine1">Street address</Label>
          <Input
            id="addressLine1"
            className="mt-1.5"
            value={state.addressLine1}
            onChange={(e) => onChange({ addressLine1: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="addressLine2">Line 2</Label>
          <Input
            id="addressLine2"
            className="mt-1.5"
            value={state.addressLine2}
            onChange={(e) => onChange({ addressLine2: e.target.value })}
            placeholder="Apartment, suite, etc."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="addressCity">City</Label>
            <Input
              id="addressCity"
              className="mt-1.5"
              value={state.addressCity}
              onChange={(e) => onChange({ addressCity: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="addressState">State / County</Label>
            <Input
              id="addressState"
              className="mt-1.5"
              value={state.addressState}
              onChange={(e) => onChange({ addressState: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="addressPostalCode">Postal code</Label>
            <Input
              id="addressPostalCode"
              className="mt-1.5"
              value={state.addressPostalCode}
              onChange={(e) => onChange({ addressPostalCode: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="addressCountry">Country</Label>
            <Input
              id="addressCountry"
              className="mt-1.5"
              value={state.addressCountry}
              onChange={(e) => onChange({ addressCountry: e.target.value })}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Emergency contact"
        description="Who to call if something happens at work."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            value={state.emergencyName}
            onChange={(e) => onChange({ emergencyName: e.target.value })}
            placeholder="Name"
          />
          <Input
            value={state.emergencyRelation}
            onChange={(e) => onChange({ emergencyRelation: e.target.value })}
            placeholder="Relationship"
          />
          <Input
            value={state.emergencyPhone}
            onChange={(e) => onChange({ emergencyPhone: e.target.value })}
            placeholder="Phone"
          />
        </div>
      </SectionCard>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Personal details are used for HR records and payroll setup. Only people
        with People module access can view them.
      </p>
    </div>
  );
}

export function EmploymentStep({
  state,
  onChange,
  departments,
  departmentsLoading,
  managers,
}: StepProps) {
  if (departmentsLoading) {
    return <EmployeeWizardRoleSkeleton />;
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Role">
        <div>
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            className="mt-1.5"
            value={state.jobTitle}
            onChange={(e) => onChange({ jobTitle: e.target.value })}
            placeholder="e.g. Senior Data Analyst"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="jobGrade">Grade</Label>
            <Input
              id="jobGrade"
              className="mt-1.5"
              value={state.jobGrade}
              onChange={(e) => onChange({ jobGrade: e.target.value })}
              placeholder="e.g. L4"
            />
          </div>
          <div>
            <Label>Department</Label>
            <Select
              value={state.departmentId || undefined}
              onValueChange={(value) => onChange({ departmentId: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Manager</Label>
            <Select
              value={state.managerId}
              onValueChange={(value) => onChange({ managerId: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {fullName(manager)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              className="mt-1.5"
              value={state.location}
              onChange={(e) => onChange({ location: e.target.value })}
              placeholder="e.g. Nairobi"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Terms">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Employment type</Label>
            <Select
              value={state.employmentType}
              onValueChange={(value) =>
                onChange({ employmentType: value as EmploymentType })
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]
                ).map((type) => (
                  <SelectItem key={type} value={type}>
                    {EMPLOYMENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={state.status}
              onValueChange={(value) =>
                onChange({ status: value as EmployeeStatus })
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EMPLOYEE_STATUS_LABELS) as EmployeeStatus[]).map(
                  (status) => (
                    <SelectItem key={status} value={status}>
                      {EMPLOYEE_STATUS_LABELS[status]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              className="mt-1.5"
              value={state.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="probationMonths">Probation (months)</Label>
            <Input
              id="probationMonths"
              type="number"
              min={0}
              className="mt-1.5"
              value={state.probationMonths}
              onChange={(e) => onChange({ probationMonths: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Work arrangement</Label>
            <Select
              value={state.workArrangement || undefined}
              onValueChange={(value) => onChange({ workArrangement: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="weeklyHours">Weekly hours</Label>
            <Input
              id="weeklyHours"
              type="number"
              min={0}
              className="mt-1.5"
              value={state.weeklyHours}
              onChange={(e) => onChange({ weeklyHours: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="workEmail">Work email</Label>
          <Input
            id="workEmail"
            type="email"
            className="mt-1.5 max-w-lg"
            value={state.workEmail}
            onChange={(e) => onChange({ workEmail: e.target.value })}
            placeholder="e.g. amina.otieno@company.com"
          />
        </div>
      </SectionCard>
    </div>
  );
}

export function CompensationStep({ state, onChange }: StepProps) {
  return (
    <div className="space-y-5">
      <SectionCard
        title="Pay"
        description="Amounts are stored on the employee record in the selected currency."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Currency</Label>
            <Select
              value={state.currency}
              onValueChange={(value) => onChange({ currency: value })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="KES">KES</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="baseSalary">Base salary</Label>
            <Input
              id="baseSalary"
              type="number"
              min={0}
              className="mt-1.5"
              value={state.baseSalary}
              onChange={(e) => onChange({ baseSalary: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="bonusTarget">Bonus target</Label>
            <Input
              id="bonusTarget"
              type="number"
              min={0}
              className="mt-1.5"
              value={state.bonusTarget}
              onChange={(e) => onChange({ bonusTarget: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="signOnBonus">Sign-on bonus</Label>
            <Input
              id="signOnBonus"
              type="number"
              min={0}
              className="mt-1.5"
              value={state.signOnBonus}
              onChange={(e) => onChange({ signOnBonus: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="equityValue">Equity value</Label>
            <Input
              id="equityValue"
              type="number"
              min={0}
              className="mt-1.5"
              value={state.equityValue}
              onChange={(e) => onChange({ equityValue: e.target.value })}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function DocumentSlot({
  doc,
  onUpdate,
}: {
  doc: PendingWizardDocument;
  onUpdate: (patch: Partial<PendingWizardDocument>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustom = doc.category === "other";

  return (
    <div className="rounded-xl border border-[#272156]/10 bg-[#fafbfd] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#272156]">{doc.label}</p>
          {isCustom ? (
            <Input
              className="mt-2 max-w-sm"
              value={doc.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Document name"
            />
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              PDF or image, up to 10 MB.
            </p>
          )}
          {doc.file ? (
            <p className="mt-2 truncate text-sm text-[#272156]">
              {doc.file.name}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {doc.file ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onUpdate({ file: null })}
              aria-label={`Remove ${doc.label}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <FileUp className="mr-1.5 h-3.5 w-3.5" />
            {doc.file ? "Replace" : "Upload"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/*"
            className="hidden"
            onChange={(e) => onUpdate({ file: e.target.files?.[0] ?? null })}
          />
        </div>
      </div>
    </div>
  );
}

export function DocumentsStep({ state, onChange }: StepProps) {
  const { data: docusignStatus, isLoading: docusignLoading } = useQuery({
    queryKey: ["admin-docusign-status"],
    queryFn: async () => {
      const response = await adminApi.getDocuSignIntegrationStatus();
      return (response as { status?: { connected?: boolean; configured?: boolean } })
        ?.status;
    },
    staleTime: 60_000,
  });

  const docusignConnected = Boolean(
    docusignStatus?.connected || docusignStatus?.configured
  );

  const updateDocument = (
    id: string,
    patch: Partial<PendingWizardDocument>
  ) => {
    onChange({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, ...patch } : doc
      ),
    });
  };

  const identityDocs = state.documents.filter((d) => d.id !== "offer_letter");
  const offerDoc = state.documents.find((d) => d.id === "offer_letter");

  return (
    <div className="space-y-5">
      <SectionCard
        title="Identity & KYC"
        description="Files attach to the employee after you confirm create."
      >
        <div className="space-y-3">
          {identityDocs.map((doc) => (
            <DocumentSlot
              key={doc.id}
              doc={doc}
              onUpdate={(patch) => updateDocument(doc.id, patch)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Bank details"
        description="Stored on the employee record for payroll setup."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="bankAccountName">Account name</Label>
            <Input
              id="bankAccountName"
              className="mt-1.5"
              value={state.bankAccountName}
              onChange={(e) => onChange({ bankAccountName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input
              id="bankAccountNumber"
              className="mt-1.5"
              value={state.bankAccountNumber}
              onChange={(e) => onChange({ bankAccountNumber: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="bankName">Bank</Label>
            <Input
              id="bankName"
              className="mt-1.5"
              value={state.bankName}
              onChange={(e) => onChange({ bankName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="bankBranch">Branch</Label>
            <Input
              id="bankBranch"
              className="mt-1.5"
              value={state.bankBranch}
              onChange={(e) => onChange({ bankBranch: e.target.value })}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Offer letter"
        description={
          docusignLoading
            ? "Checking DocuSign…"
            : docusignConnected
              ? state.sendOfferViaDocusign
                ? "Queued — envelope sends after you create the employee."
                : "Upload an offer PDF (optional). DocuSign uses it, or a simple placeholder."
              : "DocuSign is not connected."
        }
      >
        {offerDoc ? (
          <div className="mb-3">
            <DocumentSlot
              doc={offerDoc}
              onUpdate={(patch) => updateDocument(offerDoc.id, patch)}
            />
          </div>
        ) : null}

        {docusignConnected ? (
          <Button
            type="button"
            variant={state.sendOfferViaDocusign ? "default" : "outline"}
            className={
              state.sendOfferViaDocusign
                ? "bg-[#272156] text-white hover:bg-[#272156]/90"
                : "border-[#272156]/25 text-[#272156]"
            }
            onClick={() =>
              onChange({ sendOfferViaDocusign: !state.sendOfferViaDocusign })
            }
          >
            {state.sendOfferViaDocusign
              ? "DocuSign send queued"
              : "Send via DocuSign"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button type="button" variant="outline" disabled>
              {docusignLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Send via DocuSign
            </Button>
            {!docusignLoading ? (
              <p className="text-xs text-muted-foreground">
                Connect DocuSign in{" "}
                <Link
                  href={publicAdminHref("/manage/settings?section=integrations")}className="font-medium text-[#31CDFF] hover:underline"
                >
                  Settings → Integrations
                </Link>
                .
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function ReviewCard({
  title,
  stepId,
  onEdit,
  children,
}: {
  title: string;
  stepId: EmployeeWizardStepId;
  onEdit?: (step: EmployeeWizardStepId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#272156]/10 bg-white p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium text-[#272156]">{title}</h3>
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(stepId)}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#31CDFF] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : null}
      </div>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-3 sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="sm:col-span-2 font-medium text-[#272156]">
        {value?.trim() ? value : "—"}
      </dd>
    </div>
  );
}

export function ReviewStep({
  state,
  onChange,
  departments,
  managers,
  onGoToStep,
}: StepProps) {
  const deptName =
    departments.find((d) => d.id === state.departmentId)?.name || "";
  const managerName =
    state.managerId === "none"
      ? "No manager"
      : managers.find((m) => m.id === state.managerId)
        ? fullName(managers.find((m) => m.id === state.managerId)!)
        : "";
  const docsAttached = state.documents.filter((d) => d.file).length;

  return (
    <div className="space-y-5">
      <ReviewCard title="Personal" stepId="personal" onEdit={onGoToStep}>
        <ReviewRow
          label="Name"
          value={
            state.displayName.trim() ||
            `${state.firstName} ${state.lastName}`.trim()
          }
        />
        <ReviewRow label="Personal email" value={state.personalEmail} />
        <ReviewRow label="Phone" value={state.phone} />
        <ReviewRow label="Nationality" value={state.nationality} />
      </ReviewCard>

      <ReviewCard title="Employment" stepId="employment" onEdit={onGoToStep}>
        <ReviewRow label="Job title" value={state.jobTitle} />
        <ReviewRow label="Department" value={deptName} />
        <ReviewRow label="Manager" value={managerName} />
        <ReviewRow label="Work email" value={state.workEmail} />
        <ReviewRow label="Start date" value={state.startDate} />
        <ReviewRow
          label="Type"
          value={EMPLOYMENT_TYPE_LABELS[state.employmentType]}
        />
      </ReviewCard>

      <ReviewCard
        title="Compensation"
        stepId="compensation"
        onEdit={onGoToStep}
      >
        <ReviewRow
          label="Base salary"
          value={`${state.currency} ${state.baseSalary}`}
        />
        <ReviewRow
          label="Bonus target"
          value={`${state.currency} ${state.bonusTarget}`}
        />
        <ReviewRow
          label="Sign-on"
          value={`${state.currency} ${state.signOnBonus}`}
        />
        <ReviewRow
          label="Equity"
          value={`${state.currency} ${state.equityValue}`}
        />
      </ReviewCard>

      <ReviewCard title="Documents" stepId="documents" onEdit={onGoToStep}>
        <ReviewRow
          label="Files ready"
          value={`${docsAttached} of ${state.documents.length}`}
        />
        <ReviewRow label="Bank" value={state.bankName} />
      </ReviewCard>

      <SectionCard
        title="Invitation"
        description="Email method sends a welcome message to the work email on create (unless timing is Later)."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Method</Label>
            <Select
              value={state.inviteMethod}
              onValueChange={(value) =>
                onChange({
                  inviteMethod: value,
                  sendInvite: value === "email" ? true : false,
                })
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="manual">Manual share</SelectItem>
                <SelectItem value="none">No invite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Send timing</Label>
            <Select
              value={state.inviteTiming}
              onValueChange={(value) => onChange({ inviteTiming: value })}
              disabled={state.inviteMethod !== "email"}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Immediately</SelectItem>
                <SelectItem value="on_start">On start date</SelectItem>
                <SelectItem value="later">Later</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="welcomeMessage">Welcome message</Label>
          <Textarea
            id="welcomeMessage"
            className="mt-1.5 min-h-[100px]"
            value={state.welcomeMessage}
            onChange={(e) => onChange({ welcomeMessage: e.target.value })}
            disabled={state.inviteMethod !== "email"}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#272156]">
          <Checkbox
            checked={state.sendInvite && state.inviteMethod === "email"}
            disabled={state.inviteMethod !== "email"}
            onCheckedChange={(checked) =>
              onChange({ sendInvite: checked === true })
            }
          />
          Send invitation email
        </label>
        {state.inviteMethod === "email" && state.inviteTiming === "later" ? (
          <p className="text-xs text-muted-foreground">
            Timing Later stores a pending invite on the employee without sending
            now.
          </p>
        ) : null}
        {state.inviteMethod === "email" && state.inviteTiming === "on_start" ? (
          <p className="text-xs text-muted-foreground">
            Email sends at midnight Africa/Nairobi on the employee&apos;s start
            date. Until then it stays a pending invite.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Onboarding checklist">
        {(
          [
            ["checklistDocusign", "DocuSign offer letter"],
            ["checklistSso", "SSO account"],
            ["checklistPayroll", "Payroll setup"],
            ["checklistBuddy", "Buddy assigned"],
            ["checklistEquipment", "Equipment"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 text-sm text-[#272156]"
          >
            <Checkbox
              checked={state[key]}
              onCheckedChange={(checked) =>
                onChange({ [key]: checked === true })
              }
            />
            {label}
          </label>
        ))}
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        Steps:{" "}
        {EMPLOYEE_WIZARD_STEPS.map((s) => s.label).join(" · ")}
      </p>
    </div>
  );
}

export function renderEmployeeWizardStep(
  step: EmployeeWizardStepId,
  props: StepProps
) {
  switch (step) {
    case "personal":
      return <PersonalStep {...props} />;
    case "employment":
      return <EmploymentStep {...props} />;
    case "compensation":
      return <CompensationStep {...props} />;
    case "documents":
      return <DocumentsStep {...props} />;
    case "review":
      return <ReviewStep {...props} />;
    default:
      return null;
  }
}
