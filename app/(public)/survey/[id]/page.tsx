"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { publicApi } from "@/lib/api-backend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { BookOpen, Sparkles, Upload, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function SurveyPublicPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params.id;
  const router = useRouter();
  const [survey, setSurvey] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await publicApi.getSurvey(surveyId);
        setSurvey(data);
      } catch (e: any) {
        toast.error("Survey not found", { description: e?.message });
      }
    })();
  }, [surveyId]);

  if (!survey)
    return <div className="container mx-auto p-6">Loading survey...</div>;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Attach a stable clientId so backend can enforce one-per-user if enabled
      let clientId = "";
      try {
        clientId = localStorage.getItem("survey_client_id") || "";
        if (!clientId) {
          clientId = crypto.randomUUID();
          localStorage.setItem("survey_client_id", clientId);
        }
      } catch {}

      await publicApi.submitSurveyResponse(surveyId, { ...answers, clientId });
      toast.success("Thanks for your response!");
      // Navigate to thank-you page
      router.push(`/survey/${surveyId}/thank-you`);
    } catch (e: any) {
      toast.error("Failed to submit", { description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const progress = Math.round(
    ((Object.keys(answers).length || 0) / (survey.questions?.length || 1)) * 100
  );

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      {/* Page Header (mirrors blog style) */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-2"
      >
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="p-2 bg-gradient-to-br from-[#31CDFF]/20 to-[#272055]/20 rounded-xl backdrop-blur-sm border border-white/20">
            <BookOpen className="h-6 w-6 text-[#272055] dark:text-[#31CDFF]" />
          </div>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles className="h-5 w-5 text-[#31CDFF]" />
          </motion.div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#272055] to-[#31CDFF] text-transparent bg-clip-text">
          {survey.title}
        </h1>
        {survey.description && (
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mt-2">
            {survey.description}
          </p>
        )}
        <div className="pt-3 max-w-2xl mx-auto">
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-muted-foreground mt-1">
            {progress}% complete
          </div>
        </div>
      </motion.div>

      <Card className="p-6 space-y-6 shadow-md">
        {survey.questions?.map((q: any, idx: number) => (
          <div key={idx} className="space-y-3">
            <div className="font-medium text-base">
              {idx + 1}. {q.title}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </div>
            {q.type === "short_text" && (
              <Input
                placeholder="Type your answer"
                value={answers[idx] || ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [idx]: e.target.value }))
                }
              />
            )}
            {q.type === "long_text" && (
              <Textarea
                placeholder="Your detailed answer"
                value={answers[idx] || ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [idx]: e.target.value }))
                }
              />
            )}
            {q.type === "single_choice" && (
              <RadioGroup
                value={answers[idx] || ""}
                onValueChange={(val) =>
                  setAnswers((a) => ({ ...a, [idx]: val }))
                }
                className="grid gap-2"
              >
                {(q.options || []).map((opt: string, oi: number) => (
                  <label key={oi} className="flex items-center gap-3 text-sm">
                    <RadioGroupItem value={opt} />
                    <span>{opt}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
            {q.type === "multiple_choice" && (
              <div className="space-y-2">
                {(q.options || []).map((opt: string, oi: number) => {
                  const selected: string[] = answers[idx] || [];
                  const isChecked = selected.includes(opt);
                  return (
                    <label key={oi} className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(val) => {
                          const next = new Set(selected);
                          if (val) next.add(opt);
                          else next.delete(opt);
                          setAnswers((a) => ({
                            ...a,
                            [idx]: Array.from(next),
                          }));
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {q.type === "file_upload" && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#31CDFF] transition-colors">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <div className="text-sm text-gray-600 mb-2">
                    Click to upload or drag and drop
                  </div>
                  <div className="text-xs text-gray-500">
                    {q.acceptedTypes?.join(", ") || "Any file type"}
                    {q.maxFileSize && ` • Max ${q.maxFileSize}MB`}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    id={`file-${idx}`}
                    accept={q.acceptedTypes?.join(",")}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Check file size
                        const maxSize = (q.maxFileSize || 5) * 1024 * 1024; // Convert MB to bytes
                        if (file.size > maxSize) {
                          toast.error(
                            `File too large. Max size: ${q.maxFileSize || 5}MB`
                          );
                          return;
                        }
                        setAnswers((a) => ({ ...a, [idx]: file }));
                      }
                    }}
                  />
                  <label
                    htmlFor={`file-${idx}`}
                    className="cursor-pointer inline-block mt-2 px-4 py-2 bg-[#31CDFF] text-white rounded-lg hover:bg-[#2BB8E8] transition-colors"
                  >
                    Choose File
                  </label>
                </div>
                {answers[idx] && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">
                      {(answers[idx] as File).name}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setAnswers((a) => ({ ...a, [idx]: null }))}
                      className="text-red-500 hover:text-red-700 ml-auto"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            )}
            {idx !== (survey.questions?.length || 1) - 1 && (
              <Separator className="mt-2" />
            )}
          </div>
        ))}

        <div className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full md:w-auto"
          >
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
