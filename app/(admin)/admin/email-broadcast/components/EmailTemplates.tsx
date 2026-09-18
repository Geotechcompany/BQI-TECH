"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  Eye,
  UserPlus,
  ListChecks,
  ClipboardCheck,
  MessagesSquare,
  Trophy,
  UserX,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api-backend";
import {
  normalizeBroadcastTemplate,
  type BroadcastEmailTemplate,
} from "@/lib/email-broadcast-templates";

interface EmailTemplatesProps {
  onTemplateSelect: (template: BroadcastEmailTemplate) => void;
  onTemplatePreview: (template: BroadcastEmailTemplate) => void;
}

const STAGE_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  new: { icon: UserPlus, color: "bg-sky-100 text-sky-800" },
  shortlisted: { icon: ListChecks, color: "bg-emerald-100 text-emerald-800" },
  "technical-assessment": {
    icon: ClipboardCheck,
    color: "bg-amber-100 text-amber-800",
  },
  interviewing: {
    icon: MessagesSquare,
    color: "bg-indigo-100 text-indigo-800",
  },
  hired: { icon: Trophy, color: "bg-teal-100 text-teal-800" },
  disqualified: { icon: UserX, color: "bg-rose-100 text-rose-800" },
};

const FALLBACK_ICON = {
  icon: FileText,
  color: "bg-slate-100 text-slate-700",
};

export function EmailTemplates({
  onTemplateSelect,
  onTemplatePreview,
}: EmailTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<BroadcastEmailTemplate[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await adminApi.listEmailTemplates();
        if (cancelled) return;
        setEmailTemplates(
          (response?.items || []).map((item) =>
            normalizeBroadcastTemplate(item as Record<string, unknown>)
          )
        );
      } catch (error: unknown) {
        if (cancelled) return;
        setEmailTemplates([]);
        const message =
          error instanceof Error ? error.message : "Could not load templates";
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTemplateSelect = (template: BroadcastEmailTemplate) => {
    setSelectedTemplate(template.id);
    onTemplateSelect(template);
    toast.success(`${template.name} applied`);
  };

  return (
    <Card className="border-2 border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Pipeline stage templates
        </CardTitle>
        <CardDescription>
          One template per hiring stage — loaded from the database
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates…
          </div>
        ) : emailTemplates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No email templates found. Restart the backend to seed defaults.
          </p>
        ) : (
          <div className="space-y-3">
            {emailTemplates.map((template) => {
              const meta =
                STAGE_ICONS[template.stageKey] || FALLBACK_ICON;
              const IconComponent = meta.icon;
              return (
                <Card
                  key={template.id}
                  className={`border-2 p-4 transition-all duration-200 hover:shadow-md ${
                    selectedTemplate === template.id
                      ? "border-[#31CDFF] bg-[#31CDFF]/10"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`shrink-0 rounded-lg p-2 ${meta.color}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900">
                          {template.name}
                        </div>
                        <div className="truncate text-sm text-gray-600">
                          {template.subject}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTemplatePreview(template)}
                        className="text-gray-600 hover:border-[#31CDFF] hover:text-[#272156]"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleTemplateSelect(template)}
                        className="bg-[#272156] text-white hover:bg-[#272156]/90"
                      >
                        Use
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
