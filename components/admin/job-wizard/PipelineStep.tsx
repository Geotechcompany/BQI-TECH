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
import { JobWizardState } from "@/types/job-wizard";
import { PipelineSettings } from "@/types/pipeline-settings";
import { HELP_PATHS } from "@/lib/help/urls";
import { EditStageDialog } from "@/components/admin/pipeline/EditStageDialog";
import {
  PIPELINE_TEMPLATES,
  collectStageActionTags,
  createDefaultPipelineSettings,
  mergeStageDefinitionsWithConfig,
  normalizePipelineSettings,
  stagesFromTemplate,
} from "@/components/admin/pipeline/pipeline-settings-config";

interface PipelineStepProps {
  state: JobWizardState;
  onChange: (patch: Partial<JobWizardState>) => void;
  jobId?: string;
}

export function PipelineStep({ state, onChange, jobId }: PipelineStepProps) {
  const settings = useMemo(
    () =>
      normalizePipelineSettings(
        state.pipelineSettings ?? createDefaultPipelineSettings()
      ),
    [state.pipelineSettings]
  );

  const displayStages = useMemo(
    () =>
      mergeStageDefinitionsWithConfig(
        settings.templateId,
        state.pipelineStages
      ),
    [settings.templateId, state.pipelineStages]
  );

  const [editingStageId, setEditingStageId] = useState<string | null>(null);

  const editingStage = displayStages.find(
    (stage) => stage.id === editingStageId
  );

  const updateSettings = (patch: Partial<PipelineSettings>) => {
    onChange({
      pipelineSettings: normalizePipelineSettings({
        ...settings,
        ...patch,
      }),
    });
  };

  const handleTemplateChange = (templateId: string) => {
    const nextStages = stagesFromTemplate(templateId);
    onChange({
      pipelineSettings: normalizePipelineSettings({
        ...settings,
        templateId,
      }),
      pipelineStages: nextStages,
    });
  };

  const handleStageSave = (payload: {
    stageLabel: string;
    actions: import("@/types/pipeline-settings").StageAction[];
  }) => {
    if (!editingStageId) return;

    const nextStages = state.pipelineStages.map((stage) =>
      stage.id === editingStageId
        ? { ...stage, label: payload.stageLabel, enabled: true }
        : stage
    );

    const hasStage = nextStages.some((stage) => stage.id === editingStageId);
    onChange({
      pipelineStages: hasStage
        ? nextStages
        : [
            ...nextStages,
            {
              id: editingStageId,
              label: payload.stageLabel,
              enabled: true,
            },
          ],
      pipelineSettings: normalizePipelineSettings({
        ...settings,
        stageActions: {
          ...(settings.stageActions || {}),
          [editingStageId]: payload.actions,
        },
      }),
    });
    setEditingStageId(null);
  };

  const previewHref = jobId ? `/manage/jobs/${jobId}/pipeline` : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-bold leading-[1.15] tracking-[-0.02em] text-[#272055]">
            Position Pipeline
          </h3>
          <p className="mt-2.5 text-sm font-normal leading-relaxed text-muted-foreground">
            Changes apply only to this position.{" "}
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
          <Button type="button" variant="outline" size="sm" className="shrink-0" asChild>
            <a href={previewHref} target="_blank" rel="noopener noreferrer">
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
            title="Save this position first to preview its pipeline board"
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
        )}
      </div>

      <section className="space-y-3">
        <Label htmlFor="wizard-pipeline-template">
          Choose which pipeline to use with this position.
        </Label>
        <Select value={settings.templateId} onValueChange={handleTemplateChange}>
          <SelectTrigger id="wizard-pipeline-template" className="w-full">
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

      <section className="space-y-4">
        <div>
          <h4 className="text-base font-bold leading-snug tracking-[-0.01em] text-[#272055]">
            Pipeline Stages
          </h4>
          <p className="mt-2 text-sm font-normal leading-relaxed text-muted-foreground">
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
                    <p className="font-medium text-[#272055]">{stage.label}</p>
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

      <section className="space-y-3">
        <div>
          <h4 className="text-base font-bold leading-snug tracking-[-0.01em] text-[#272055]">
            Email Sender
          </h4>
          <p className="mt-2 text-sm font-normal leading-relaxed text-muted-foreground">
            Automated emails triggered by stage actions will be sent using this
            name.
          </p>
        </div>
        <Input
          id="wizard-email-sender"
          value={settings.emailSenderName || ""}
          onChange={(event) =>
            updateSettings({ emailSenderName: event.target.value })
          }
          placeholder="Sender name"
          className="w-full max-w-xl"
        />
      </section>

      {editingStage ? (
        <EditStageDialog
          open
          stageId={editingStage.id}
          stageLabel={editingStage.label}
          actions={settings.stageActions?.[editingStage.id] ?? []}
          configContext={{
            questionnaires: state.questionnaires,
            hiringTeam: state.hiringTeam,
            pipelineStages: state.pipelineStages,
            availableTags: collectStageActionTags(settings.stageActions),
            currentStageId: editingStage.id,
          }}
          onCancel={() => setEditingStageId(null)}
          onSave={handleStageSave}
        />
      ) : null}
    </div>
  );
}
