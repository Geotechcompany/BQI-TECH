"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ResolvedPipelineStage } from "./pipeline-settings-config";
import { StageBroadcastEmailDialog } from "./StageBroadcastEmailDialog";
import { publicAdminHref } from "@/lib/admin-path";

interface PipelineColumnMenuProps {
  jobId: string;
  stage: ResolvedPipelineStage;
  candidateCount: number;
  recipientEmails: string[];
  otherStages: ResolvedPipelineStage[];
  onMoveToStage: (targetStageLabel: string) => void | Promise<void>;
  onRunIntelligence?: () => void | Promise<void>;
  onDeleteCandidates: () => void | Promise<void>;
  isBusy?: boolean;
}

export function PipelineColumnMenu({
  jobId,
  stage,
  candidateCount,
  recipientEmails,
  otherStages,
  onMoveToStage,
  onRunIntelligence,
  onDeleteCandidates,
  isBusy = false,
}: PipelineColumnMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const hasCandidates = candidateCount > 0;
  const hasRecipients = recipientEmails.length > 0;
  const settingsHref = publicAdminHref(`/manage/jobs/${jobId}/pipeline/settings?stage=${encodeURIComponent(stage.id)}`);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-[#272055]/70 hover:bg-[#272055]/8 hover:text-[#272055]"
            aria-label={`${stage.label} column menu`}
            disabled={isBusy}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={settingsHref}>Edit Stage Actions</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!hasCandidates || isBusy}>
              Move To Stage
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {otherStages.length === 0 ? (
                <DropdownMenuItem disabled>No other stages</DropdownMenuItem>
              ) : (
                otherStages.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    disabled={isBusy}
                    onSelect={() => {
                      void onMoveToStage(target.label);
                    }}
                  >
                    {target.label}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {onRunIntelligence ? (
            <DropdownMenuItem
              disabled={!hasCandidates || isBusy}
              onSelect={() => {
                void onRunIntelligence();
              }}
            >
              Run BQI Intelligence
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={!hasCandidates || !hasRecipients || isBusy}
            onSelect={() => setEmailOpen(true)}
          >
            Email stage
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasCandidates || isBusy}
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete Candidates
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StageBroadcastEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        stageLabel={stage.label}
        stageId={stage.id}
        recipientEmails={recipientEmails}
        candidateCount={candidateCount}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {candidateCount} candidate{candidateCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Candidates in {stage.label} will be archived and removed from this
              pipeline board. This uses the same archive action as dragging to
              Archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBusy}
              onClick={() => {
                void onDeleteCandidates();
              }}
            >
              Delete candidates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
