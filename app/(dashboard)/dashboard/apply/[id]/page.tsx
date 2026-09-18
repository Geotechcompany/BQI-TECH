"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FormSkeleton } from "@/components/ui/skeleton";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";
import { BACKEND_URL } from "@/lib/config";
import { userApi } from "@/lib/api-backend";
import { CandidateApplicationForm } from "@/components/apply/CandidateApplicationForm";
import type { CandidateApplicationQuestion } from "@/components/apply/candidate-application-types";
import { normalizeCandidateQuestionType } from "@/components/apply/candidate-application-utils";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";

function ApplicationForm() {
  const router = useRouter();
  const { id } = useParams();
  const { user, authLoading } = useAuth();
  const [submitComplete, setSubmitComplete] = useState(false);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`${BACKEND_URL}/api/jobs/${id}`, {
        headers: {
          Authorization: `Bearer ${authService.getSession()?.token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch job");
      return response.json();
    },
    enabled: !!id,
  });

  const { data: hasApplied = false, isLoading: hasAppliedLoading } = useQuery({
    queryKey: ["hasApplied", id, user?.id],
    queryFn: async () => {
      if (!id) return false;
      return userApi.hasApplied(String(id));
    },
    enabled: !!id && !!user,
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["jobQuestions", id],
    queryFn: async () => {
      if (!id) return [];
      const response = await fetch(`${BACKEND_URL}/api/jobs/${id}/questions`, {
        headers: {
          Authorization: `Bearer ${authService.getSession()?.token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch questions");
      }
      return response.json();
    },
    enabled: !!id,
  });

  const normalizedQuestions = useMemo((): CandidateApplicationQuestion[] => {
    if (!Array.isArray(questions)) return [];
    const mapped: CandidateApplicationQuestion[] = [];
    for (const question of questions as Record<string, unknown>[]) {
      const fieldId = String(question._id || question.id || "");
      if (!fieldId) continue;
      mapped.push({
        id: fieldId,
        _id: question._id ? String(question._id) : undefined,
        question: String(question.question || ""),
        type: normalizeCandidateQuestionType(question.type),
        required: Boolean(question.required),
        options: Array.isArray(question.options)
          ? question.options.map(String)
          : [],
      });
    }
    return mapped;
  }, [questions]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/dashboard/apply/${id}`);
    }
  }, [user, authLoading, router, id]);

  useEffect(() => {
    if (hasApplied) {
      toast.error("You have already applied for this position");
      router.push("/dashboard/applications");
    }
  }, [hasApplied, router]);

  useEffect(() => {
    if (id === "undefined" || !id) {
      toast.error("Invalid job application. Redirecting to jobs page...");
      router.push("/dashboard/jobs");
    }
  }, [id, router]);

  const isLoading =
    authLoading || jobLoading || questionsLoading || hasAppliedLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <FormSkeleton />
      </div>
    );
  }

  if (!user || submitComplete) {
    return null;
  }

  if (!job) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
          <ExclamationTriangleIcon className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-[#272156] dark:text-foreground">
          Job not found
        </h1>
        <p className="text-sm text-muted-foreground">
          This posting is missing or no longer available.
        </p>
        <Button
          className="bg-[#272156] text-white hover:bg-[#272156]/90"
          onClick={() => router.push("/dashboard/jobs")}
        >
          Browse jobs
        </Button>
      </div>
    );
  }

  const uploadFile = async (file: File): Promise<string> => {
    const uploadWithToken = async (token: string): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${BACKEND_URL}/api/upload/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        const refreshed = await authService.refreshToken();
        if (refreshed) {
          return uploadWithToken(authService.getSession()?.token || "");
        }
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.detail || "Upload failed");
      }

      const payload = await response.json();
      return String(payload.url);
    };

    return uploadWithToken(authService.getSession()?.token || "");
  };

  const submitApplication = async ({
    answers,
  }: {
    values: Record<string, string>;
    answers: Array<{
      questionId: string;
      questionText: string;
      answer: string;
    }>;
  }) => {
    const applicationData = {
      jobId: id,
      answers,
      status: "New",
      appliedDate: new Date().toISOString(),
      userId: user.id,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(`${BACKEND_URL}/api/applications/`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${authService.getSession()?.token}`,
        },
        body: JSON.stringify(applicationData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = "Failed to submit application";
        try {
          const result = await response.json();
          errorDetail = result?.detail || result?.message || errorDetail;

          const normalized = errorDetail.toLowerCase();
          if (
            (response.status === 400 || response.status === 409) &&
            normalized.includes("already applied")
          ) {
            toast.error("You have already applied for this position");
            router.push("/dashboard/applications");
            return;
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
          errorDetail = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorDetail);
      }

      await response.json();
      setSubmitComplete(true);
      toast.success("Application submitted successfully!");
      router.push("/dashboard/apply/thank-you");
    } catch (error) {
      console.error("Application submission error:", error);

      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const verifyRes = await fetch(`${BACKEND_URL}/api/applications/user`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${authService.getSession()?.token}`,
          },
        });

        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          const list = Array.isArray(verifyData?.applications)
            ? verifyData.applications
            : Array.isArray(verifyData)
              ? verifyData
              : [];
          const exists = list.some(
            (application: { jobId?: string }) =>
              String(application.jobId) === String(id)
          );

          if (exists) {
            setSubmitComplete(true);
            toast.success("Application submitted successfully!");
            router.push("/dashboard/apply/thank-you");
            return;
          }
        }
      } catch (verifyError) {
        console.error("Verification error:", verifyError);
      }

      throw new Error(
        "Network error occurred. Please check your connection and try again."
      );
    }
  };

  return (
    <>
      <TourPageHelper tourId="user-apply" />
      <CandidateApplicationForm
        title={job?.title || "Job application"}
        questions={normalizedQuestions}
        mode="live"
        subtitle="Complete each section, then submit your application."
        jobMeta={{
          department: job?.department ? String(job.department) : undefined,
          location: job?.location ? String(job.location) : undefined,
          employmentType: job?.employmentType
            ? String(job.employmentType)
            : undefined,
        }}
        onSubmitApplication={submitApplication}
        onUploadFile={uploadFile}
        onSessionExpired={() =>
          router.push(`/login?redirect=/dashboard/apply/${id}`)
        }
      />
    </>
  );
}

export default function ApplyPage() {
  return <ApplicationForm />;
}
