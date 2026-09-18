"use client";

import { useMemo, useState } from "react";
import { Eye, Settings2 } from "lucide-react";
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
import { PipelineSettings, StageAction } from "@/types/pipeline-settings";
import {
  ApplicationQuestionnaire,
  HiringTeamMember,
  PipelineStageConfig,
} from "@/types/job-wizard";
import { HELP_PATHS } from "@/lib/help/urls";
import {
  getTemplateStageDefinitions,
  mergeStageDefinitionsWithConfig,
  normalizePipelineSettings,
  collectStageActionTags,
  PIPELINE_TEMPLATES,
} from "./pipeline-settings-config";
import { EditStageDialog } from "./EditStageDialog";

interface PipelineSettingsFormProps {
  initialSettings: PipelineSettings;
  jobTitle?: string;
  defaultEmailSenderName?: string;
  initialExpandedStageId?: string | null;
  pipelineStages?: PipelineStageConfig[];
  questionnaires?: ApplicationQuestionnaire[];
  hiringTeam?: HiringTeamMember[];
  availableTags?: string[];
  previewHref?: string;
  onSave: (settings: PipelineSettings) => Promise<void>;
  onStageLabelChange?: (stageId: string, label: string) => void;
  isSaving?: boolean;
}

export function PipelineSettingsForm({
  initialSettings,
  jobTitle,
  defaultEmailSenderName = "",
  initialExpandedStageId = null,
  pipelineStages = [],
  questionnaires = [],
  hiringTeam = [],
  availableTags = [],
  previewHref,
  onSave,
  onStageLabelChange,
  isSaving = false,
}: PipelineSettingsFormProps) {
  const [settings, setSettings] = useState<PipelineSettings>(() =>
    normalizePipelineSettings(initialSettings, defaultEmailSenderName)
  );
  const [stageLabels, setStageLabels] = useState<PipelineStageConfig[]>(() =>
    pipelineStages.length
      ? pipelineStages.map((stage) => ({ ...stage }))
      : getTemplateStageDefinitions(initialSettings.templateId).map((stage) => ({
          id: stage.id,
          label: stage.label,
          enabled: true,
        }))
  );
  const [editingStageId, setEditingStageId] = useState<string | null>(
    initialExpandedStageId
  );

  const displayStages = useMemo(
    () => mergeStageDefinitionsWithConfig(settings.templateId, stageLabels),
    [settings.templateId, stageLabels]
  );

  const editingStage = displayStages.find((stage) => stage.id === editingStageId);

  const resolvedAvailableTags = useMemo(() => {
    const fromActions = collectStageActionTags(settings.stageActions);
    return Array.from(new Set([...availableTags, ...fromActions])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [availableTags, settings.stageActions]);

  const updateSettings = (patch: Partial<PipelineSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const handleTemplateChange = (templateId: string) => {
    const nextStages = getTemplateStageDefinitions(templateId).map((stage) => ({
      id: stage.id,
      label: stage.label,
      enabled: true,
    }));
    setStageLabels(nextStages);
    updateSettings({ templateId });
  };

  const handleStageSave = (payload: {
    stageLabel: string;
    actions: StageAction[];
  }) => {
    if (!editingStageId) return;

    setStageLabels((current) => {
      const exists = current.some((stage) => stage.id === editingStageId);
      if (!exists) {
        return [
          ...current,
          {
            id: editingStageId,
            label: payload.stageLabel,
            enabled: true,
          },
        ];
      }
      return current.map((stage) =>
        stage.id === editingStageId
          ? { ...stage, label: payload.stageLabel, enabled: true }
          : stage
      );
    });

    onStageLabelChange?.(editingStageId, payload.stageLabel);

    setSettings((current) => ({
      ...current,
      stageActions: {
        ...(current.stageActions || {}),
        [editingStageId]: payload.actions,
      },
    }));
    setEditingStageId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSave(normalizePipelineSettings(settings, defaultEmailSenderName));
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border border-[#272055]/10 bg-white shadow-sm">
        <div className="border-b border-[#272055]/10 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#272055]">
                Position Pipeline
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {jobTitle
                  ? `Changes apply only to ${jobTitle}. `
                  : "Changes apply only to this position. "}
                <a
                  href={HELP_PATHS.positionPipeline}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#31CDFF] underline-offset-2 hover:text-[#272055] hover:underline"
                >
                  Learn More
                </a>
              </p>
            </div>
            {previewHref ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                asChild
              >
                <a href={previewHref}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-8 px-5 py-6 sm:px-6">
          <section className="space-y-3" data-tour="pipeline-settings-template">
            <Label htmlFor="pipeline-template">
              Choose which pipeline to use with this position.
            </Label>
            <Select
              value={settings.templateId}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger id="pipeline-template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-4" data-tour="pipeline-settings-stages">
            <div>
              <h3 className="text-base font-semibold text-[#272055]">
                Pipeline Stages
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Customize automated stage actions for this position.{" "}
                <a
                  href={`${HELP_PATHS.positionPipeline}#stage-actions`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#31CDFF] underline-offset-2 hover:text-[#272055] hover:underline"
                >
                  Learn More
                </a>
              </p>
            </div>

            <div className="divide-y divide-[#272055]/10 rounded-xl border border-[#272055]/10">
              {displayStages.map((stage) => {
                const StageIcon = stage.icon;
                const stageActions = settings.stageActions?.[stage.id] ?? [];

                return (
                  <div
                    key={stage.id}
                    className="flex flex-col gap-3 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#31CDFF]/15 text-[#272055]">
                        <StageIcon className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="font-medium text-[#272055]">
                          {stage.label}
                        </p>
                        {stageActions.length > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {stageActions.length} action
                            {stageActions.length === 1 ? "" : "s"} configured
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="justify-start sm:justify-center"
                      onClick={() => setEditingStageId(stage.id)}
                    >
                      <Settings2 className="mr-1.5 h-4 w-4" />
                      Add Stage Actions
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3" data-tour="pipeline-settings-sender">
            <div>
              <h3 className="text-base font-semibold text-[#272055]">
                Email Sender
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Automated emails triggered by stage actions will be sent using
                this name.
              </p>
            </div>
            <Input
              id="email-sender-name"
              value={settings.emailSenderName || ""}
              onChange={(event) =>
                updateSettings({ emailSenderName: event.target.value })
              }
              placeholder={defaultEmailSenderName || "Sender name"}
              className="w-full max-w-xl"
            />
          </section>
        </div>

        <div className="flex justify-end border-t border-[#272055]/10 bg-[#fafbfd] px-5 py-4 sm:px-6">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-[#272055] hover:bg-[#272055]/90"
            data-tour="pipeline-settings-save"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      {editingStage ? (
        <EditStageDialog
          open
          stageId={editingStage.id}
          stageLabel={editingStage.label}
          actions={settings.stageActions?.[editingStage.id] ?? []}
          configContext={{
            questionnaires,
            hiringTeam,
            pipelineStages: stageLabels,
            availableTags: resolvedAvailableTags,
            currentStageId: editingStage.id,
          }}
          onCancel={() => setEditingStageId(null)}
          onSave={handleStageSave}
        />
      ) : null}
    </form>
  );
}
