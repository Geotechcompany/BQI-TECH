"use client";

import React, { useState } from 'react';
import { Application } from "@/types/application";
import { Button } from "@/components/ui/button";
import { GenerateButton } from "@/components/ui/generate-button";
import { Eye, Pencil, Trash2, ClipboardList, Settings, Archive, ArchiveRestore, Sparkles, Loader2 } from "lucide-react";
import { getNameDisplay, getEmailDisplay, getPositionDisplay, extractDataFromAnswers, getCvUrl, getStatusDateValue } from "./utils/table-utils";
import { getStatusColor } from "./application-status";
import { ApplicantsEmptyState } from "@/components/admin/applicants/ApplicantsEmptyState";
import { CVCell } from "@/components/admin/CVCell";
import { AiRankScoreCell } from "@/components/admin/AiRankCell";
import { Checkbox } from "@/components/ui/checkbox";
import { useAiStatus, AI_UNCONFIGURED_MESSAGE } from "@/contexts/AiStatusContext";
import { useBqiIntelligence } from "@/contexts/BqiIntelligenceContext";
import { useAiRank } from "@/contexts/AiRankContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UnifiedApplicationTableProps {
  applications: Application[];
  jobTitles: Record<string, string>;
  statusType: 'all' | 'shortlisted' | 'technical-assessment' | 'interviewing' | 'hired' | 'disqualified' | 'archived';
  dateField?: string; // Field to show for status-specific date (e.g., 'shortlistedDate', 'interviewDate')
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkStatusUpdate?: (ids: string[], status: string) => void;
  onBulkArchive?: (ids: string[]) => void;
  onBulkUnarchive?: (ids: string[]) => void;
  onRank?: (id: string) => void;
  onBulkRank?: (ids: string[]) => void;
  rankingApplicationId?: string | null;
  isLoading?: boolean;
  showAiScore?: boolean;
}

export function UnifiedApplicationTable({ 
  applications, 
  jobTitles, 
  statusType,
  dateField,
  onView, 
  onEdit, 
  onDelete,
  onBulkStatusUpdate,
  onBulkArchive,
  onBulkUnarchive,
  onRank,
  onBulkRank,
  rankingApplicationId = null,
  isLoading = false,
  showAiScore = true,
}: UnifiedApplicationTableProps) {
  const showBulkActions = Boolean(onBulkStatusUpdate || onBulkArchive || onBulkUnarchive || onBulkRank);
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set());
  const { isUnconfigured: aiUnconfigured } = useAiStatus();
  const { applicantInsights } = useBqiIntelligence();
  const { inFlightApplicationIds, isRanking: isAnyRanking } = useAiRank();
  const rankingEnabled = showAiScore && applicantInsights;

  const isApplicationRanking = (applicationId: string) =>
    inFlightApplicationIds.includes(applicationId) ||
    rankingApplicationId === applicationId;

  const statusOptions = [
    { label: "New", value: "New" },
    { label: "Shortlisted", value: "Shortlisted" },
    { label: "Technical Assessment", value: "Technical Assessment" },
    { label: "Interviewing", value: "Interviewing" },
    { label: "Hired", value: "Hired" },
    { label: "Rejected", value: "Rejected" },
    { label: "Disqualified", value: "Disqualified" },
  ];

  const handleSelectAll = () => {
    if (selectedApplications.size === applications.length) {
      setSelectedApplications(new Set());
    } else {
      setSelectedApplications(new Set(applications.map(app => app.id)));
    }
  };

  const handleSelectApplication = (id: string) => {
    const newSelected = new Set(selectedApplications);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedApplications(newSelected);
  };

  const handleBulkUpdate = (status: string) => {
    if (onBulkStatusUpdate && selectedApplications.size > 0) {
      onBulkStatusUpdate(Array.from(selectedApplications), status);
      setSelectedApplications(new Set());
    }
  };

  const getDateValue = (application: Application) => {
    if (!dateField) return 'N/A';
    
    const dateValue = getStatusDateValue(application, dateField);
    if (dateValue) {
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          return 'Invalid Date';
        }
        return date.toLocaleDateString();
      } catch (error) {
        return 'Invalid Date';
      }
    }
    return 'Not Set';
  };

  const getEmptyStateConfig = () => {
    const configs = {
      all: {
        title: "No Applications Found",
        description: "No job applications have been submitted yet. Applications will appear here as candidates apply for positions."
      },
      shortlisted: {
        title: "No Shortlisted Candidates",
        description: "Candidates who are marked as shortlisted will appear here. Review applications in the main applications list to identify potential candidates for shortlisting."
      },
      'technical-assessment': {
        title: "No Technical Assessment Candidates",
        description: "Candidates who are moved to technical assessment stage will appear here. Move qualified candidates from the shortlisted page to this stage."
      },
      interviewing: {
        title: "No Interview Candidates", 
        description: "Candidates who are scheduled for interviews will appear here. Move candidates from technical assessment after they complete their evaluations."
      },
      hired: {
        title: "No Hired Candidates",
        description: "Successfully hired candidates will appear here. Move candidates from the interview stage after successful completion of the hiring process."
      },
      disqualified: {
        title: "No Disqualified or Rejected Candidates",
        description: "Candidates who have been disqualified or rejected during the recruitment process will appear here. This includes both disqualified and rejected applications."
      },
      archived: {
        title: "No Archived Applications",
        description: "Archived applications will appear here. Use Archive All on the Applications page to move candidates out of the active pipeline."
      }
    };
    
    return configs[statusType] || configs.all;
  };

  if (applications.length === 0) {
    const emptyState = getEmptyStateConfig();
    if (statusType === "archived") {
      return (
        <ApplicantsEmptyState
          title={emptyState.title}
          description={emptyState.description}
          showAnimation
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-4">
          <ClipboardList className="h-12 w-12 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">{emptyState.title}</h3>
        <p className="mt-2 max-w-xl text-muted-foreground">
          {emptyState.description}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedApplications.size > 0 && showBulkActions && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">
            {selectedApplications.size} application(s) selected
          </span>
          {onBulkUnarchive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onBulkUnarchive(Array.from(selectedApplications));
                setSelectedApplications(new Set());
              }}
            >
              <ArchiveRestore className="h-4 w-4 mr-2" />
              Restore Selected
            </Button>
          ) : (
            <>
              {onBulkRank && rankingEnabled && (
                <span
                  title={aiUnconfigured ? AI_UNCONFIGURED_MESSAGE : undefined}
                  className="inline-flex"
                >
                  <GenerateButton
                    label="Score selected with BQI Intelligence"
                    generatingLabel="Ranking…"
                    isGenerating={isAnyRanking}
                    disabled={aiUnconfigured || isAnyRanking}
                    onClick={() => {
                      onBulkRank(Array.from(selectedApplications));
                      setSelectedApplications(new Set());
                    }}
                    className="text-sm"
                  />
                </span>
              )}
              {onBulkArchive && statusType !== "archived" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onBulkArchive(Array.from(selectedApplications));
                    setSelectedApplications(new Set());
                  }}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Selected
                </Button>
              )}
              {onBulkStatusUpdate && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Bulk Update Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {statusOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => handleBulkUpdate(option.value)}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                    {onBulkArchive && statusType !== "archived" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            onBulkArchive(Array.from(selectedApplications));
                            setSelectedApplications(new Set());
                          }}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              {showBulkActions && (
                <th className="px-6 py-3 text-left">
                  <Checkbox
                    checked={selectedApplications.size === applications.length}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Applicant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              {showAiScore && (
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[100px]">
                  BQI Intelligence
                </th>
              )}
              {dateField && (
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {dateField === 'shortlistedDate' ? 'Shortlisted Date' :
                   dateField === 'interviewDate' ? 'Interview Date' :
                   dateField === 'hiredDate' ? 'Hired Date' :
                   dateField === 'disqualifiedDate' ? 'Disqualified Date' :
                   dateField === 'archivedAt' ? 'Archived Date' :
                   dateField === 'appliedDate' ? 'Applied Date' : 'Date'}
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                CV
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {applications.map((application) => (
              <tr key={application.id} className="hover:bg-muted/50">
                {showBulkActions && (
                  <td className="px-6 py-4">
                    <Checkbox
                      checked={selectedApplications.has(application.id)}
                      onCheckedChange={() => handleSelectApplication(application.id)}
                    />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {getNameDisplay(application)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {getEmailDisplay(application)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {getPositionDisplay(application, jobTitles)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(application.status || "New")}`}
                  >
                    {application.status || 'New'}
                  </span>
                </td>
                {showAiScore && (
                  <td className="px-4 py-4 text-sm align-top">
                    <AiRankScoreCell
                      score={application.aiRankScore}
                      recommendation={application.aiRankRecommendation}
                      summary={application.aiRankSummary}
                      scoreReason={application.aiRankScoreReason}
                      requirements={application.aiRankRequirements}
                      onRank={
                        rankingEnabled && onRank
                          ? () => onRank(application.id)
                          : undefined
                      }
                      isRanking={isApplicationRanking(application.id)}
                      disabledReason={
                        aiUnconfigured ? AI_UNCONFIGURED_MESSAGE : undefined
                      }
                    />
                  </td>
                )}
                {dateField && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {getDateValue(application)}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  <CVCell 
                    cvUrl={getCvUrl(application)} 
                    candidateName={getNameDisplay(application)} 
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(application.id)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View application"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {rankingEnabled && onRank && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRank(application.id)}
                        disabled={
                          isAnyRanking || aiUnconfigured
                        }
                        className="text-violet-600 hover:text-violet-800"
                        title={
                          aiUnconfigured
                            ? AI_UNCONFIGURED_MESSAGE
                            : isAnyRanking
                              ? "BQI Intelligence ranking in progress"
                              : application.aiRankScore != null
                                ? "Re-score with BQI Intelligence"
                                : "Score with BQI Intelligence"
                        }
                      >
                        {isApplicationRanking(application.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(application.id)}
                      className="text-green-600 hover:text-green-800"
                      title="Edit application"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(application.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
