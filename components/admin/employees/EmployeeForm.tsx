"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Employee,
  EmployeeStatus,
  EmploymentType,
  OnboardingStage,
  OffboardingStage,
} from "@/types/employee";
import type { Department } from "@/types/employee";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/types/employee";
import { fullName } from "@/lib/employees";
import { adminApi } from "@/lib/api-backend";
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
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { publicAdminHref } from "@/lib/admin-path";

type EmployeeFormProps = {
  mode: "create" | "edit";
  initial?: Employee;
};

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
    <div className="rounded-xl border border-[#272156]/10 bg-white p-4 dark:border-border dark:bg-card md:p-5">
      <h3 className="font-medium text-[#272156] dark:text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

const ONBOARDING_STAGES: OnboardingStage[] = [
  "paperwork",
  "it_setup",
  "orientation",
  "buddy_assigned",
  "complete",
];

const OFFBOARDING_STAGES: OffboardingStage[] = [
  "notice",
  "knowledge_transfer",
  "asset_return",
  "exit_interview",
  "complete",
];

function stageLabel(value: string) {
  return value.replace(/_/g, " ");
}

function parseSkills(
  raw: string,
  previous: Employee["skills"] = []
): Employee["skills"] {
  const previousByName = new Map(
    previous.map((skill) => [skill.name.toLowerCase(), skill])
  );
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => {
      const existing = previousByName.get(name.toLowerCase());
      return existing?.level
        ? { name, level: existing.level }
        : { name };
    });
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function EmployeeForm({ mode, initial }: EmployeeFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: deptData, isLoading: deptsLoading } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () =>
      adminApi.getDepartments() as Promise<{ departments: Department[] }>,
  });
  const departments = deptData?.departments ?? [];

  const { data: empData } = useQuery({
    queryKey: ["admin-employees", "managers"],
    queryFn: () =>
      adminApi.getEmployees({ limit: 500 }) as Promise<{ employees: Employee[] }>,
  });
  const managers = useMemo(
    () => (empData?.employees ?? []).filter((e) => e.id !== initial?.id),
    [empData?.employees, initial?.id]
  );

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [pronouns, setPronouns] = useState(initial?.pronouns ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [maritalStatus, setMaritalStatus] = useState(
    initial?.maritalStatus ?? ""
  );
  const [nationality, setNationality] = useState(initial?.nationality ?? "");

  const [email, setEmail] = useState(
    initial?.workEmail || initial?.email || ""
  );
  const [personalEmail, setPersonalEmail] = useState(
    initial?.personalEmail ?? ""
  );
  const [phone, setPhone] = useState(initial?.phone ?? "");

  const [addressLine1, setAddressLine1] = useState(
    initial?.address?.line1 ?? ""
  );
  const [addressLine2, setAddressLine2] = useState(
    initial?.address?.line2 ?? ""
  );
  const [addressCity, setAddressCity] = useState(initial?.address?.city ?? "");
  const [addressState, setAddressState] = useState(
    initial?.address?.state ?? ""
  );
  const [addressPostalCode, setAddressPostalCode] = useState(
    initial?.address?.postalCode ?? ""
  );
  const [addressCountry, setAddressCountry] = useState(
    initial?.address?.country ?? "Kenya"
  );

  const [emergencyName, setEmergencyName] = useState(
    initial?.emergencyContact?.name ?? ""
  );
  const [emergencyRelation, setEmergencyRelation] = useState(
    initial?.emergencyContact?.relation ?? ""
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    initial?.emergencyContact?.phone ?? ""
  );

  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [jobGrade, setJobGrade] = useState(initial?.jobGrade ?? "");
  const [departmentId, setDepartmentId] = useState(
    initial?.departmentId ?? ""
  );
  const [managerId, setManagerId] = useState(initial?.managerId ?? "none");
  const [location, setLocation] = useState(initial?.location ?? "Nairobi");
  const [status, setStatus] = useState<EmployeeStatus>(
    initial?.status ?? "onboarding"
  );
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    initial?.employmentType ?? "full_time"
  );
  const [startDate, setStartDate] = useState(
    initial?.startDate ?? new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [probationMonths, setProbationMonths] = useState(
    initial?.probationMonths != null ? String(initial.probationMonths) : ""
  );
  const [workArrangement, setWorkArrangement] = useState(
    initial?.workArrangement ?? ""
  );
  const [weeklyHours, setWeeklyHours] = useState(
    initial?.weeklyHours != null ? String(initial.weeklyHours) : ""
  );
  const [onboardingStage, setOnboardingStage] = useState(
    initial?.onboardingStage ?? ""
  );
  const [offboardingStage, setOffboardingStage] = useState(
    initial?.offboardingStage ?? ""
  );

  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [baseSalary, setBaseSalary] = useState(
    String(initial?.baseSalary ?? 40000)
  );
  const [bonusTarget, setBonusTarget] = useState(
    String(initial?.bonusTarget ?? 0)
  );
  const [signOnBonus, setSignOnBonus] = useState(
    String(initial?.signOnBonus ?? 0)
  );
  const [equityValue, setEquityValue] = useState(
    String(initial?.equityValue ?? 0)
  );
  const [bankAccountName, setBankAccountName] = useState(
    initial?.bankDetails?.accountName ?? ""
  );
  const [bankAccountNumber, setBankAccountNumber] = useState(
    initial?.bankDetails?.accountNumber ?? ""
  );
  const [bankName, setBankName] = useState(initial?.bankDetails?.bankName ?? "");
  const [bankBranch, setBankBranch] = useState(
    initial?.bankDetails?.branch ?? ""
  );

  const [skillsRaw, setSkillsRaw] = useState(
    (initial?.skills ?? []).map((s) => s.name).join(", ")
  );
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [leaveBalanceDays, setLeaveBalanceDays] = useState(
    String(initial?.leaveBalanceDays ?? 0)
  );
  const [performanceRating, setPerformanceRating] = useState(
    String(initial?.performanceRating ?? 0)
  );

  useEffect(() => {
    if (mode !== "create" || departmentId || !departments[0]?.id) return;
    setDepartmentId(departments[0].id);
  }, [mode, departmentId, departments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const workEmail = email.trim().toLowerCase();
      const hasAddress = [addressLine1, addressCity, addressCountry].some((v) =>
        v.trim()
      );
      const hasEmergency = [emergencyName, emergencyRelation, emergencyPhone].some(
        (v) => v.trim()
      );
      const hasBank = [bankAccountName, bankAccountNumber, bankName].some((v) =>
        v.trim()
      );

      const base = Number(baseSalary) || 0;
      const bonus = Number(bonusTarget) || 0;
      const equity = Number(equityValue) || 0;
      const signOn = Number(signOnBonus) || 0;

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName:
          displayName.trim() ||
          `${firstName.trim()} ${lastName.trim()}`.trim() ||
          undefined,
        pronouns: pronouns.trim() || undefined,
        gender: gender.trim() || undefined,
        maritalStatus: maritalStatus.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        nationality: nationality.trim() || undefined,
        email: workEmail,
        workEmail,
        personalEmail: personalEmail.trim() || undefined,
        phone: phone.trim(),
        address: hasAddress
          ? {
              line1: addressLine1.trim(),
              line2: addressLine2.trim() || undefined,
              city: addressCity.trim(),
              state: addressState.trim() || undefined,
              postalCode: addressPostalCode.trim() || undefined,
              country: addressCountry.trim(),
            }
          : mode === "edit"
            ? null
            : undefined,
        emergencyContact: hasEmergency
          ? {
              name: emergencyName.trim(),
              relation: emergencyRelation.trim(),
              phone: emergencyPhone.trim(),
            }
          : mode === "edit"
            ? null
            : undefined,
        jobTitle: jobTitle.trim(),
        jobGrade: jobGrade.trim() || undefined,
        departmentId: departmentId || undefined,
        location: location.trim(),
        status,
        employmentType,
        startDate,
        endDate: endDate || undefined,
        probationMonths: probationMonths
          ? Number(probationMonths) || undefined
          : undefined,
        workArrangement: workArrangement.trim() || undefined,
        weeklyHours: weeklyHours ? Number(weeklyHours) || undefined : undefined,
        onboardingStage: (onboardingStage || undefined) as
          | OnboardingStage
          | undefined,
        offboardingStage: (offboardingStage || undefined) as
          | OffboardingStage
          | undefined,
        currency: currency || "USD",
        baseSalary: base,
        bonusTarget: bonus,
        signOnBonus: signOn,
        equityValue: equity,
        totalCompensation: base + bonus + equity,
        bankDetails: hasBank
          ? {
              accountName: bankAccountName.trim(),
              accountNumber: bankAccountNumber.trim(),
              bankName: bankName.trim(),
              branch: bankBranch.trim() || undefined,
            }
          : mode === "edit"
            ? null
            : undefined,
        managerId: managerId !== "none" ? managerId : mode === "edit" ? null : undefined,
        skills: parseSkills(skillsRaw, initial?.skills ?? []),
        tags: parseTags(tagsRaw),
        leaveBalanceDays: Number(leaveBalanceDays) || 0,
        performanceRating: Number(performanceRating) || 0,
      };

      if (mode === "create") {
        return adminApi.createEmployee(payload) as Promise<Employee>;
      }
      return adminApi.updateEmployee(initial!.id, payload) as Promise<Employee>;
    },
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
      queryClient.invalidateQueries({ queryKey: ["admin-employee", employee.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      toast.success(mode === "create" ? "Employee added" : "Employee updated");
      router.push(publicAdminHref(`/manage/employees/${employee.id}`));
    },
    onError: (err: Error) => {
      toast.error(err.message || "Save failed");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !jobTitle.trim()) {
      toast.error("Name, work email, and job title are required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5">
      <SectionCard title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How they prefer to be shown"
            />
          </div>
          <div className="space-y-2">
            <Label>Pronouns</Label>
            <Select
              value={pronouns || undefined}
              onValueChange={setPronouns}
            >
              <SelectTrigger>
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
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={gender || undefined} onValueChange={setGender}>
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label>Marital status</Label>
            <Select
              value={maritalStatus || undefined}
              onValueChange={setMaritalStatus}
            >
              <SelectTrigger>
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
        <div className="space-y-2">
          <Label htmlFor="nationality">Nationality</Label>
          <Input
            id="nationality"
            className="max-w-md"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="e.g. Kenyan"
          />
        </div>
      </SectionCard>

      <SectionCard title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personalEmail">Personal email</Label>
            <Input
              id="personalEmail"
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            className="max-w-md"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
      </SectionCard>

      <SectionCard title="Home address">
        <div className="space-y-2">
          <Label htmlFor="addressLine1">Street address</Label>
          <Input
            id="addressLine1"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="addressLine2">Line 2</Label>
          <Input
            id="addressLine2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="Apartment, suite, etc."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="addressCity">City</Label>
            <Input
              id="addressCity"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressState">State / County</Label>
            <Input
              id="addressState"
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="addressPostalCode">Postal code</Label>
            <Input
              id="addressPostalCode"
              value={addressPostalCode}
              onChange={(e) => setAddressPostalCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressCountry">Country</Label>
            <Input
              id="addressCountry"
              value={addressCountry}
              onChange={(e) => setAddressCountry(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Emergency contact"
        description="Who to call if something happens at work."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={emergencyName}
            onChange={(e) => setEmergencyName(e.target.value)}
            placeholder="Name"
            aria-label="Emergency contact name"
          />
          <Input
            value={emergencyRelation}
            onChange={(e) => setEmergencyRelation(e.target.value)}
            placeholder="Relationship"
            aria-label="Emergency contact relationship"
          />
          <Input
            value={emergencyPhone}
            onChange={(e) => setEmergencyPhone(e.target.value)}
            placeholder="Phone"
            aria-label="Emergency contact phone"
          />
        </div>
      </SectionCard>

      <SectionCard title="Role">
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="jobGrade">Grade</Label>
            <Input
              id="jobGrade"
              value={jobGrade}
              onChange={(e) => setJobGrade(e.target.value)}
              placeholder="e.g. L4"
            />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={departmentId || undefined}
              onValueChange={setDepartmentId}
              disabled={deptsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {fullName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Terms">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Employment type</Label>
            <Select
              value={employmentType}
              onValueChange={(v) => setEmploymentType(v as EmploymentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map(
                  (t) => (
                    <SelectItem key={t} value={t}>
                      {EMPLOYMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as EmployeeStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EMPLOYEE_STATUS_LABELS) as EmployeeStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {EMPLOYEE_STATUS_LABELS[s]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="probationMonths">Probation (months)</Label>
            <Input
              id="probationMonths"
              type="number"
              min={0}
              value={probationMonths}
              onChange={(e) => setProbationMonths(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weeklyHours">Weekly hours</Label>
            <Input
              id="weeklyHours"
              type="number"
              min={0}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Work arrangement</Label>
            <Select
              value={workArrangement || undefined}
              onValueChange={setWorkArrangement}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Onboarding stage</Label>
            <Select
              value={onboardingStage || "none"}
              onValueChange={(v) =>
                setOnboardingStage(v === "none" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {ONBOARDING_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Offboarding stage</Label>
          <Select
            value={offboardingStage || "none"}
            onValueChange={(v) =>
              setOffboardingStage(v === "none" ? "" : v)
            }
          >
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {OFFBOARDING_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {stageLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <SectionCard
        title="Compensation"
        description="Amounts are stored on the employee record in the selected currency."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label htmlFor="baseSalary">Base salary</Label>
            <Input
              id="baseSalary"
              type="number"
              min={0}
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bonusTarget">Bonus target</Label>
            <Input
              id="bonusTarget"
              type="number"
              min={0}
              value={bonusTarget}
              onChange={(e) => setBonusTarget(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signOnBonus">Sign-on bonus</Label>
            <Input
              id="signOnBonus"
              type="number"
              min={0}
              value={signOnBonus}
              onChange={(e) => setSignOnBonus(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="equityValue">Equity value</Label>
            <Input
              id="equityValue"
              type="number"
              min={0}
              value={equityValue}
              onChange={(e) => setEquityValue(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Bank details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bankAccountName">Account name</Label>
            <Input
              id="bankAccountName"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input
              id="bankAccountNumber"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bankName">Bank name</Label>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankBranch">Branch</Label>
            <Input
              id="bankBranch"
              value={bankBranch}
              onChange={(e) => setBankBranch(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Skills, tags & metrics"
        description="Skills and tags are comma-separated. Leave balance and rating appear on the profile overview."
      >
        <div className="space-y-2">
          <Label htmlFor="skills">Skills</Label>
          <Input
            id="skills"
            value={skillsRaw}
            onChange={(e) => setSkillsRaw(e.target.value)}
            placeholder="e.g. TypeScript, Accela, Reporting"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="e.g. remote-ready, bilingual"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="leaveBalanceDays">Leave balance (days)</Label>
            <Input
              id="leaveBalanceDays"
              type="number"
              min={0}
              step={0.5}
              value={leaveBalanceDays}
              onChange={(e) => setLeaveBalanceDays(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="performanceRating">Performance rating</Label>
            <Input
              id="performanceRating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={performanceRating}
              onChange={(e) => setPerformanceRating(e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="submit"
          disabled={saveMutation.isPending}
          className="bg-[#272156] text-white hover:bg-[#272156]/90 active:scale-[0.97]"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : mode === "create" ? (
            "Add employee"
          ) : (
            "Save changes"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              initial ? `/manage/employees/${initial.id}` : "/manage/employees"
            )
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
