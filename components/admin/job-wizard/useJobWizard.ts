"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export interface FinishWizardResult {
  jobId: string;
  title: string;
  isActive: boolean;
}
import { authService } from "@/lib/auth-backend";
import { adminApi } from "@/lib/api-backend";
import { JobWizardState } from "@/types/job-wizard";
import {
  createEmptyWizardState,
  flattenQuestionnaires,
  jobToWizardState,
  questionnairesFromQuestions,
  wizardStateToPayload,
} from "./job-wizard-config";

const API_BASE = process.env.NEXT_PUBLIC_PYTHON_API_URL;

async function authFetch(url: string, options: RequestInit = {}) {
  const session = authService.getSession();
  if (!session) throw new Error("No authentication session");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
    Accept: "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  let response = await fetch(url, { ...options, credentials: "include", headers });

  if (response.status === 401) {
    const refreshed = await authService.refreshToken();
    if (!refreshed) throw new Error("Session expired");
    response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: { ...headers, Authorization: `Bearer ${refreshed.access_token}` },
    });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body?.detail;
    if (typeof detail === "string" && detail.trim()) {
      throw new Error(detail);
    }
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const message =
        typeof detail.message === "string" && detail.message.trim()
          ? detail.message
          : Array.isArray(detail.missingFields) && detail.missingFields.length
            ? `Cannot activate position. Missing required fields: ${detail.missingFields.join(", ")}`
            : "Request failed";
      throw new Error(message);
    }
    throw new Error(body?.message || "Request failed");
  }

  return response.json();
}

export function useJobWizard(jobId?: string) {
  const router = useRouter();
  const [state, setState] = useState<JobWizardState>(createEmptyWizardState);
  const [savedJobId, setSavedJobId] = useState<string | undefined>(jobId);
  /** Lifecycle when the job was loaded; used so Save progress does not unpublish a live role. */
  const [loadedStatus, setLoadedStatus] = useState<
    JobWizardState["status"] | null
  >(jobId ? null : "draft");
  const [isLoading, setIsLoading] = useState(Boolean(jobId));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const job = await authFetch(`${API_BASE}/api/admin/job-postings/${jobId}`);
        if (cancelled) return;

        let customQuestions = job.customQuestions || [];
        try {
          const questions = await adminApi.getQuestions(jobId);
          if (Array.isArray(questions) && questions.length && !customQuestions.length) {
            customQuestions = questions.map((q: Record<string, unknown>) => ({
              id: String(q.id || q._id),
              question: String(q.question || ""),
              type: (q.type as JobWizardState["customQuestions"][0]["type"]) || "text",
              required: Boolean(q.required),
              options: Array.isArray(q.options) ? q.options : [],
            }));
          }
        } catch {
          // Questions are optional for the wizard load path.
        }

        const baseState = jobToWizardState(job);
        const questionnaires =
          baseState.questionnaires.length > 0
            ? baseState.questionnaires
            : questionnairesFromQuestions(customQuestions);

        setState({
          ...baseState,
          questionnaires,
          customQuestions:
            questionnaires.length > 0
              ? flattenQuestionnaires(questionnaires)
              : customQuestions,
        });
        setLoadedStatus(baseState.status);
        setSavedJobId(jobId);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load position");
        router.push("/admin/job-postings");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId, router]);

  const persistJob = useCallback(
    async (wizardState: JobWizardState, options?: { forceDraft?: boolean }) => {
      const payload = wizardStateToPayload(wizardState, options);
      const targetId = savedJobId;

      if (targetId) {
        return authFetch(`${API_BASE}/api/admin/job-postings/${targetId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }

      const created = await authFetch(`${API_BASE}/api/admin/job-postings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const newId = String(created.id || created._id);
      setSavedJobId(newId);
      return created;
    },
    [savedJobId]
  );

  const syncCustomQuestions = useCallback(
    async (wizardState: JobWizardState, targetJobId: string) => {
      const questions = flattenQuestionnaires(wizardState.questionnaires);
      for (const [index, question] of questions.entries()) {
        if (!question.question.trim()) continue;
        if (question.id.startsWith("new-")) {
          await adminApi.createQuestion({
            jobIds: [targetJobId],
            question: question.question,
            type: question.type,
            options: question.options,
            required: question.required,
            order: index + 1,
          });
        }
      }
    },
    []
  );

  const saveProgress = useCallback(async () => {
    setIsSaving(true);
    try {
      // Mid-wizard saves stay draft unless this role was already live when opened.
      // Keep local isActive so the Advertise toggle still reflects Finish intent.
      const forceDraft = loadedStatus !== "active";
      const result = await persistJob(state, { forceDraft });
      const targetId = savedJobId || String(result.id || result._id);
      if (targetId) {
        await syncCustomQuestions(state, targetId);
      }
      toast.success("Progress saved");
      return targetId;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [loadedStatus, persistJob, savedJobId, state, syncCustomQuestions]);

  const finishWizard = useCallback(async (): Promise<FinishWizardResult> => {
    setIsSaving(true);
    try {
      const nextStatus: JobWizardState["status"] = state.isActive
        ? "active"
        : loadedStatus === "active" || loadedStatus === "inactive"
          ? "inactive"
          : "draft";
      const finishState: JobWizardState = {
        ...state,
        status: nextStatus,
      };
      const result = await persistJob(finishState);
      const targetId = savedJobId || String(result.id || result._id);
      if (targetId) {
        await syncCustomQuestions(finishState, targetId);
      }
      setLoadedStatus(nextStatus);
      setState(finishState);
      return {
        jobId: targetId,
        title: state.title,
        isActive: state.isActive,
      };
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save position");
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [loadedStatus, persistJob, savedJobId, state, syncCustomQuestions]);

  return {
    state,
    setState,
    savedJobId,
    isLoading,
    isSaving,
    saveProgress,
    finishWizard,
  };
}
