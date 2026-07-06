import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Application, AiRankRequirement } from "@/types/application";
import { getPositionDisplay, getCvUrl } from "./utils/table-utils";
import { APPLICATION_STATUS_OPTIONS, getStatusColor } from "./application-status";
import { AiRankInlineProgress, type AiRankProgressState } from "./AiRankProgress";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  UserIcon,
  BriefcaseIcon,
  FileTextIcon,
  FileIcon,
  ArrowUpRightIcon,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CVPreviewFrame } from "./CVPreviewFrame";
import { useAiStatus, AI_UNCONFIGURED_MESSAGE } from "@/contexts/AiStatusContext";

function aiMatchLabel(match: AiRankRequirement["match"]): string {
  const labels: Record<AiRankRequirement["match"], string> = {
    full: "Met",
    partial: "Partial",
    weak: "Weak",
    none: "Missing",
    unknown: "Not evidenced",
  };
  return labels[match] ?? match;
}

function aiMatchBadgeClass(match: AiRankRequirement["match"]): string {
  const styles: Record<AiRankRequirement["match"], string> = {
    full: "bg-emerald-100 text-emerald-800 border-emerald-200",
    partial: "bg-amber-100 text-amber-800 border-amber-200",
    weak: "bg-orange-100 text-orange-800 border-orange-200",
    none: "bg-red-100 text-red-800 border-red-200",
    unknown: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return styles[match] ?? "bg-gray-100 text-gray-700 border-gray-200";
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ViewApplicationModalProps {
  application: Application | null;
  isOpen: boolean;
  onClose: () => void;
  jobTitles?: Record<string, string>;
  onSave?: (updatedApplication: Application) => Promise<void> | void;
  onRank?: (applicationId: string) => Promise<void> | void;
  rankProgress?: AiRankProgressState | null;
}

export function ViewApplicationModal({
  application,
  isOpen,
  onClose,
  jobTitles = {},
  onSave,
  onRank,
  rankProgress = null,
}: ViewApplicationModalProps) {
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { isUnconfigured: aiUnconfigured } = useAiStatus();

  const isRanking = Boolean(rankProgress?.isActive && rankProgress.mode === "single");

  useEffect(() => {
    if (application && isOpen) {
      setStatus(application.status || "New");
    }
  }, [application, isOpen]);

  if (!application) return null;

  const isStatusDirty = status !== (application.status || "New");
  const canEditStatus = Boolean(onSave);

  const handleSaveStatus = async () => {
    if (!onSave || !isStatusDirty) return;
    setIsSaving(true);
    try {
      await onSave({ ...application, status });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRank = async () => {
    if (!onRank) return;
    await onRank(application.id);
  };

  const isLikelyUrl = (value: unknown) => {
    if (typeof value !== "string") return false;
    try {
      if (value.startsWith("www.")) return true;
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const isResumeQuestion = (text: unknown) => {
    const q = (typeof text === "string" ? text : "").toLowerCase();
    return q.includes("upload resume") || q.includes("resume/cv") || q.includes("cv");
  };

  function getAnswer(answers: Application["answers"], question: string) {
    if (!answers || !Array.isArray(answers)) return "";

    return (
      answers.find((a) =>
        a?.questionText?.toLowerCase().includes(question.toLowerCase())
      )?.answer || ""
    );
  }

  const cvUrl = getCvUrl(application);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl h-[95vh] max-h-[95vh] p-0 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col">
        <DialogHeader className="relative p-4 sm:p-6 pb-2 sm:pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                Application Details
              </DialogTitle>
              <DialogDescription className="text-gray-500 text-xs sm:text-sm mt-1">
                Review candidate information and update status inline
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 flex-shrink-0 sm:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4 sm:space-y-6">
            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl">
              <span className="text-xs font-medium text-gray-400">Application ID</span>
              <p className="font-mono text-xs sm:text-sm text-gray-700 mt-1 break-all">
                {application.id}
              </p>
            </div>

            {(application.aiRankScore != null || onRank) && (
              <div className="p-4 sm:p-5 bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 rounded-lg sm:rounded-xl shadow-sm space-y-4">
                <AiRankInlineProgress progress={rankProgress} />
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-700 flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500 flex-shrink-0" />
                      <span>AI Fit Score</span>
                    </h4>
                    {application.aiRankScore != null ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-bold text-violet-700">
                            {application.aiRankScore}
                          </span>
                          <span className="text-sm text-gray-500">/ 100</span>
                          {application.aiRankRecommendation && (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 text-violet-700 border border-violet-200">
                              {application.aiRankRecommendation}
                            </span>
                          )}
                        </div>
                        {application.aiRankSummary && (
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {application.aiRankSummary}
                          </p>
                        )}
                        {application.aiRankScoreReason && (
                          <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-violet-200 pl-3">
                            <span className="font-medium text-gray-700">Why this score: </span>
                            {application.aiRankScoreReason}
                          </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {application.aiRankStrengths &&
                            application.aiRankStrengths.length > 0 && (
                              <div>
                                <p className="font-medium text-green-700 mb-1">Strengths</p>
                                <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                                  {application.aiRankStrengths.map((item, index) => (
                                    <li key={index}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          {application.aiRankGaps && application.aiRankGaps.length > 0 && (
                            <div>
                              <p className="font-medium text-amber-700 mb-1">Gaps</p>
                              <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                                {application.aiRankGaps.map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {application.aiRankRequirements &&
                          application.aiRankRequirements.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-gray-700">
                                Requirement assessment
                              </p>
                              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {application.aiRankRequirements.map((req, index) => (
                                  <div
                                    key={index}
                                    className="rounded-lg border border-gray-200 bg-white/70 p-3 text-sm"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span
                                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${aiMatchBadgeClass(req.match)}`}
                                      >
                                        {aiMatchLabel(req.match)}
                                      </span>
                                      {req.criticality === 3 && (
                                        <span className="text-[11px] font-medium text-red-600">
                                          Must-have
                                        </span>
                                      )}
                                      {req.score != null && (
                                        <span className="text-[11px] text-gray-500">
                                          {req.score}/100
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-gray-800 font-medium leading-snug">
                                      {req.requirement}
                                    </p>
                                    {req.jdQuote && req.jdQuote !== req.requirement && (
                                      <p className="text-xs text-gray-500 mt-1 italic">
                                        JD: &ldquo;{req.jdQuote}&rdquo;
                                      </p>
                                    )}
                                    {req.evidence && (
                                      <p className="text-xs text-gray-600 mt-1.5">
                                        <span className="font-medium text-gray-700">Evidence: </span>
                                        {req.evidence}
                                      </p>
                                    )}
                                    {req.gapNote && (
                                      <p className="text-xs text-amber-800 mt-1">
                                        <span className="font-medium">Gap: </span>
                                        {req.gapNote}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        {application.aiRankedAt && (
                          <p className="text-xs text-gray-500">
                            Ranked {formatDate(application.aiRankedAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">
                        No AI score yet. Run AI ranking to evaluate this candidate against the role.
                      </p>
                    )}
                  </div>
                  {onRank && (
                    <span
                      title={aiUnconfigured ? AI_UNCONFIGURED_MESSAGE : undefined}
                      className="inline-flex flex-shrink-0"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRank}
                        disabled={isRanking || aiUnconfigured}
                        className="border-violet-200 text-violet-700 hover:bg-violet-50"
                      >
                        {isRanking ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Ranking...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {application.aiRankScore != null ? "Re-rank" : "AI Rank"}
                          </>
                        )}
                      </Button>
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-lg sm:rounded-xl shadow-sm">
                <h4 className="text-sm sm:text-base font-semibold text-gray-500 flex items-center gap-2 mb-3 sm:mb-4">
                  <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                  <span>Candidate Info</span>
                </h4>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Full Name</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium break-words">
                      {application.name ||
                        `${getAnswer(application.answers, "First Name")} ${getAnswer(application.answers, "Last Name")}`.trim() ||
                        "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Contact Email</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium break-all">
                      {application.email?.toLowerCase() ||
                        getAnswer(application.answers, "Email") ||
                        "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Phone Number</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium break-words">
                      {application.phoneNumber ||
                        getAnswer(application.answers, "Phone") ||
                        "Not provided"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-lg sm:rounded-xl shadow-sm">
                <h4 className="text-sm sm:text-base font-semibold text-gray-500 flex items-center gap-2 mb-3 sm:mb-4">
                  <BriefcaseIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 flex-shrink-0" />
                  <span>Position Info</span>
                </h4>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Applied Position</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium break-words">
                      {getPositionDisplay(application, jobTitles)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Application Date</p>
                    <p className="text-sm sm:text-base text-gray-700 font-medium">
                      {formatDate(application.appliedDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Status</p>
                    {canEditStatus ? (
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {APPLICATION_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`inline-flex px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(application.status || "New")}`}
                      >
                        {application.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-lg sm:rounded-xl shadow-sm">
              <h4 className="text-sm sm:text-base font-semibold text-gray-500 flex items-center gap-2 mb-4 sm:mb-5">
                <FileTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                <span>Application Responses</span>
              </h4>
              <div className="space-y-4 sm:space-y-5">
                {application.answers?.map((answer, index) => (
                  <div key={index} className="group relative">
                    <div className="border-l-2 border-gray-200 pl-4 sm:pl-6">
                      <p className="text-sm sm:text-base font-medium text-gray-700 mb-2 leading-relaxed">
                        {answer.questionText}
                      </p>
                      {!isResumeQuestion(answer?.questionText) ||
                      !isLikelyUrl(answer?.answer) ? (
                        <div className="text-sm sm:text-base text-gray-600 bg-gray-50 rounded-lg p-3 sm:p-4 leading-relaxed break-words">
                          {answer.answer || "No answer provided"}
                        </div>
                      ) : (
                        <div className="text-sm sm:text-base text-gray-600 bg-gray-50 rounded-lg p-3 sm:p-4 break-all">
                          <Link
                            href={String(answer.answer)}
                            target="_blank"
                            className="text-blue-600 underline"
                          >
                            {String(answer.answer)}
                          </Link>
                          <p className="text-xs text-gray-500 mt-2">
                            CV preview is available in the Attached Documents section below
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-6 sm:py-8 text-gray-400">
                    <FileTextIcon className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                    <p className="text-sm sm:text-base">No responses available</p>
                  </div>
                )}
              </div>
            </div>

            {cvUrl ? (
              <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-lg sm:rounded-xl shadow-sm">
                <h4 className="text-sm sm:text-base font-semibold text-gray-500 flex items-center gap-2 mb-4 sm:mb-5">
                  <FileIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
                  <span>Attached Documents</span>
                </h4>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 sm:p-3 bg-white rounded-lg shadow-sm flex-shrink-0">
                      <FileTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base font-medium text-gray-700 truncate">
                        Candidate CV
                      </p>
                      <p className="text-xs sm:text-sm text-gray-400">
                        Uploaded {formatDate(application.appliedDate)}
                      </p>
                    </div>
                    <Link
                      href={cvUrl}
                      target="_blank"
                      className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-700 text-sm font-medium bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-all duration-200"
                    >
                      <span>Open in new tab</span>
                      <ArrowUpRightIcon className="w-4 h-4" />
                    </Link>
                  </div>

                  <div className="w-full h-[60vh] sm:h-[70vh] bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <CVPreviewFrame
                      cvUrl={cvUrl}
                      title="CV Preview"
                      className="h-[60vh] sm:h-[70vh]"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="h-4 sm:h-0" />
          </div>
        </div>

        {canEditStatus && (
          <DialogFooter className="flex-shrink-0 border-t border-gray-100 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50/80">
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-gray-500">
                {isStatusDirty ? "Unsaved status change" : "Status is up to date"}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={isSaving}>
                  Close
                </Button>
                <Button onClick={handleSaveStatus} disabled={!isStatusDirty || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Status"
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
