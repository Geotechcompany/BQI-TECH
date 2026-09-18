"use client";

import {
  Archive,
  ArrowRightLeft,
  Bell,
  CheckSquare,
  Copy,
  Eye,
  EyeOff,
  FileInput,
  MoreVertical,
  Printer,
  Share2,
  Trash2,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

export interface CandidateMoreMenuProps {
  currentStatus: string;
  statusOptions: readonly { value: string }[];
  isBusy?: boolean;
  isPrivate?: boolean;
  onMove: (status: string) => void;
  onCopyLink: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onAddTask: () => void;
  onRequestApplication: () => void;
  onShare: () => void;
  onPrint: () => void;
  onSetReminder: () => void;
  onMarkPrivate: () => void;
}

const itemClass =
  "cursor-pointer gap-2 text-[#272055] focus:bg-[#272055]/5 focus:text-[#272055]";

export function CandidateMoreMenu({
  currentStatus,
  statusOptions,
  isBusy = false,
  isPrivate = false,
  onMove,
  onCopyLink,
  onDelete,
  onArchive,
  onAddTask,
  onRequestApplication,
  onShare,
  onPrint,
  onSetReminder,
  onMarkPrivate,
}: CandidateMoreMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-white hover:bg-white/10 hover:text-white"
          disabled={isBusy}
          aria-label="More actions"
          data-tour="candidate-more"
        >
          <MoreVertical className="h-4 w-4" />
          <span className="hidden sm:inline">More</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={itemClass}>
            <ArrowRightLeft className="h-4 w-4" />
            Move
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {statusOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className={cn(
                  itemClass,
                  option.value === currentStatus && "bg-[#272055]/5 font-medium"
                )}
                disabled={option.value === currentStatus}
                onSelect={() => onMove(option.value)}
              >
                {option.value}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem className={itemClass} onSelect={onCopyLink}>
          <Copy className="h-4 w-4" />
          Copy
        </DropdownMenuItem>

        <DropdownMenuItem
          className={cn(itemClass, "text-red-600 focus:bg-red-50 focus:text-red-700")}
          onSelect={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>

        <DropdownMenuItem className={itemClass} onSelect={onArchive}>
          <Archive className="h-4 w-4" />
          Archive
        </DropdownMenuItem>

        <DropdownMenuItem className={itemClass} onSelect={onAddTask}>
          <CheckSquare className="h-4 w-4" />
          Add Task
        </DropdownMenuItem>

        <DropdownMenuItem className={itemClass} onSelect={onRequestApplication}>
          <FileInput className="h-4 w-4" />
          Request Application
        </DropdownMenuItem>

        <DropdownMenuItem className={itemClass} onSelect={onShare}>
          <Share2 className="h-4 w-4" />
          Share Candidate
        </DropdownMenuItem>

        <DropdownMenuItem className={itemClass} onSelect={onPrint}>
          <Printer className="h-4 w-4" />
          Print
        </DropdownMenuItem>

        <DropdownMenuItem className={itemClass} onSelect={onSetReminder}>
          <Bell className="h-4 w-4" />
          Set Reminder
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className={itemClass} onSelect={onMarkPrivate}>
          {isPrivate ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
          {isPrivate ? "Make Visible" : "Mark Private"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
