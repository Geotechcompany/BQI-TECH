"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Link2,
  Trash2,
  Upload,
  FileText,
  CheckSquare,
  Square,
  Image,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api-backend";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { publicAdminHref } from "@/lib/admin-path";

type SurveyQuestion = {
  id: string;
  type:
    | "short_text"
    | "long_text"
    | "single_choice"
    | "multiple_choice"
    | "file_upload";
  title: string;
  required?: boolean;
  options?: string[];
  acceptedTypes?: string[];
  maxFileSize?: number;
};

export default function SurveysPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [limitPerUser, setLimitPerUser] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.listSurveys();
        setSurveys(res.items || []);
      } catch {}
    })();
  }, []);

  const addQuestion = (type: SurveyQuestion["type"]) => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        title: "",
        required: true,
        options: type.includes("choice") ? ["Option 1"] : undefined,
        acceptedTypes:
          type === "file_upload"
            ? ["image/*", ".pdf", ".doc", ".docx"]
            : undefined,
        maxFileSize: type === "file_upload" ? 5 : undefined, // 5MB
      },
    ]);
  };

  const updateQuestion = (id: string, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );
  };

  const startEditing = (survey: any) => {
    setEditingSurvey(survey);
    setIsEditing(true);
    setTitle(survey.title || "");
    setDescription(survey.description || "");
    setLimitPerUser(survey.limitPerUser || false);

    // Convert survey questions to the expected format
    const surveyQuestions = (survey.questions || []).map((q: any) => ({
      id: crypto.randomUUID(),
      type: q.type,
      title: q.title || "",
      required: q.required !== false,
      options:
        q.options || (q.type.includes("choice") ? ["Option 1"] : undefined),
      acceptedTypes:
        q.acceptedTypes ||
        (q.type === "file_upload"
          ? ["image/*", ".pdf", ".doc", ".docx"]
          : undefined),
      maxFileSize: q.maxFileSize || (q.type === "file_upload" ? 5 : undefined),
    }));
    setQuestions(surveyQuestions);
  };

  const cancelEditing = () => {
    setEditingSurvey(null);
    setIsEditing(false);
    setTitle("");
    setDescription("");
    setQuestions([]);
    setLimitPerUser(false);
    setAiPrompt("");
  };

  const handleDelete = async (surveyId: string) => {
    if (!confirm("Are you sure you want to delete this survey?")) return;

    try {
      await adminApi.deleteSurvey(surveyId);
      toast.success("Survey deleted");
      // refresh list
      const list = await adminApi.listSurveys();
      setSurveys(list.items || []);
    } catch (e: any) {
      toast.error("Failed to delete survey", { description: e?.message });
    }
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleCreate = async () => {
    if (!title.trim() || questions.length === 0) {
      toast.error("Add a title and at least one question");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title,
        description,
        questions: questions.map(({ id, ...rest }) => rest),
        isActive: true,
        limitPerUser,
      };

      let res;
      if (isEditing && editingSurvey) {
        // Update existing survey
        res = await adminApi.updateSurvey(editingSurvey.id, payload);
        toast.success("Survey updated", { description: `Link: ${res.link}` });
        cancelEditing();
      } else {
        // Create new survey
        res = await adminApi.createSurvey(payload);
        toast.success("Survey created", { description: `Link: ${res.link}` });
        // reset form
        setTitle("");
        setDescription("");
        setQuestions([]);
        setLimitPerUser(false);
        setAiPrompt("");
      }

      // refresh list
      const list = await adminApi.listSurveys();
      setSurveys(list.items || []);
    } catch (e: any) {
      toast.error(`Failed to ${isEditing ? "update" : "create"} survey`, {
        description: e?.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case "short_text":
        return <FileText className="w-4 h-4" />;
      case "long_text":
        return <FileText className="w-4 h-4" />;
      case "single_choice":
        return <CheckSquare className="w-4 h-4" />;
      case "multiple_choice":
        return <Square className="w-4 h-4" />;
      case "file_upload":
        return <Upload className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const builder = (
    <Card
      className="p-6 space-y-6 bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg"
      data-tour="surveys-builder"
    >
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-gradient-to-b from-[#31CDFF] to-[#272055] rounded-full"></div>
          <h2 className="text-xl font-bold text-gray-800">
            {isEditing
              ? `Edit Survey: ${editingSurvey?.title}`
              : "Create New Survey"}
          </h2>
        </div>
      </div>

      {/* Survey Details */}
      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">
            Survey Title
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 border-2 border-gray-200 focus:border-[#31CDFF] focus:ring-2 focus:ring-[#31CDFF]/20 rounded-xl transition-all duration-200"
            placeholder="Enter a compelling survey title..."
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">
            Description
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[100px] border-2 border-gray-200 focus:border-[#31CDFF] focus:ring-2 focus:ring-[#31CDFF]/20 rounded-xl transition-all duration-200 resize-none"
            placeholder="Describe what this survey is about..."
          />
        </div>

        {/* Settings */}
        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <input
            id="limitOne"
            type="checkbox"
            checked={limitPerUser}
            onChange={(e) => setLimitPerUser(e.target.checked)}
            className="w-5 h-5 text-[#31CDFF] border-2 border-gray-300 rounded focus:ring-[#31CDFF] focus:ring-2"
          />
          <label
            htmlFor="limitOne"
            className="text-sm font-medium text-gray-700 cursor-pointer"
          >
            Limit one response per user (IP/client)
          </label>
        </div>

        {/* AI Generator */}
        <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center transition-all duration-300 ${
                aiGenerating ? "animate-pulse" : ""
              }`}
            >
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <Label className="text-sm font-semibold text-gray-700">
              AI: Generate from prompt
            </Label>
          </div>
          <div className="flex gap-3">
            <Textarea
              placeholder="Write a short prompt, e.g. 'Employee satisfaction for Q4 2025'"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1 min-h-[80px] border-2 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 rounded-xl transition-all duration-200 resize-none"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={aiGenerating}
              onClick={async () => {
                try {
                  setAiGenerating(true);
                  const res = await adminApi.aiGenerateSurvey({
                    prompt: aiPrompt,
                    num_questions: 5,
                  });
                  if (res?.title) {
                    // Strip HTML tags from title
                    const cleanTitle = res.title.replace(/<[^>]*>/g, "").trim();
                    setTitle(cleanTitle);
                  }
                  if (res?.description) {
                    // Strip HTML tags from description
                    const cleanDescription = res.description
                      .replace(/<[^>]*>/g, "")
                      .trim();
                    setDescription(cleanDescription);
                  }
                  if (Array.isArray(res?.questions)) {
                    setQuestions(
                      res.questions.map((q: any) => ({
                        id: crypto.randomUUID(),
                        ...q,
                      }))
                    );
                  }
                  toast.success("AI generated survey draft");
                } catch (e: any) {
                  console.error("AI generation error:", e);
                  toast.error("AI generation failed", {
                    description:
                      e?.message || "Please try again or check your connection",
                  });
                } finally {
                  setAiGenerating(false);
                }
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-105 disabled:scale-100"
            >
              {aiGenerating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </div>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </div>

        {/* Question Types */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold text-gray-700">
            Add Question Types
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => addQuestion("short_text")}
              className="h-12 border-2 border-gray-200 hover:border-[#31CDFF] hover:bg-[#31CDFF]/5 rounded-xl transition-all duration-200 font-medium flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Short Text
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => addQuestion("long_text")}
              className="h-12 border-2 border-gray-200 hover:border-[#31CDFF] hover:bg-[#31CDFF]/5 rounded-xl transition-all duration-200 font-medium flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Long Text
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => addQuestion("single_choice")}
              className="h-12 border-2 border-gray-200 hover:border-[#31CDFF] hover:bg-[#31CDFF]/5 rounded-xl transition-all duration-200 font-medium flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              Single Choice
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => addQuestion("multiple_choice")}
              className="h-12 border-2 border-gray-200 hover:border-[#31CDFF] hover:bg-[#31CDFF]/5 rounded-xl transition-all duration-200 font-medium flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Multiple Choice
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => addQuestion("file_upload")}
              className="h-12 border-2 border-gray-200 hover:border-[#31CDFF] hover:bg-[#31CDFF]/5 rounded-xl transition-all duration-200 font-medium flex items-center gap-2 col-span-2 md:col-span-1"
            >
              <Upload className="w-4 h-4" />
              File Upload
            </Button>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold text-gray-700">
            Questions ({questions.length})
          </Label>
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <Card
                key={q.id}
                className="p-4 border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getQuestionIcon(q.type)}
                    <span className="text-sm font-medium text-gray-600">
                      Q{idx + 1} • {q.type.replace("_", " ")}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeQuestion(q.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <Input
                    placeholder="Question title"
                    value={q.title}
                    onChange={(e) =>
                      updateQuestion(q.id, { title: e.target.value })
                    }
                    className="border-2 border-gray-200 focus:border-[#31CDFF] focus:ring-2 focus:ring-[#31CDFF]/20 rounded-lg"
                  />

                  {(q.type === "single_choice" ||
                    q.type === "multiple_choice") && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Options
                      </Label>
                      {(q.options || []).map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const options = [...(q.options || [])];
                              options[i] = e.target.value;
                              updateQuestion(q.id, { options });
                            }}
                            className="border-2 border-gray-200 focus:border-[#31CDFF] focus:ring-2 focus:ring-[#31CDFF]/20 rounded-lg"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const options = [...(q.options || [])];
                              options.splice(i, 1);
                              updateQuestion(q.id, { options });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateQuestion(q.id, {
                            options: [
                              ...(q.options || []),
                              `Option ${(q.options?.length || 0) + 1}`,
                            ],
                          })
                        }
                        className="text-[#31CDFF] border-[#31CDFF] hover:bg-[#31CDFF]/5"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add option
                      </Button>
                    </div>
                  )}

                  {q.type === "file_upload" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">
                        File Settings
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">
                            Accepted Types
                          </Label>
                          <Input
                            value={(q.acceptedTypes || []).join(", ")}
                            onChange={(e) => {
                              const types = e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean);
                              updateQuestion(q.id, { acceptedTypes: types });
                            }}
                            placeholder="image/*, .pdf, .doc"
                            className="text-xs border-2 border-gray-200 focus:border-[#31CDFF] focus:ring-2 focus:ring-[#31CDFF]/20 rounded-lg"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">
                            Max Size (MB)
                          </Label>
                          <Input
                            type="number"
                            value={q.maxFileSize || 5}
                            onChange={(e) =>
                              updateQuestion(q.id, {
                                maxFileSize: parseInt(e.target.value) || 5,
                              })
                            }
                            className="text-xs border-2 border-gray-200 focus:border-[#31CDFF] focus:ring-2 focus:ring-[#31CDFF]/20 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            {questions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>
                  No questions added yet. Click the buttons above to add
                  questions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {isEditing && (
          <Button
            onClick={cancelEditing}
            variant="outline"
            className="flex-1 h-12 border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleCreate}
          disabled={isSaving}
          className={`${
            isEditing ? "flex-1" : "w-full"
          } h-12 bg-gradient-to-r from-[#31CDFF] to-[#272055] hover:from-[#2BB8E8] hover:to-[#1F1A3F] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl`}
        >
          {isSaving
            ? isEditing
              ? "Updating..."
              : "Creating..."
            : isEditing
            ? "Update Survey"
            : "Create Survey & Get Link"}
        </Button>
      </div>
    </Card>
  );

  const list = (
    <Card
      className="p-6 bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-lg"
      data-tour="surveys-list"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-2 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
        <h3 className="text-lg font-bold text-gray-800">Existing Surveys</h3>
      </div>
      <div className="space-y-3">
        {surveys.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all duration-200"
          >
            <div className="flex-1">
              <div className="font-semibold text-gray-800 mb-1">{s.title}</div>
              <div className="text-xs text-gray-500 font-mono">
                /survey/{s.id}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => startEditing(s)}
                className="border-blue-500 text-blue-500 hover:bg-blue-50"
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(publicAdminHref(`/manage/surveys/${s.id}`))}
                className="border-[#31CDFF] text-[#31CDFF] hover:bg-[#31CDFF]/5"
              >
                Analytics
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(`${window.location.origin}/survey/${s.id}`)
                    .then(() => toast.success("Link copied"))
                }
                className="border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <Link2 className="w-3 h-3 mr-1" />
                Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(s._id || s.id)}
                className="border-red-500 text-red-500 hover:bg-red-50"
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
        {surveys.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No surveys created yet.</p>
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <ProtectedRoute requireAdmin>
      <AdminPageLayout title="Surveys" showSearch={false} tourId="surveys" guideInBanner>
        <TourPageHelper tourId="surveys" />
        <div className="mb-6">
          <AdminPageWelcomeBanner bannerKey="surveys" tourId="surveys" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {builder}
          {list}
        </div>
      </AdminPageLayout>
    </ProtectedRoute>
  );
}
