"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/api-backend";
import type { Department, Employee } from "@/types/employee";
import {
  createEmptyEmployeeWizardState,
  documentsReadyForUpload,
  EMPLOYEE_WIZARD_STEPS,
  employeeWizardToPayload,
  validateEmployeeStep,
  type EmployeeWizardState,
  type EmployeeWizardStepId,
} from "./employee-wizard-config";
import { renderEmployeeWizardStep } from "./wizard-steps";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";

export function EmployeeSetupWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [state, setState] = useState<EmployeeWizardState>(
    createEmptyEmployeeWizardState
  );
  const [activeStep, setActiveStep] =
    useState<EmployeeWizardStepId>("personal");
  const [completedSteps, setCompletedSteps] = useState<
    Set<EmployeeWizardStepId>
  >(() => new Set());

  const { data: deptData, isLoading: deptsLoading } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () =>
      adminApi.getDepartments() as Promise<{ departments: Department[] }>,
  });
  const departments = deptData?.departments ?? [];

  const { data: empData, isLoading: managersLoading } = useQuery({
    queryKey: ["admin-employees", "managers"],
    queryFn: () =>
      adminApi.getEmployees({ limit: 500 }) as Promise<{
        employees: Employee[];
      }>,
  });
  const managers = empData?.employees ?? [];
  const orgLookupsLoading = deptsLoading || managersLoading;

  useEffect(() => {
    if (state.departmentId || !departments[0]?.id) return;
    setState((current) => ({
      ...current,
      departmentId: departments[0].id,
    }));
  }, [departments, state.departmentId]);

  useEffect(() => {
    return () => {
      if (state.avatarPreviewUrl) {
        URL.revokeObjectURL(state.avatarPreviewUrl);
      }
    };
    // Only revoke on unmount for the latest preview URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeIndex = EMPLOYEE_WIZARD_STEPS.findIndex(
    (step) => step.id === activeStep
  );
  const isLastStep = activeIndex === EMPLOYEE_WIZARD_STEPS.length - 1;
  const completedCount = completedSteps.size;

  const stepTitle = useMemo(
    () =>
      EMPLOYEE_WIZARD_STEPS.find((step) => step.id === activeStep)?.label || "",
    [activeStep]
  );

  const patchState = (patch: Partial<EmployeeWizardState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      let avatarUrl: string | undefined;
      if (state.avatarFile) {
        const uploaded = (await adminApi.uploadAdminFile(state.avatarFile)) as {
          url?: string;
        };
        avatarUrl = uploaded?.url;
      }

      const payload = {
        ...employeeWizardToPayload(state),
        ...(avatarUrl ? { avatarUrl } : {}),
      };
      const employee = (await adminApi.createEmployee(
        payload
      )) as Employee;

      const pendingDocs = documentsReadyForUpload(state);
      for (const doc of pendingDocs) {
        if (!doc.file) continue;
        const uploaded = (await adminApi.uploadAdminFile(doc.file)) as {
          url?: string;
          fileName?: string;
          fileSize?: number;
        };
        if (!uploaded?.url) {
          throw new Error(`Could not upload ${doc.label}.`);
        }
        await adminApi.uploadEmployeeDocument(employee.id, {
          name: doc.name.trim() || doc.label,
          category: doc.category,
          fileUrl: uploaded.url,
          fileName: uploaded.fileName || doc.file.name,
          fileSize: uploaded.fileSize ?? doc.file.size,
        });
      }

      let docusignSent = false;
      if (state.sendOfferViaDocusign) {
        await adminApi.sendEmployeeOfferViaDocuSign(employee.id);
        docusignSent = true;
      }

      return { employee, docusignSent };
    },
    onSuccess: ({ employee, docusignSent }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-employees"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-employee", employee.id],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-employees-onboarding"],
      });

      const inviteStatus = employee.invitePreferences?.inviteStatus;
      if (inviteStatus === "sent") {
        toast.success("Employee created. Welcome email sent.");
      } else if (inviteStatus === "failed") {
        toast.success("Employee created");
        toast.error(
          "Welcome email could not be sent. You can retry from their profile later."
        );
      } else if (inviteStatus === "deferred") {
        const timing = employee.invitePreferences?.timing;
        toast.success(
          timing === "on_start"
            ? "Employee created. Invite scheduled for their start date."
            : "Employee created. Invite marked pending for later."
        );
      } else {
        toast.success("Employee created");
      }
      if (docusignSent) {
        toast.success("Offer letter sent via DocuSign");
      }
      router.push(`/manage/employees/${employee.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not add employee");
    },
  });

  const handleClose = () => {
    router.push("/manage/employees");
  };

  const handleContinue = () => {
    const error = validateEmployeeStep(activeStep, state);
    if (error) {
      toast.error(error);
      return;
    }

    setCompletedSteps((current) => new Set(current).add(activeStep));

    if (isLastStep) {
      createMutation.mutate();
      return;
    }

    setActiveStep(EMPLOYEE_WIZARD_STEPS[activeIndex + 1].id);
  };

  const handleBack = () => {
    if (activeIndex > 0) {
      setActiveStep(EMPLOYEE_WIZARD_STEPS[activeIndex - 1].id);
    }
  };

  const isSaving = createMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-100">
      <TourPageHelper tourId="employees-new" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
        <div className="flex items-start justify-between border-b border-[#272156]/10 px-5 py-5 md:px-6 md:py-6">
          <div>
            <h1 className="text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-[#272156] md:text-[1.75rem]">
              Add Employee
            </h1>
            <p className="mt-2.5 text-sm font-normal leading-relaxed text-[#272156]/55">
              Walk through personal details, role, pay, and documents, then
              confirm to put them on the roster.
            </p>
            <p className="mt-2 text-xs font-medium text-[#31CDFF]">
              {completedCount} of {EMPLOYEE_WIZARD_STEPS.length} complete
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TourHelpButton tourId="employees-new" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close wizard"
              className="h-9 w-9 shrink-0 rounded-full border border-[#272156]/25 bg-transparent text-[#272156] transition-transform duration-100 ease-out hover:bg-[#272156]/5 hover:text-[#272156] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-5.5rem)] flex-col lg:flex-row">
          <aside className="border-b border-[#272156]/10 lg:w-64 lg:border-b-0 lg:border-r lg:border-[#272156]/10">
            <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[#272156]/45">
              Steps
            </p>
            <nav
              className="flex gap-1 overflow-x-auto p-3 pt-2 lg:flex-col lg:overflow-visible"
              data-tour="employee-wizard-steps"
            >
              {EMPLOYEE_WIZARD_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === activeStep;
                const isComplete = completedSteps.has(step.id);

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={cn(
                      "flex min-w-[150px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors lg:min-w-0",
                      isActive
                        ? "bg-[#31CDFF]/15 text-[#272156]"
                        : "text-[#272156]/70 hover:bg-[#272156]/5"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                        isActive
                          ? "border-[#31CDFF] bg-gray-100 text-[#31CDFF]"
                          : "border-[#272156]/15 bg-gray-100"
                      )}
                    >
                      {isComplete ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="text-sm font-medium">{step.label}</span>
                    {isActive && (
                      <span className="ml-auto hidden text-xs text-[#31CDFF] lg:inline">
                        {index + 1}/{EMPLOYEE_WIZARD_STEPS.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex flex-1 flex-col">
            <div className="border-b border-[#272156]/10 px-5 py-5 md:px-6">
              <h2 className="text-xl font-bold leading-[1.15] tracking-[-0.02em] text-[#272156]">
                {stepTitle}
              </h2>
            </div>

            <div
              className="flex-1 overflow-y-auto px-5 py-6 md:px-6"
              data-tour="employee-wizard-content"
            >
              {renderEmployeeWizardStep(activeStep, {
                state,
                onChange: patchState,
                departments,
                departmentsLoading: orgLookupsLoading,
                managers,
                onGoToStep: setActiveStep,
              })}
            </div>

            <div
              className="sticky bottom-0 flex items-center justify-between border-t border-[#272156]/10 bg-gray-100 px-5 py-4 md:px-6"
              data-tour="employee-wizard-actions"
            >
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={activeIndex === 0 || isSaving}
              >
                Back
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isSaving}
                >
                  Save & exit
                </Button>
                <Button
                  type="button"
                  onClick={handleContinue}
                  disabled={isSaving}
                  className="bg-[#272156] text-white hover:bg-[#272156]/90"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : isLastStep ? (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Confirm & create
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
