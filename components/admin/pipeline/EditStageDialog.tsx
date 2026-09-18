"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StageAction, StageActionType } from "@/types/pipeline-settings";
import { HELP_PATHS } from "@/lib/help/urls";
import { StageActionPicker } from "./StageActionPicker";
import {
  StageActionConfigDialog,
  StageActionConfigContext,
} from "./StageActionConfigDialog";
import {
  getStageActionCatalogItem,
  stageActionLabel,
  summarizeStageActionConfig,
} from "./stage-action-catalog";

interface EditStageDialogProps {
  open: boolean;
  stageId: string;
  stageLabel: string;
  actions: StageAction[];
  configContext: StageActionConfigContext;
  onCancel: () => void;
  onSave: (payload: { stageLabel: string; actions: StageAction[] }) => void;
}

export function EditStageDialog({
  open,
  stageId,
  stageLabel,
  actions,
  configContext,
  onCancel,
  onSave,
}: EditStageDialogProps) {
  const [name, setName] = useState(stageLabel);
  const [draftActions, setDraftActions] = useState<StageAction[]>(actions);
  const [configType, setConfigType] = useState<StageActionType | null>(null);
  const [editingAction, setEditingAction] = useState<StageAction | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(stageLabel);
    setDraftActions(actions.map((action) => ({ ...action })));
    setConfigType(null);
    setEditingAction(null);
  }, [open, stageLabel, actions]);

  const hasDefaultActions = useMemo(
    () => draftActions.some((action) => action.isDefault),
    [draftActions]
  );

  const nameValid = Boolean(name.trim());

  const handlePickAction = (type: StageActionType) => {
    const catalogItem = getStageActionCatalogItem(type);
    if (catalogItem?.requiresConfig) {
      setEditingAction(null);
      setConfigType(type);
      return;
    }
    setDraftActions((current) => [
      ...current,
      { id: `action-${Date.now()}`, type },
    ]);
  };

  const handleConfigSave = (action: StageAction) => {
    setDraftActions((current) => {
      const exists = current.some((item) => item.id === action.id);
      if (exists) {
        return current.map((item) => (item.id === action.id ? action : item));
      }
      return [...current, action];
    });
    setConfigType(null);
    setEditingAction(null);
  };

  const removeAction = (id: string) => {
    setDraftActions((current) => current.filter((action) => action.id !== id));
  };

  const removeAll = () => setDraftActions([]);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-1">
            <div>
              <Label htmlFor="stage-name">
                Stage Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="stage-name"
                className="mt-1.5"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-[#272055]">
                  Stage Actions
                </h3>
                <Label className="mt-2 block text-xs text-muted-foreground">
                  Available Stage Actions
                </Label>
                <div className="mt-1.5">
                  <StageActionPicker onSelect={handlePickAction} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Stage Actions automate common tasks. They run the first time a
                  candidate enters this stage.{" "}
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#272055]">
                    Configured Stage Actions
                  </h4>
                  {hasDefaultActions ? (
                    <Badge
                      variant="secondary"
                      className="bg-[#31CDFF]/15 text-[#272055] hover:bg-[#31CDFF]/15"
                    >
                      Default Stage Actions
                    </Badge>
                  ) : null}
                </div>
                {draftActions.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={removeAll}
                  >
                    ✕ Remove All
                  </Button>
                ) : null}
              </div>

              {draftActions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#272055]/20 bg-[#fafbfd] px-4 py-8 text-center text-sm text-muted-foreground">
                  No stage actions configured
                </div>
              ) : (
                <div className="space-y-2">
                  {draftActions.map((action) => {
                    const catalogItem = getStageActionCatalogItem(action.type);
                    const Icon = catalogItem?.icon ?? Pencil;
                    const canEditConfig = catalogItem?.requiresConfig ?? true;
                    return (
                      <div
                        key={action.id}
                        className="flex items-start gap-3 rounded-lg border border-[#272055]/10 bg-white px-3 py-3"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#31CDFF]/15 text-[#272055]">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#272055]">
                            {stageActionLabel(action.type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {summarizeStageActionConfig(action)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {canEditConfig ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Edit action"
                              onClick={() => {
                                setEditingAction(action);
                                setConfigType(action.type);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label="Remove action"
                            onClick={() => removeAction(action.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!nameValid}
              className="bg-[#272055] hover:bg-[#272055]/90"
              onClick={() =>
                onSave({
                  stageLabel: name.trim(),
                  actions: draftActions,
                })
              }
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StageActionConfigDialog
        open={Boolean(configType)}
        actionType={configType}
        initialAction={editingAction}
        context={{ ...configContext, currentStageId: stageId }}
        onCancel={() => {
          setConfigType(null);
          setEditingAction(null);
        }}
        onSave={handleConfigSave}
      />
    </>
  );
}
