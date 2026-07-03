"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminApplicationsApi, type ApplicationFilters } from '../components/admin/utils/applications-api';
import { Application } from '@/types/application';
import { toast } from 'react-hot-toast';
import { useDebounce } from './useDebounce';
import { getNameDisplay } from '@/components/admin/utils/table-utils';
import {
  type AiRankProgressState,
  cycleAiRankPhase,
} from '@/components/admin/AiRankProgress';
import { AI_SCORE_FILTER_OPTIONS } from '@/lib/ai-score-filter';

export type StatusType = 'all' | 'shortlisted' | 'technical-assessment' | 'interviewing' | 'hired' | 'disqualified' | 'archived';

export type SortOrder = 'asc' | 'desc';

export const APPLICATION_SORT_OPTIONS = [
  { label: 'Applied Date', value: 'appliedDate' },
  { label: 'Applicant Name', value: 'name' },
  { label: 'Position', value: 'position' },
  { label: 'Status', value: 'status' },
  { label: 'AI Score', value: 'aiRankScore' },
] as const;

const DEFAULT_SORT_BY = 'appliedDate';
const DEFAULT_SORT_ORDER: SortOrder = 'desc';

interface UseAdminApplicationPageOptions {
  statusType: StatusType;
  dateField?: string;
  enableBulkUpdates?: boolean;
  enablePositionFilter?: boolean;
  enableStatusFilter?: boolean;
  enableAiScoreFilter?: boolean;
}

export function useAdminApplicationPage({
  statusType,
  dateField,
  enableBulkUpdates = true,
  enablePositionFilter = true,
  enableStatusFilter = false,
  enableAiScoreFilter = false,
}: UseAdminApplicationPageOptions) {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading } = useAuth();

  // State management
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAiScore, setSelectedAiScore] = useState<string>('all');

  // Advanced filters: sorting + applied-date range
  const [sortBy, setSortBy] = useState<string>(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Debounce search term to avoid too many API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Modals
  const [viewApplication, setViewApplication] = useState<Application | null>(null);
  const [editApplication, setEditApplication] = useState<Application | null>(null);
  const [deleteApplicationId, setDeleteApplicationId] = useState<string | null>(null);
  const [aiRankProgress, setAiRankProgress] = useState<AiRankProgressState | null>(null);
  const aiRankInFlightRef = useRef(false);

  // Filter options for position dropdown
  const [positionFilterOptions, setPositionFilterOptions] = useState<string[]>([]);

  // Status filter options for the applications page
  const statusFilterOptions = [
    { label: 'All Statuses', value: 'all' },
    { label: 'New', value: 'New' },
    { label: 'Shortlisted', value: 'Shortlisted' },
    { label: 'Technical Assessment', value: 'Technical Assessment' },
    { label: 'Interviewing', value: 'Interviewing' },
    { label: 'Hired', value: 'Hired' },
    { label: 'Rejected', value: 'Rejected' },
    { label: 'Disqualified', value: 'Disqualified' },
  ];

  // Pagination settings
  const pageSize = 50;

  // Authentication check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isAdmin, authLoading, router]);

  // Load job titles
  useEffect(() => {
    const fetchJobTitles = async () => {
      try {
        const response = await adminApplicationsApi.getJobPostings({ limit: 100 });
        const jobs = Array.isArray(response) ? response : 
                    (response as any)?.jobPostings ? (response as any).jobPostings : [];
        
        const jobTitlesMap: Record<string, string> = {};
        jobs.forEach((job: any) => {
          const jobId = job.id || (job._id ? String(job._id) : null);
          if (jobId && job.title) {
            jobTitlesMap[jobId] = job.title;
          }
        });
        
        setJobTitles(jobTitlesMap);
      } catch (error) {
        console.error('Failed to fetch job titles:', error);
        toast.error('Failed to fetch job titles');
      }
    };
    
    if (isAuthenticated && isAdmin) {
      fetchJobTitles();
    }
  }, [isAuthenticated, isAdmin]);

  // Load applications with server-side filtering
  const loadApplications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const skip = (currentPage - 1) * pageSize;
      const filters: ApplicationFilters = {
        skip,
        limit: pageSize,
        search: debouncedSearchTerm || undefined,
        position: selectedPosition !== 'all' ? selectedPosition : undefined,
        aiScoreFilter:
          enableAiScoreFilter && selectedAiScore !== 'all'
            ? selectedAiScore
            : undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortOrder || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      
      let response;
      
      // If we're on the main applications page and have a status filter
      if (statusType === 'all' && enableStatusFilter && selectedStatus !== 'all') {
        // Use the status filtering method
        response = await adminApplicationsApi.getAllApplicationsWithStatusFilter(filters, selectedStatus);
      } else {
        // Use the existing status-specific methods
        switch (statusType) {
          case 'all':
            response = await adminApplicationsApi.getAllApplications(filters);
            break;
          case 'shortlisted':
            response = await adminApplicationsApi.getShortlistedApplications(filters);
            break;
          case 'technical-assessment':
            response = await adminApplicationsApi.getTechnicalAssessmentApplications(filters);
            break;
          case 'interviewing':
            response = await adminApplicationsApi.getInterviewingApplications(filters);
            break;
          case 'hired':
            response = await adminApplicationsApi.getHiredApplications(filters);
            break;
          case 'disqualified':
            response = await adminApplicationsApi.getDisqualifiedApplications(filters);
            break;
          case 'archived':
            response = await adminApplicationsApi.getArchivedApplications(filters);
            break;
          default:
            throw new Error(`Unknown status type: ${statusType}`);
        }
      }
      
      const apps = response.applications || [];
      
      setApplications(apps);
      setTotal(response.total || 0);
      setTotalPages(Math.ceil((response.total || 0) / pageSize));
      
    } catch (err) {
      console.error('Failed to load applications:', err);
      setError('Failed to load applications');
      toast.error('Failed to load applications');
      setApplications([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [statusType, currentPage, pageSize, debouncedSearchTerm, selectedPosition, selectedStatus, selectedAiScore, sortBy, sortOrder, dateFrom, dateTo, enableStatusFilter, enableAiScoreFilter]);

  // Load applications when dependencies change
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadApplications();
    }
  }, [isAuthenticated, isAdmin, loadApplications]);

  // Reset page when search, filters, or sort change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm, selectedPosition, selectedStatus, selectedAiScore, sortBy, sortOrder, dateFrom, dateTo]);

  // Load position filter options
  const loadPositionOptions = useCallback(async () => {
    if (!enablePositionFilter) return;
    
    try {
      // Use the dedicated positions endpoint for better performance
      const response = await adminApplicationsApi.getApplicationPositions(statusType, {
        archived: statusType === 'archived',
      }) as any;
      const positions = response.positions || [];

      const optionSet = new Set<string>();
      positions.forEach((pos: { value?: string; label?: string }) => {
        const title = (pos.value || pos.label || '').trim();
        if (title && title !== 'Position Not Available') {
          optionSet.add(title);
        }
      });
      setPositionFilterOptions(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      console.error('Failed to load position options:', error);
      // Fallback to the old method if the new endpoint fails
      try {
        const response = await adminApplicationsApi.getApplicationsByStatus(statusType, { limit: 500 });
        const apps = response.applications || [];
        
        const optionSet = new Set<string>();
        apps.forEach((app: Application) => {
          if (app.position && app.position !== 'Position Not Available') {
            optionSet.add(app.position.trim());
          }
        });
        
        setPositionFilterOptions(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
      } catch (fallbackError) {
        console.error('Fallback position loading also failed:', fallbackError);
      }
    }
  }, [statusType, enablePositionFilter]);

  // Merge job posting titles into position filter (skip for archived — backend returns those positions)
  useEffect(() => {
    if (!enablePositionFilter || statusType === "archived") return;

    setPositionFilterOptions((prev) => {
      const optionSet = new Set(prev);
      Object.values(jobTitles).forEach((title) => {
        const trimmed = title?.trim();
        if (trimmed && trimmed !== 'Position Not Available') {
          optionSet.add(trimmed);
        }
      });
      return Array.from(optionSet).sort((a, b) => a.localeCompare(b));
    });
  }, [jobTitles, enablePositionFilter]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadPositionOptions();
    }
  }, [isAuthenticated, isAdmin, loadPositionOptions]);

  // Handle search with immediate UI update
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  // Handle position filter change
  const handlePositionChange = useCallback((position: string) => {
    setSelectedPosition(position);
  }, []);

  // Handle status filter change
  const handleStatusChange = useCallback((status: string) => {
    setSelectedStatus(status);
  }, []);

  // Handle AI score filter change
  const handleAiScoreChange = useCallback((scoreFilter: string) => {
    setSelectedAiScore(scoreFilter);
  }, []);

  // Advanced filter handlers
  const handleSortByChange = useCallback((field: string) => {
    setSortBy(field);
  }, []);

  const handleSortOrderChange = useCallback((order: SortOrder) => {
    setSortOrder(order);
  }, []);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
  }, []);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedPosition('all');
    setSelectedStatus('all');
    setSelectedAiScore('all');
    setSortBy(DEFAULT_SORT_BY);
    setSortOrder(DEFAULT_SORT_ORDER);
    setDateFrom('');
    setDateTo('');
  }, []);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    selectedPosition !== 'all' ||
    selectedStatus !== 'all' ||
    selectedAiScore !== 'all' ||
    sortBy !== DEFAULT_SORT_BY ||
    sortOrder !== DEFAULT_SORT_ORDER ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  // Handle pagination
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // No need for client-side filtering since we're doing server-side filtering
  const filteredApplications = applications;

  // Action handlers
  const handleView = (id: string) => {
    const application = applications.find(app => app.id === id);
    if (application) {
      setViewApplication(application);
    }
  };

  const handleEdit = (id: string) => {
    const application = applications.find(app => app.id === id);
    if (application) {
      setEditApplication(application);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteApplicationId(id);
  };

  const handleSaveEdit = async (
    updatedApplication: Application,
    options?: { fromView?: boolean }
  ) => {
    try {
      const previousApplication = applications.find(app => app.id === updatedApplication.id);
      
      const saved = await adminApplicationsApi.updateApplication(
        updatedApplication.id,
        updatedApplication
      ) as Application;
      await loadApplications();

      if (options?.fromView) {
        setViewApplication({ ...updatedApplication, ...saved });
      } else {
        setEditApplication(null);
      }
      
      // Check if the application would still be visible with current filters
      const statusChanged = previousApplication?.status !== updatedApplication.status;
      const positionChanged = previousApplication?.position !== updatedApplication.position;
      
      if (statusChanged || positionChanged) {
        // Check if application would be filtered out
        let wouldBeFiltered = false;
        
        // Check status filter
        if (statusType === 'all' && enableStatusFilter && selectedStatus !== 'all') {
          wouldBeFiltered = updatedApplication.status !== selectedStatus;
        } else if (statusType !== 'all') {
          // Map frontend status types to backend status values
          const statusMap: Record<string, string> = {
            'shortlisted': 'Shortlisted',
            'technical-assessment': 'Technical Assessment',
            'interviewing': 'Interviewing',
            'hired': 'Hired',
            'disqualified': 'Disqualified',
          };
          const expectedStatus = statusMap[statusType] || statusType;
          wouldBeFiltered = updatedApplication.status !== expectedStatus;
        }
        
        // Check position filter
        if (!wouldBeFiltered && selectedPosition !== 'all') {
          wouldBeFiltered = updatedApplication.position !== selectedPosition;
        }
        
        if (wouldBeFiltered) {
          toast.success(
            `Application updated successfully. The application is now filtered out of this view due to status/position change.`,
            { duration: 5000 }
          );
        } else {
          toast.success('Application updated successfully');
        }
      } else {
        toast.success('Application updated successfully');
      }
    } catch (error) {
      console.error('Failed to update application:', error);
      toast.error('Failed to update application');
    }
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await adminApplicationsApi.deleteApplication(id);
      await loadApplications(); // Refresh data
      setDeleteApplicationId(null);
      toast.success('Application deleted successfully');
    } catch (error) {
      console.error('Failed to delete application:', error);
      toast.error('Failed to delete application');
    }
  };

  const handleBulkStatusUpdate = async (ids: string[], status: string) => {
    if (!enableBulkUpdates) return;
    
    try {
      await adminApplicationsApi.bulkUpdateStatus({ ids, status });
      await loadApplications(); // Refresh data
      toast.success(`Updated ${ids.length} application(s) to ${status}`);
    } catch (error) {
      console.error('Failed to update applications:', error);
      toast.error('Failed to update applications');
    }
  };

  const handleArchiveAll = async () => {
    try {
      const result = await adminApplicationsApi.archiveAllApplications();
      await loadApplications();
      toast.success(result.message || 'All applications archived successfully');
    } catch (error) {
      console.error('Failed to archive all applications:', error);
      toast.error('Failed to archive all applications');
      throw error;
    }
  };

  const handleBulkArchive = async (ids: string[]) => {
    if (!enableBulkUpdates) return;

    try {
      const result = await adminApplicationsApi.bulkArchiveApplications(ids);
      await loadApplications();
      toast.success(result.message || `Archived ${ids.length} application(s)`);
    } catch (error) {
      console.error('Failed to archive applications:', error);
      toast.error('Failed to archive applications');
    }
  };

  const handleBulkUnarchive = async (ids: string[]) => {
    try {
      const result = await adminApplicationsApi.bulkUnarchiveApplications(ids);
      await loadApplications();
      toast.success(result.message || `Restored ${ids.length} application(s)`);
    } catch (error) {
      console.error('Failed to restore applications:', error);
      toast.error('Failed to restore applications');
    }
  };

  const handleSaveFromView = async (updatedApplication: Application) => {
    await handleSaveEdit(updatedApplication, { fromView: true });
  };

  const rankApplicationsSequentially = async (
    targetIds: string[],
    mode: AiRankProgressState['mode']
  ) => {
    if (aiRankInFlightRef.current) {
      toast.error('AI ranking is already in progress');
      return { ranked: 0, errors: [] as Array<{ id: string; error: string }>, results: [] };
    }

    if (!targetIds.length) {
      toast.error('No applications to rank');
      return { ranked: 0, errors: [] as Array<{ id: string; error: string }>, results: [] };
    }

    aiRankInFlightRef.current = true;

    try {
    setAiRankProgress({
      isActive: true,
      current: 0,
      total: targetIds.length,
      phase: 'extracting',
      mode,
      candidateName: undefined,
    });

    let rankedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];
    const allResults: Awaited<ReturnType<typeof adminApplicationsApi.rankApplications>>['results'] = [];

    for (let index = 0; index < targetIds.length; index++) {
      const applicationId = targetIds[index];
      const application = applications.find((app) => app.id === applicationId);
      const candidateName = application ? getNameDisplay(application) : 'Candidate';

      setAiRankProgress({
        isActive: true,
        current: index,
        total: targetIds.length,
        phase: 'extracting',
        mode,
        applicationId,
        candidateName,
      });

      const phaseInterval = window.setInterval(() => {
        setAiRankProgress((current) =>
          current?.isActive
            ? { ...current, phase: cycleAiRankPhase(current.phase) }
            : current
        );
      }, 1600);

      try {
        const result = await adminApplicationsApi.rankApplications({ ids: [applicationId] });
        if (result.results?.length) {
          allResults.push(...result.results);
        }
        if (result.errors?.length) {
          errors.push(...result.errors);
        } else {
          rankedCount += result.ranked;
        }
      } catch (error) {
        errors.push({
          id: applicationId,
          error: error instanceof Error ? error.message : 'AI ranking failed',
        });
      } finally {
        window.clearInterval(phaseInterval);
      }

      setAiRankProgress({
        isActive: true,
        current: index + 1,
        total: targetIds.length,
        phase: 'saving',
        mode,
        applicationId,
        candidateName,
      });
    }

    setAiRankProgress(null);
    await loadApplications();

    return { ranked: rankedCount, errors, results: allResults };
    } finally {
      aiRankInFlightRef.current = false;
    }
  };

  const handleRankApplication = async (applicationId: string) => {
    try {
      const { ranked, errors, results } = await rankApplicationsSequentially(
        [applicationId],
        'single'
      );

      if (errors.length) {
        toast.error(errors[0].error || 'AI ranking failed');
        return;
      }

      const rankedResult = results?.[0];
      if (rankedResult && viewApplication?.id === applicationId) {
        setViewApplication((current) =>
          current
            ? {
                ...current,
                aiRankScore: rankedResult.aiRankScore,
                aiRankSummary: rankedResult.aiRankSummary,
                aiRankStrengths: rankedResult.aiRankStrengths,
                aiRankGaps: rankedResult.aiRankGaps,
                aiRankRecommendation: rankedResult.aiRankRecommendation,
                aiRankedAt: rankedResult.aiRankedAt,
              }
            : current
        );
      }

      if (ranked > 0) {
        toast.success('AI ranking complete');
      }
    } catch (error) {
      setAiRankProgress(null);
      console.error('Failed to rank application:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rank application');
    }
  };

  const handleRankApplications = async (ids?: string[]) => {
    try {
      const targetIds = ids?.length ? ids : applications.map((app) => app.id);
      const { ranked, errors, results } = await rankApplicationsSequentially(
        targetIds,
        'batch'
      );

      if (viewApplication && results?.length) {
        const rankedItem = results.find((item) => item.id === viewApplication.id);
        if (rankedItem) {
          setViewApplication({
            ...viewApplication,
            aiRankScore: rankedItem.aiRankScore,
            aiRankSummary: rankedItem.aiRankSummary,
            aiRankStrengths: rankedItem.aiRankStrengths,
            aiRankGaps: rankedItem.aiRankGaps,
            aiRankRecommendation: rankedItem.aiRankRecommendation,
            aiRankedAt: rankedItem.aiRankedAt,
          });
        }
      }

      if (errors.length && !ranked) {
        toast.error(errors[0].error || 'AI ranking failed');
        return;
      }

      if (errors.length && ranked) {
        toast.success(`Ranked ${ranked} application(s). ${errors.length} failed.`);
        return;
      }

      toast.success(`Ranked ${ranked} application(s) with AI`);
    } catch (error) {
      setAiRankProgress(null);
      console.error('Failed to rank applications:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rank applications');
    }
  };

  return {
    // Data
    applications: filteredApplications,
    jobTitles,
    isLoading: isLoading || authLoading,
    error,
    total,
    currentPage,
    totalPages,
    
    // Authentication
    isAuthenticated,
    isAdmin,
    
    // Filters
    searchTerm,
    setSearchTerm: handleSearch,
    selectedPosition,
    setSelectedPosition: handlePositionChange,
    positionFilterOptions,
    selectedStatus,
    setSelectedStatus: handleStatusChange,
    statusFilterOptions,
    selectedAiScore,
    setSelectedAiScore: handleAiScoreChange,
    aiScoreFilterOptions: AI_SCORE_FILTER_OPTIONS,

    // Advanced filters (sorting + applied-date range)
    sortBy,
    setSortBy: handleSortByChange,
    sortOrder,
    setSortOrder: handleSortOrderChange,
    toggleSortOrder,
    sortFieldOptions: APPLICATION_SORT_OPTIONS,
    dateFrom,
    setDateFrom: handleDateFromChange,
    dateTo,
    setDateTo: handleDateToChange,
    resetFilters,
    hasActiveFilters,
    
    // Pagination
    handlePageChange,
    
    // Modals
    viewApplication,
    setViewApplication,
    editApplication,
    setEditApplication,
    deleteApplicationId,
    setDeleteApplicationId,
    
    // Actions
    handleView,
    handleEdit,
    handleDelete,
    handleSaveEdit,
    handleSaveFromView,
    handleRankApplication,
    handleRankApplications,
    aiRankProgress,
    rankingApplicationId: aiRankProgress?.applicationId ?? null,
    isAiRanking: Boolean(aiRankProgress?.isActive),
    handleConfirmDelete,
    handleBulkStatusUpdate: enableBulkUpdates ? handleBulkStatusUpdate : undefined,
    handleBulkArchive: enableBulkUpdates ? handleBulkArchive : undefined,
    handleArchiveAll,
    handleBulkUnarchive,
    
    // Utilities
    refreshData: loadApplications,
  };
}
