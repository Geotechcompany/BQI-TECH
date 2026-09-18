"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee, EmployeeStatus, EmploymentType } from "@/types/employee";
import type { Department } from "@/types/employee";
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

type EmployeeFormProps = {
  mode: "create" | "edit";
  initial?: Employee;
};

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
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
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
  const [baseSalary, setBaseSalary] = useState(
    String(initial?.baseSalary ?? 40000)
  );

  useEffect(() => {
    if (mode !== "create" || departmentId || !departments[0]?.id) return;
    setDepartmentId(departments[0].id);
  }, [mode, departmentId, departments]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        departmentId: departmentId || undefined,
        managerId: managerId !== "none" ? managerId : undefined,
        location: location.trim(),
        status,
        employmentType,
        startDate,
        baseSalary: Number(baseSalary) || 0,
        workEmail: email.trim(),
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
      router.push(`/manage/employees/${employee.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Save failed");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !jobTitle.trim()) {
      toast.error("Name, email, and job title are required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>

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
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
              {(
                [
                  "active",
                  "onboarding",
                  "probation",
                  "on_leave",
                  "offboarding",
                  "terminated",
                ] as EmployeeStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              {(
                ["full_time", "part_time", "contract", "intern"] as EmploymentType[]
              ).map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
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
          <Label htmlFor="baseSalary">Base salary (USD)</Label>
          <Input
            id="baseSalary"
            type="number"
            min={0}
            value={baseSalary}
            onChange={(e) => setBaseSalary(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="submit"
          disabled={saveMutation.isPending}
          className="bg-[#272156] hover:bg-[#272156]/90 text-white"
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
