"use client";

import { Plus, Trash2 } from "lucide-react";
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
import { StageAction, StageActionType } from "@/types/pipeline-settings";
import { stageActionLabel } from "./stage-action-catalog";

interface StageActionsEditorProps {
  stageLabel: string;
  actions: StageAction[];
  onChange: (actions: StageAction[]) => void;
}

/** @deprecated Prefer EditStageDialog for full stage-action configuration. */
export function StageActionsEditor({
  stageLabel,
  actions,
  onChange,
}: StageActionsEditorProps) {
  const addAction = () => {
    const action: StageAction = {
      id: `action-${Date.now()}`,
      type: "send_email_sms",
      emailSubject: "",
      emailBody: "",
      channel: "email",
      label: `Email for ${stageLabel}`,
    };
    onChange([...actions, action]);
  };

  const updateAction = (id: string, patch: Partial<StageAction>) => {
    onChange(
      actions.map((action) => (action.id === id ? { ...action, ...patch } : action))
    );
  };

  const removeAction = (id: string) => {
    onChange(actions.filter((action) => action.id !== id));
  };

  return (
    <div className="space-y-3 rounded-lg border border-[#272055]/10 bg-[#fafbfd] p-4">
      <p className="text-xs text-muted-foreground">
        Prefer Edit Stage for the full action catalog. This compact editor remains
        for legacy embeds.
      </p>

      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No actions configured for this stage.</p>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="rounded-lg border border-[#272055]/10 bg-white p-3"
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_1fr_auto] md:items-end">
                <div>
                  <Label className="text-xs">Action type</Label>
                  <Select
                    value={action.type}
                    onValueChange={(value: StageActionType) =>
                      updateAction(action.id, { type: value })
                    }
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="send_email_sms">
                        {stageActionLabel("send_email_sms")}
                      </SelectItem>
                      <SelectItem value="team_feedback">
                        {stageActionLabel("team_feedback")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">
                    {action.type === "send_email_sms" || action.type === "send_email"
                      ? "Email subject"
                      : "Label"}
                  </Label>
                  <Input
                    className="mt-1 h-9"
                    value={
                      action.type === "send_email_sms" || action.type === "send_email"
                        ? action.emailSubject || action.templateName || ""
                        : action.label || action.feedbackPrompt || ""
                    }
                    onChange={(event) =>
                      updateAction(
                        action.id,
                        action.type === "send_email_sms" || action.type === "send_email"
                          ? { emailSubject: event.target.value }
                          : { label: event.target.value }
                      )
                    }
                    placeholder={
                      action.type === "send_email_sms" || action.type === "send_email"
                        ? "e.g. Interview invite"
                        : "e.g. Alert hiring team"
                    }
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeAction(action.id)}
                  aria-label="Remove action"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addAction}>
        <Plus className="mr-2 h-4 w-4" />
        Add action
      </Button>
    </div>
  );
}
