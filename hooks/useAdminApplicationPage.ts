"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminApplicationsApi, type ApplicationFilters } from '@/lib';
import { Application } from '@/types/application';
import { toast } from 'react-hot-toast';
import { useDebounce } from './useDebounce';

export type StatusType = 'all' | 'shortlisted' | 'technical-assessment' | 'interviewing' | 'hired' | 'disqualified';

interface UseAdminApplicationPageOptions {
  statusType: StatusType;
  dateField?: string;
  enableBulkUpdates?: boolean;
  enablePositionFilter?: boolean;
  enableStatusFilter?: boolean;
}

export function useAdminApplicationPage({
  statusType,
  dateField,
  enableBulkUpdates = true,
  enablePositionFilter = true,
  enableStatusFilter = false,
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
  
  // Debounce search term to avoid too many API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Modals
  const [viewApplication, setViewApplication] = useState<Application | null>(null);
  const [editApplication, setEditApplication] = useState<Application | null>(null);
  const [deleteApplicationId, setDeleteApplicationId] = useState<string | null>(null);

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
        const response = await adminApplicationsApi.getJobPostings();
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
          default:
            throw new Error(`Unknown status type: ${statusType}`);
        }
      }
      
      const apps = response.applications || [];
      console.log('🔍 Search Debug:', {
        searchTerm: debouncedSearchTerm,
        totalApplications: apps.length,
        totalCount: response.total,
        sampleAppData: apps.slice(0, 2).map(app => ({
          id: app.id,
          name: app.name,
          email: app.email,
          position: app.position,
          userEmail: app.user?.email,
          userName: app.user?.name
        }))
      });
      
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
  }, [statusType, currentPage, pageSize, debouncedSearchTerm, selectedPosition, selectedStatus, enableStatusFilter]);

  // Load applications when dependencies change
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadApplications();
    }
  }, [isAuthenticated, isAdmin, loadApplications]);

  // Reset page when search, position filter, or status filter changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearchTerm, selectedPosition, selectedStatus]);

  // Load position filter options
  const loadPositionOptions = useCallback(async () => {
    if (!enablePositionFilter) return;
    
    try {
      // Use the dedicated positions endpoint for better performance
      const response = await adminApplicationsApi.getApplicationPositions(statusType) as any;
      const positions = response.positions || [];
      
      const positionOptions = positions.map((pos: any) => pos.value || pos.label);
      setPositionFilterOptions(positionOptions.sort((a: string, b: string) => a.localeCompare(b)));
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

  const handleSaveEdit = async (updatedApplication: Application) => {
    try {
      const previousApplication = applications.find(app => app.id === updatedApplication.id);
      
      await adminApplicationsApi.updateApplication(updatedApplication.id, updatedApplication);
      await loadApplications(); // Refresh data
      setEditApplication(null);
      
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
    handleConfirmDelete,
    handleBulkStatusUpdate: enableBulkUpdates ? handleBulkStatusUpdate : undefined,
    
    // Utilities
    refreshData: loadApplications,
  };
}
