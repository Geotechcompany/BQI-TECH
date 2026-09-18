"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Employee } from "@/types/employee";
import { EmployeeMetricCard } from "../EmployeeMetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { adminApi } from "@/lib/api-backend";
import {
  ONBOARDING_CHECKLIST_ITEMS,
  canResendEmployeeInvite,
  onboardingChecklistProgress,
  type OnboardingChecklistKey,
} from "@/lib/employees";
import {
  Award,
  CalendarDays,
  ClipboardCheck,
  Loader2,
  MapPin,
  Send,
  User,
} from "lucide-react";

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-3 sm:gap-4 py-2 border-b border-border/60 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="sm:col-span-2 text-sm font-medium text-foreground">
        {value || "—"}
      </dd>
    </div>
  );
}

export function OverviewTab({ employee }: { employee: Employee }) {
  const queryClient = useQueryClient();
  const checklist = employee.onboardingChecklist ?? {};
  const progress = onboardingChecklistProgress(checklist);

  const checklistMutation = useMutation({
    mutationFn: (next: NonNullable<Employee["onboardingChecklist"]>) =>
      adminApi.updateEmployee(employee.id, { onboardingChecklist: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-employee", employee.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-employees-onboarding"],
      });
      toast.success("Checklist updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update checklist");
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: () => adminApi.resendEmployeeInvite(employee.id),
    onSuccess: (result) => {
      toast.success(result.message || `Invite sent to ${result.toEmail}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not resend invite");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-employee", employee.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-employees-onboarding"],
      });
    },
  });

  const toggleChecklist = (key: OnboardingChecklistKey, checked: boolean) => {
    checklistMutation.mutate({
      docusignOffer: Boolean(checklist.docusignOffer),
      sso: Boolean(checklist.sso),
      payroll: Boolean(checklist.payroll),
      buddy: Boolean(checklist.buddy),
      equipment: Boolean(checklist.equipment),
      [key]: checked,
    });
  };

  const addr = employee.address
    ? [
        employee.address.line1,
        employee.address.line2,
        [employee.address.city, employee.address.state, employee.address.postalCode]
          .filter(Boolean)
          .join(", "),
        employee.address.country,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const inviteStatus = employee.invitePreferences?.inviteStatus;
  const showResendInvite = canResendEmployeeInvite(employee);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <EmployeeMetricCard
          label="Tenure"
          value={`${employee.tenureYears.toFixed(1)} yrs`}
          hint={`Started ${employee.startDate}`}
          icon={CalendarDays}
          accent="navy"
        />
        <EmployeeMetricCard
          label="Leave balance"
          value={`${employee.leaveBalanceDays} days`}
          hint="Annual leave remaining"
          icon={MapPin}
          accent="cyan"
        />
        <EmployeeMetricCard
          label="Performance"
          value={
            employee.performanceRating
              ? employee.performanceRating.toFixed(1)
              : "—"
          }
          hint="Latest cycle rating"
          icon={Award}
          accent="neutral"
        />
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[#272156] dark:text-[#31CDFF]" />
            <h3 className="text-sm font-semibold">Onboarding checklist</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {progress.done}/{progress.total} done
          </span>
        </div>
        <ul className="space-y-2.5">
          {ONBOARDING_CHECKLIST_ITEMS.map((item) => (
            <li key={item.key}>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={Boolean(checklist[item.key])}
                  disabled={checklistMutation.isPending}
                  onCheckedChange={(value) =>
                    toggleChecklist(item.key, value === true)
                  }
                />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
        {inviteStatus ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Invite: {inviteStatus}
              {employee.invitePreferences?.inviteSentAt
                ? ` · sent ${employee.invitePreferences.inviteSentAt.slice(0, 10)}`
                : ""}
              {employee.invitePreferences?.pendingInvite &&
              employee.invitePreferences?.scheduledInviteAt
                ? ` · scheduled ${employee.invitePreferences.scheduledInviteAt.slice(0, 10)}`
                : employee.invitePreferences?.pendingInvite
                  ? " · pending"
                  : ""}
            </p>
            {showResendInvite ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#272156]/25 text-[#272156] hover:bg-[#272156]/5 dark:border-[#31CDFF]/40 dark:text-[#31CDFF] dark:hover:bg-[#31CDFF]/10"
                disabled={resendInviteMutation.isPending}
                onClick={() => resendInviteMutation.mutate()}
              >
                {resendInviteMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Resend invite
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-[#272156] dark:text-[#31CDFF]" />
          <h3 className="text-sm font-semibold">Personal information</h3>
        </div>
        <dl>
          <InfoRow label="Full name" value={`${employee.firstName} ${employee.lastName}`} />
          <InfoRow label="Date of birth" value={employee.dateOfBirth} />
          <InfoRow label="Nationality" value={employee.nationality} />
          <InfoRow label="Personal email" value={employee.personalEmail} />
          <InfoRow label="Phone" value={employee.phone} />
          <InfoRow label="Address" value={addr} />
          <InfoRow
            label="Emergency contact"
            value={
              employee.emergencyContact
                ? `${employee.emergencyContact.name} (${employee.emergencyContact.relation}) · ${employee.emergencyContact.phone}`
                : undefined
            }
          />
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Employment details</h3>
        <dl>
          <InfoRow label="Employee ID" value={employee.employeeNumber} />
          <InfoRow label="Work email" value={employee.workEmail} />
          <InfoRow label="Job title" value={employee.jobTitle} />
          <InfoRow label="Department" value={employee.departmentName} />
          <InfoRow label="Manager" value={employee.managerName} />
          <InfoRow label="Location" value={employee.location} />
          <InfoRow label="Employment type" value={employee.employmentType.replace("_", "-")} />
          <InfoRow label="Start date" value={employee.startDate} />
          {employee.endDate ? (
            <InfoRow label="End date" value={employee.endDate} />
          ) : null}
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Skills & tags</h3>
        {employee.skills.length === 0 && employee.tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills or tags yet.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {employee.skills.map((s) => (
                <Badge
                  key={s.name}
                  variant="secondary"
                  className="bg-[#272156]/8 text-[#272156] dark:bg-[#31CDFF]/15 dark:text-[#31CDFF]"
                >
                  {s.name}
                  {s.level ? ` · ${s.level}` : ""}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {employee.tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
