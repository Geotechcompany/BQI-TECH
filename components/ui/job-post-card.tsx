"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Settings,
  Pencil,
  Columns3,
  Power,
  PowerOff,
  Wand2,
  Star,
  Plus,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/api-backend";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssignHiringTeamDialog } from "@/components/admin/candidate-profile/CandidateActionDialogs";
import type { ApplicationAssignee } from "@/components/admin/utils/candidate-actions-api";
import type { JobHiringTeamMember } from "@/lib/overview-positions";

interface JobPostCardProps {
  title: string;
  count: number;
  subtitle?: string;
  index?: number;
  className?: string;
  isActive?: boolean | null;
  jobId?: string | null;
  isStarred?: boolean;
  hiringTeam?: JobHiringTeamMember[];
  canManageTeam?: boolean;
  onStatusChange?: (jobId: string, isActive: boolean) => void;
  onStarToggle?: (jobId: string, starred: boolean) => void;
  onHiringTeamChange?: (jobId: string, hiringTeam: JobHiringTeamMember[]) => void;
}

const JOB_CARD_IMAGES = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80",
];

const AVATAR_COLORS = [
  "bg-[#6D28D9] text-white",
  "bg-[#272055] text-white",
  "bg-[#0E7490] text-white",
  "bg-[#BE185D] text-white",
];

const MAX_VISIBLE_AVATARS = 3;

const formatCount = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15, staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const JobPostCard: React.FC<JobPostCardProps> = ({
  title,
  count,
  subtitle = "applications",
  index = 0,
  className,
  isActive = null,
  jobId = null,
  isStarred = false,
  hiringTeam = [],
  canManageTeam = true,
  onStatusChange,
  onStarToggle,
  onHiringTeamChange,
}) => {
  const imageUrl = JOB_CARD_IMAGES[index % JOB_CARD_IMAGES.length];
  const [isToggling, setIsToggling] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const hasJobId = Boolean(jobId);
  const pipelineHref = hasJobId ? `/admin/jobs/${jobId}/pipeline` : null;

  const visibleMembers = hiringTeam.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = Math.max(0, hiringTeam.length - MAX_VISIBLE_AVATARS);

  const handleToggleActive = async (event: Event) => {
    event.preventDefault();
    if (!jobId || isToggling || isActive === null) return;

    const nextActive = !isActive;
    setIsToggling(true);
    try {
      await adminApi.toggleJobPostingStatus(jobId, { isActive: nextActive });
      onStatusChange?.(jobId, nextActive);
      toast.success(`Position ${nextActive ? "activated" : "deactivated"}`);
    } catch (error) {
      console.error("Failed to toggle job status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update job status"
      );
    } finally {
      setIsToggling(false);
    }
  };

  const handleStarToggle = (event: Event) => {
    event.preventDefault();
    if (!jobId) return;
    onStarToggle?.(jobId, !isStarred);
  };

  const handleAssignHiringTeam = async (assignees: ApplicationAssignee[]) => {
    if (!jobId) return;
    setIsSavingTeam(true);
    try {
      const nextTeam: JobHiringTeamMember[] = assignees.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role || "Reviewer",
      }));
      await adminApi.updateJobPosting(jobId, { hiringTeam: nextTeam });
      onHiringTeamChange?.(jobId, nextTeam);
      setAssignOpen(false);
      toast.success("Hiring team updated");
    } catch (error) {
      console.error("Failed to update hiring team:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update hiring team"
      );
    } finally {
      setIsSavingTeam(false);
    }
  };

  return (
    <>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ scale: 1.02, transition: { duration: 0.25 } }}
        data-tour="overview-job-card"
        className={cn(
          "relative w-full min-h-36 h-40 rounded-xl overflow-hidden px-3.5 pb-3 pt-3.5 text-white shadow-md flex flex-col justify-between isolate",
          pipelineHref && "cursor-pointer",
          className
        )}
      >
        <div className="absolute inset-0 z-[-1] bg-[#272055]">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#272055]/70 dark:bg-[#1e1844]/80" />
        </div>

        {pipelineHref && (
          <Link
            href={pipelineHref}
            className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#272055]"
            aria-label={`Open pipeline for ${title}`}
          />
        )}

        <div
          className={cn(
            "relative z-[1] flex items-start justify-between gap-2",
            pipelineHref && "pointer-events-none"
          )}
        >
          <div className="min-w-0 flex-1 pr-1.5">
            <motion.h2
              variants={itemVariants}
              data-tour="overview-job-title"
              className="text-base font-semibold leading-snug line-clamp-2"
              title={title}
            >
              {title}
            </motion.h2>
            {hasJobId && (
              <motion.div
                variants={itemVariants}
                data-tour="overview-job-hiring-team"
                className="mt-1.5 flex items-center"
              >
                <div className="flex items-center -space-x-1.5">
                  {visibleMembers.map((member, memberIndex) => (
                    <Avatar
                      key={member.id}
                      className="h-6 w-6 border border-white/40 shadow-sm"
                      title={member.name}
                    >
                      <AvatarFallback
                        className={cn(
                          "text-[10px] font-semibold",
                          AVATAR_COLORS[memberIndex % AVATAR_COLORS.length]
                        )}
                      >
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {overflowCount > 0 && (
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-white/20 text-[9px] font-semibold text-white backdrop-blur-sm"
                      title={`${overflowCount} more`}
                    >
                      +{overflowCount}
                    </span>
                  )}
                </div>
                {canManageTeam && (
                  <button
                    type="button"
                    aria-label={`Assign hiring team for ${title}`}
                    title="Assign hiring team"
                    className={cn(
                      "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-white/55 bg-white/10 text-white transition hover:bg-white/20 hover:border-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                      hiringTeam.length > 0 || overflowCount > 0 ? "ml-1.5" : ""
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setAssignOpen(true);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </motion.div>
            )}
          </div>

          {hasJobId && (
            <div
              className="pointer-events-auto shrink-0"
              data-tour="overview-job-settings"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Settings for ${title}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[#4b5563] shadow-sm ring-1 ring-black/5 transition hover:bg-white hover:text-[#272055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/job-postings/${jobId}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit position
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/jobs/${jobId}/pipeline/settings`}>
                      <Columns3 className="mr-2 h-4 w-4" />
                      Pipeline settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/job-postings/${jobId}/wizard`}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Open wizard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleStarToggle}>
                    <Star
                      className={cn(
                        "mr-2 h-4 w-4",
                        isStarred && "fill-amber-400 text-amber-500"
                      )}
                    />
                    {isStarred ? "Unstar position" : "Star position"}
                  </DropdownMenuItem>
                  {isActive !== null && (
                    <DropdownMenuItem
                      onSelect={handleToggleActive}
                      disabled={isToggling}
                      className={
                        isActive
                          ? "text-red-600 focus:text-red-600"
                          : "text-emerald-600 focus:text-emerald-600"
                      }
                    >
                      {isActive ? (
                        <PowerOff className="mr-2 h-4 w-4" />
                      ) : (
                        <Power className="mr-2 h-4 w-4" />
                      )}
                      {isActive ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div
          className={cn(
            "relative z-[1] mt-auto w-full space-y-1",
            pipelineHref && "pointer-events-none"
          )}
        >
          <div
            className="flex items-end justify-between gap-2"
            data-tour="overview-job-applications"
          >
            <motion.p
              variants={itemVariants}
              className="text-[10px] uppercase tracking-wider text-white/80"
            >
              {isActive === false ? "Inactive · " : ""}
              {subtitle}
            </motion.p>
            <motion.div variants={itemVariants} className="shrink-0">
              <span className="text-3xl font-bold tracking-tighter text-white/90 select-none tabular-nums leading-none">
                {formatCount(count)}
              </span>
            </motion.div>
          </div>
          {pipelineHref && (
            <motion.div
              variants={itemVariants}
              data-tour="overview-job-links"
              className="flex items-center gap-2.5 text-[11px] font-medium"
            >
              <Link
                href={pipelineHref}
                className="pointer-events-auto text-white underline-offset-2 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Pipeline
              </Link>
              <Link
                href={`/admin/candidates?jobId=${jobId}`}
                className="pointer-events-auto text-white underline-offset-2 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Candidates
              </Link>
            </motion.div>
          )}
        </div>
      </motion.div>

      {hasJobId && (
        <AssignHiringTeamDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          candidateName={title}
          title="Assign hiring team"
          description={`Choose admins who can manage ${title}.`}
          initialAssignees={hiringTeam}
          isSubmitting={isSavingTeam}
          onSubmit={handleAssignHiringTeam}
        />
      )}
    </>
  );
};
