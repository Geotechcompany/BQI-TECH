"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Pencil, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { employeePortalApi } from "@/lib/api-backend";
import { getMissingProfileFields } from "@/lib/employee-portal-completeness";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  type Employee,
} from "@/types/employee";
import { EmployeeAvatarUploader } from "@/components/employee/EmployeeAvatarUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, bounce: 0, duration: 0.4 };

type EditableForm = {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  personalEmail: string;
  location: string;
  dateOfBirth: string;
  nationality: string;
  pronouns: string;
  gender: string;
  maritalStatus: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
};

function toForm(employee: Employee): EditableForm {
  return {
    firstName: employee.firstName || "",
    lastName: employee.lastName || "",
    displayName: employee.displayName || "",
    phone: employee.phone || "",
    personalEmail: employee.personalEmail || "",
    location: employee.location || "",
    dateOfBirth: employee.dateOfBirth || "",
    nationality: employee.nationality || "",
    pronouns: employee.pronouns || "",
    gender: employee.gender || "",
    maritalStatus: employee.maritalStatus || "",
    addressLine1: employee.address?.line1 || "",
    addressLine2: employee.address?.line2 || "",
    addressCity: employee.address?.city || "",
    addressState: employee.address?.state || "",
    addressPostalCode: employee.address?.postalCode || "",
    addressCountry: employee.address?.country || "",
    emergencyName: employee.emergencyContact?.name || "",
    emergencyRelation: employee.emergencyContact?.relation || "",
    emergencyPhone: employee.emergencyContact?.phone || "",
  };
}

function Field({
  label,
  value,
  missing,
}: {
  label: string;
  value?: string | null;
  missing?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm",
          missing || !value
            ? "italic text-muted-foreground"
            : "text-foreground"
        )}
      >
        {value || "Not set"}
      </dd>
    </div>
  );
}

function FormField({
  id,
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-11 rounded-xl"
      />
    </div>
  );
}

export default function EmployeeProfilePage() {
  const reduceMotion = useReducedMotion();
  const press = reduceMotion ? undefined : { scale: 0.97 };
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditableForm | null>(null);

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-portal-me"],
    queryFn: () => employeePortalApi.getMe() as Promise<Employee>,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (employee && !editing) {
      setForm(toForm(employee));
    }
  }, [employee, editing]);

  const missing = useMemo(
    () => (employee ? getMissingProfileFields(employee) : []),
    [employee]
  );

  const saveMutation = useMutation({
    mutationFn: async (values: EditableForm) => {
      return employeePortalApi.updateMe({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        displayName: values.displayName.trim() || null,
        phone: values.phone.trim(),
        personalEmail: values.personalEmail.trim() || null,
        location: values.location.trim(),
        dateOfBirth: values.dateOfBirth.trim() || null,
        nationality: values.nationality.trim() || null,
        pronouns: values.pronouns.trim() || null,
        gender: values.gender.trim() || null,
        maritalStatus: values.maritalStatus.trim() || null,
        address: {
          line1: values.addressLine1.trim(),
          line2: values.addressLine2.trim() || null,
          city: values.addressCity.trim(),
          state: values.addressState.trim() || null,
          postalCode: values.addressPostalCode.trim() || null,
          country: values.addressCountry.trim(),
        },
        emergencyContact: {
          name: values.emergencyName.trim(),
          relation: values.emergencyRelation.trim(),
          phone: values.emergencyPhone.trim(),
        },
      }) as Promise<Employee>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["employee-portal-me"], updated);
      toast.success("Profile saved");
      setEditing(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Could not save profile"
      );
    },
  });

  if (isLoading || !employee || !form) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const name =
    employee.displayName ||
    `${employee.firstName} ${employee.lastName}`.trim() ||
    employee.email;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const set =
    (key: keyof EditableForm) =>
    (value: string) =>
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {missing.length > 0 ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="flex items-start gap-3 rounded-2xl border border-[#31CDFF]/35 bg-[#31CDFF]/10 px-4 py-3 backdrop-blur-md"
          data-tour="employee-portal-profile-missing"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-[#272156]"
            strokeWidth={1.75}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#272156]">
              {missing.length} field{missing.length === 1 ? "" : "s"} still needed
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {missing.map((item) => item.label).join(", ")}
            </p>
          </div>
          {!editing ? (
            <motion.div whileTap={press}>
              <Button
                size="sm"
                className="rounded-xl bg-[#272156] text-white hover:bg-[#272156]/90"
                onClick={() => {
                  setForm(toForm(employee));
                  setEditing(true);
                }}
              >
                Fill in
              </Button>
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}

      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-6"
        data-tour="employee-portal-profile-header"
      >
        <div className="flex items-center gap-4">
          <EmployeeAvatarUploader
            avatarUrl={employee.avatarUrl}
            initials={initials}
            alt={name}
          />
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
            <p className="text-sm text-muted-foreground">
              {[employee.jobTitle, employee.departmentName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        {!editing ? (
          <motion.div whileTap={press}>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setForm(toForm(employee));
                setEditing(true);
              }}
              data-tour="employee-portal-profile-edit"
            >
              <Pencil className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
              Edit profile
            </Button>
          </motion.div>
        ) : null}
      </div>

      {editing ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.firstName.trim() || !form.lastName.trim()) {
              toast.error("First and last name are required");
              return;
            }
            saveMutation.mutate(form);
          }}
          data-tour="employee-portal-profile-fields"
        >
          <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[#272156]">Contact</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField
                id="firstName"
                label="First name"
                value={form.firstName}
                onChange={set("firstName")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="lastName"
                label="Last name"
                value={form.lastName}
                onChange={set("lastName")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="displayName"
                label="Display name"
                value={form.displayName}
                onChange={set("displayName")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="phone"
                label="Phone"
                value={form.phone}
                onChange={set("phone")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="personalEmail"
                label="Personal email"
                type="email"
                value={form.personalEmail}
                onChange={set("personalEmail")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="location"
                label="Location"
                value={form.location}
                onChange={set("location")}
                disabled={saveMutation.isPending}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[#272156]">Personal</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField
                id="dateOfBirth"
                label="Date of birth"
                type="date"
                value={form.dateOfBirth}
                onChange={set("dateOfBirth")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="nationality"
                label="Nationality"
                value={form.nationality}
                onChange={set("nationality")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="pronouns"
                label="Pronouns"
                value={form.pronouns}
                onChange={set("pronouns")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="gender"
                label="Gender"
                value={form.gender}
                onChange={set("gender")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="maritalStatus"
                label="Marital status"
                value={form.maritalStatus}
                onChange={set("maritalStatus")}
                disabled={saveMutation.isPending}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[#272156]">Home address</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField
                  id="addressLine1"
                  label="Address line 1"
                  value={form.addressLine1}
                  onChange={set("addressLine1")}
                  disabled={saveMutation.isPending}
                />
              </div>
              <div className="sm:col-span-2">
                <FormField
                  id="addressLine2"
                  label="Address line 2"
                  value={form.addressLine2}
                  onChange={set("addressLine2")}
                  disabled={saveMutation.isPending}
                />
              </div>
              <FormField
                id="addressCity"
                label="City"
                value={form.addressCity}
                onChange={set("addressCity")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="addressState"
                label="State / county"
                value={form.addressState}
                onChange={set("addressState")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="addressPostalCode"
                label="Postal code"
                value={form.addressPostalCode}
                onChange={set("addressPostalCode")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="addressCountry"
                label="Country"
                value={form.addressCountry}
                onChange={set("addressCountry")}
                disabled={saveMutation.isPending}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[#272156]">
              Emergency contact
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <FormField
                id="emergencyName"
                label="Name"
                value={form.emergencyName}
                onChange={set("emergencyName")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="emergencyRelation"
                label="Relation"
                value={form.emergencyRelation}
                onChange={set("emergencyRelation")}
                disabled={saveMutation.isPending}
              />
              <FormField
                id="emergencyPhone"
                label="Phone"
                value={form.emergencyPhone}
                onChange={set("emergencyPhone")}
                disabled={saveMutation.isPending}
              />
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl active:scale-[0.97]"
              disabled={saveMutation.isPending}
              onClick={() => {
                setForm(toForm(employee));
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl bg-[#272156] text-white hover:bg-[#272156]/90 active:scale-[0.97]"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl
            className="grid gap-5 rounded-2xl border border-border/60 bg-card p-5 sm:grid-cols-2 sm:p-6"
            data-tour="employee-portal-profile-fields"
          >
            <Field label="Employee number" value={employee.employeeNumber} />
            <Field
              label="Status"
              value={EMPLOYEE_STATUS_LABELS[employee.status] || employee.status}
            />
            <Field
              label="Work email"
              value={employee.workEmail || employee.email}
            />
            <Field
              label="Phone"
              value={employee.phone}
              missing={!employee.phone}
            />
            <Field
              label="Personal email"
              value={employee.personalEmail}
              missing={!employee.personalEmail}
            />
            <Field
              label="Location"
              value={employee.location}
              missing={!employee.location}
            />
            <Field label="Manager" value={employee.managerName} />
            <Field
              label="Employment type"
              value={
                EMPLOYMENT_TYPE_LABELS[employee.employmentType] ||
                employee.employmentType
              }
            />
            <Field label="Start date" value={employee.startDate} />
            <Field label="Work arrangement" value={employee.workArrangement} />
            <Field label="Job grade" value={employee.jobGrade} />
            <Field label="Date of birth" value={employee.dateOfBirth} />
            <Field label="Nationality" value={employee.nationality} />
          </dl>

          <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[#272156]">Home address</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Street"
                value={
                  [employee.address?.line1, employee.address?.line2]
                    .filter(Boolean)
                    .join(", ") || null
                }
                missing={!employee.address?.line1}
              />
              <Field
                label="City"
                value={employee.address?.city}
                missing={!employee.address?.city}
              />
              <Field label="State / county" value={employee.address?.state} />
              <Field label="Postal code" value={employee.address?.postalCode} />
              <Field
                label="Country"
                value={employee.address?.country}
                missing={!employee.address?.country}
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[#272156]">
              Emergency contact
            </h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field
                label="Name"
                value={employee.emergencyContact?.name}
                missing={!employee.emergencyContact?.name}
              />
              <Field
                label="Relation"
                value={employee.emergencyContact?.relation}
              />
              <Field
                label="Phone"
                value={employee.emergencyContact?.phone}
                missing={!employee.emergencyContact?.phone}
              />
            </dl>
          </section>

          <p className="text-xs text-muted-foreground">
            Job title, department, employment status, and pay are managed by HR.
          </p>
        </>
      )}
    </div>
  );
}
