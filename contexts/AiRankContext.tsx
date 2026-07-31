"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { adminApplicationsApi } from "@/components/admin/utils/applications-api";
import {
  type AiRankProgressState,
  cycleAiRankPhase,
} from "@/components/admin/AiRankProgress";

type RankResult = Awaited<
  ReturnType<typeof adminApplicationsApi.rankApplications>
>["results"][number];

export interface AiRankCompletePayload {
  ranked: number;
  errors: Array<{ id: string; error: string }>;
  results: RankResult[];
}

export interface AiRankOptions {
  candidateName?: string;
  mode?: AiRankProgressState["mode"];
  onComplete?: (payload: AiRankCompletePayload) => void;
}

interface AiRankContextValue {
  progress: AiRankProgressState | null;
  isBackground: boolean;
  isRanking: boolean;
  inFlightApplicationIds: string[];
  rankingApplicationId: string | null;
  rankApplications: (
    ids: string[],
    resolveName?: (id: string) => string | undefined,
    options?: AiRankOptions
  ) => Promise<AiRankCompletePayload>;
  rankApplication: (
    applicationId: string,
    options?: AiRankOptions
  ) => Promise<AiRankCompletePayload>;
  sendToBackground: () => void;
  expandOverlay: () => void;
}

const AiRankContext = createContext<AiRankContextValue | null>(null);

const EMPTY_RANK_RESULT: AiRankCompletePayload = {
  ranked: 0,
  errors: [],
  results: [],
};

const AI_RANK_FALLBACK: AiRankContextValue = {
  progress: null,
  isBackground: false,
  isRanking: false,
  inFlightApplicationIds: [],
  rankingApplicationId: null,
  rankApplications: async () => EMPTY_RANK_RESULT,
  rankApplication: async () => EMPTY_RANK_RESULT,
  sendToBackground: () => {},
  expandOverlay: () => {},
};

const LLM_PHASE_INTERVAL_MS = 2200;
const SAVE_FLASH_MS = 450;
const COMPLETE_FLASH_MS = 500;

export function AiRankProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<AiRankProgressState | null>(null);
  const [isBackground, setIsBackground] = useState(false);
  const [inFlightApplicationIds, setInFlightApplicationIds] = useState<string[]>([]);
  const inFlightIdsRef = useRef(new Set<string>());
  const sessionActiveRef = useRef(false);

  const invalidateAfterRank = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["cv-vault"] });
  }, [queryClient]);

  const notifyComplete = useCallback(
    (
      ranked: number,
      errors: Array<{ id: string; error: string }>,
      candidateNames: string[]
    ) => {
      invalidateAfterRank();

      if (errors.length && !ranked) {
        toast.error(errors[0]?.error || "AI ranking failed");
        return;
      }

      if (errors.length && ranked) {
        toast.success(
          `Ranked ${ranked} candidate${ranked === 1 ? "" : "s"}. ${errors.length} failed.`
        );
        return;
      }

      if (ranked === 1 && candidateNames[0]) {
        toast.success(`AI ranking complete for ${candidateNames[0]}`);
        return;
      }

      if (ranked > 0) {
        toast.success(`AI ranking complete for ${ranked} candidates`);
      }
    },
    [invalidateAfterRank]
  );

  const rankApplications = useCallback(
    async (
      ids: string[],
      resolveName?: (id: string) => string | undefined,
      options?: AiRankOptions
    ): Promise<AiRankCompletePayload> => {
      const uniqueIds = [...new Set(ids.filter(Boolean))];
      if (!uniqueIds.length) {
        toast.error("No applications to rank");
        return { ranked: 0, errors: [], results: [] };
      }

      const blocked = uniqueIds.filter((id) => inFlightIdsRef.current.has(id));
      if (blocked.length === uniqueIds.length) {
        toast.error("AI ranking is already in progress for this candidate");
        return { ranked: 0, errors: [], results: [] };
      }

      const targetIds = uniqueIds.filter((id) => !inFlightIdsRef.current.has(id));
      if (!targetIds.length) {
        toast.error("AI ranking is already in progress");
        return { ranked: 0, errors: [], results: [] };
      }

      if (sessionActiveRef.current) {
        toast.error("AI ranking is already in progress");
        return { ranked: 0, errors: [], results: [] };
      }

      sessionActiveRef.current = true;
      targetIds.forEach((id) => inFlightIdsRef.current.add(id));
      setInFlightApplicationIds(Array.from(inFlightIdsRef.current));

      const mode = options?.mode ?? (targetIds.length === 1 ? "single" : "batch");
      setIsBackground(false);

      let rankedCount = 0;
      const errors: Array<{ id: string; error: string }> = [];
      const allResults: RankResult[] = [];
      const completedNames: string[] = [];

      try {
        setProgress({
          isActive: true,
          current: 0,
          total: targetIds.length,
          phase: "extracting",
          mode,
          candidateName: undefined,
        });

        for (let index = 0; index < targetIds.length; index++) {
          const applicationId = targetIds[index];
          const candidateName =
            options?.candidateName && targetIds.length === 1
              ? options.candidateName
              : resolveName?.(applicationId) ?? "Candidate";
          const candidateStartedAt = Date.now();

          setProgress({
            isActive: true,
            current: index,
            total: targetIds.length,
            phase: "extracting",
            mode,
            applicationId,
            candidateName,
            candidateStartedAt,
          });

          let phaseInterval: number | undefined;

          try {
            phaseInterval = window.setInterval(() => {
              setProgress((current) =>
                current?.isActive && current.phase !== "saving"
                  ? { ...current, phase: cycleAiRankPhase(current.phase) }
                  : current
              );
            }, LLM_PHASE_INTERVAL_MS);

            const result = await adminApplicationsApi.rankApplications({
              ids: [applicationId],
            });

            window.clearInterval(phaseInterval);
            phaseInterval = undefined;

            setProgress((current) =>
              current?.isActive ? { ...current, phase: "saving" } : current
            );
            await new Promise((resolve) => window.setTimeout(resolve, SAVE_FLASH_MS));

            if (result.results?.length) {
              allResults.push(...result.results);
            }
            if (result.errors?.length) {
              errors.push(...result.errors);
            } else {
              rankedCount += result.ranked;
              completedNames.push(candidateName);
            }
          } catch (error) {
            errors.push({
              id: applicationId,
              error: error instanceof Error ? error.message : "AI ranking failed",
            });
          } finally {
            if (phaseInterval !== undefined) {
              window.clearInterval(phaseInterval);
            }
            inFlightIdsRef.current.delete(applicationId);
            setInFlightApplicationIds(Array.from(inFlightIdsRef.current));
          }

          if (index + 1 < targetIds.length) {
            setProgress({
              isActive: true,
              current: index + 1,
              total: targetIds.length,
              phase: "extracting",
              mode,
              applicationId: targetIds[index + 1],
              candidateName:
                resolveName?.(targetIds[index + 1]) ?? "Candidate",
              candidateStartedAt: Date.now(),
            });
          }
        }

        const payload: AiRankCompletePayload = {
          ranked: rankedCount,
          errors,
          results: allResults,
        };

        setProgress((current) =>
          current?.isActive ? { ...current, phase: "complete" } : current
        );
        await new Promise((resolve) => window.setTimeout(resolve, COMPLETE_FLASH_MS));

        sessionActiveRef.current = false;
        setProgress(null);
        setIsBackground(false);
        notifyComplete(rankedCount, errors, completedNames);
        options?.onComplete?.(payload);
        return payload;
      } finally {
        targetIds.forEach((id) => inFlightIdsRef.current.delete(id));
        setInFlightApplicationIds(Array.from(inFlightIdsRef.current));
        sessionActiveRef.current = false;
        setProgress(null);
        setIsBackground(false);
      }
    },
    [notifyComplete]
  );

  const rankApplication = useCallback(
    (applicationId: string, options?: AiRankOptions) =>
      rankApplications(
        [applicationId],
        undefined,
        { ...options, mode: options?.mode ?? "single" }
      ),
    [rankApplications]
  );

  const sendToBackground = useCallback(() => {
    setIsBackground(true);
  }, []);

  const expandOverlay = useCallback(() => {
    setIsBackground(false);
  }, []);

  const value = useMemo<AiRankContextValue>(
    () => ({
      progress,
      isBackground,
      isRanking: Boolean(progress?.isActive),
      inFlightApplicationIds,
      rankingApplicationId: progress?.applicationId ?? null,
      rankApplications,
      rankApplication,
      sendToBackground,
      expandOverlay,
    }),
    [
      progress,
      isBackground,
      inFlightApplicationIds,
      rankApplications,
      rankApplication,
      sendToBackground,
      expandOverlay,
    ]
  );

  return <AiRankContext.Provider value={value}>{children}</AiRankContext.Provider>;
}

export function useAiRank() {
  const context = useContext(AiRankContext);
  // Shared admin modals (e.g. ViewApplicationModal) also render on the user
  // dashboard, which has no AiRankProvider — return a safe no-op there.
  return context ?? AI_RANK_FALLBACK;
}
