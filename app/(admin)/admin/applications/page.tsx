"use client";

import { useState, useEffect, useMemo } from "react";
import { ApplicationsTable } from "./ApplicationsTable";
import { EditApplicationModal } from "@/components/admin/EditApplicationModal";
import { ViewApplicationModal } from "@/components/admin/ViewApplicationModal";
import { DeleteApplicationModal } from "@/components/admin/DeleteApplicationModal";
import { Application } from "@/types/application";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Upload, FileText, Sheet, Search, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/lib/auth-backend";
import { toast } from "sonner";
import { adminApi } from "@/lib/api-backend";
import { useAuthErrorHandler } from "@/hooks/useAuthErrorHandler";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Add sort options type
type SortOption = {
  field: string;
  label: string;
  order: 'asc' | 'desc';
};

export default function ApplicationsPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, authLoading } = useAuth();
  const { handleError: handleAuthError } = useAuthErrorHandler();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [jobFilterOptions, setJobFilterOptions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [viewApplication, setViewApplication] = useState<Application | null>(null);
  const [editApplication, setEditApplication] = useState<Application | null>(null);
  const [deleteApplicationId, setDeleteApplicationId] = useState<string | null>(null);
  const normalize = (value: string): string => {
    return value?.trim().replace(/\s+/g, " ") || "";
  };

  const getApplicationPosition = (app: Application): string => {
    if (app.position) return normalize(String(app.position));
    return normalize(app.jobDetails?.title || "");
  };

  const positionOptions = useMemo(() => {
    return ["all", ...jobFilterOptions];
  }, [jobFilterOptions]);

  const filteredApplications = useMemo(() => {
    let filtered = applications || [];
    
    // Filter by position
    if (selectedPosition && selectedPosition !== "all") {
      filtered = filtered.filter(app => normalize(getApplicationPosition(app)) === selectedPosition);
    }
    
    // Filter by status
    if (selectedStatus && selectedStatus !== "all") {
      filtered = filtered.filter(app => app.status === selectedStatus);
    }
    
    // Filter by search term (client-side)
    if (searchTerm && searchTerm.trim() !== "") {
      const needle = searchTerm.toLowerCase();
      filtered = filtered.filter((app) => {
        const valuesToSearch: Array<string> = [
          String(app.name || ""),
          String(app.email || ""),
          String(app.phoneNumber || ""),
          String(getApplicationPosition(app) || ""),
          String(app.status || ""),
        ];
        // Include answers text if present
        if (Array.isArray((app as any).answers)) {
          (app as any).answers.forEach((a: any) => {
            if (a?.questionText) valuesToSearch.push(String(a.questionText));
            if (a?.answer) valuesToSearch.push(String(a.answer));
          });
        }
        return valuesToSearch.some((val) => val.toLowerCase().includes(needle));
      });
    }
    
    return filtered;
  }, [applications, selectedPosition, selectedStatus, searchTerm]);


  // Sort options
  const sortOptions: SortOption[] = [
    { field: 'createdAt', label: 'Latest Applications', order: 'desc' },
    { field: 'createdAt', label: 'Oldest Applications', order: 'asc' },
    { field: 'status', label: 'Status (A-Z)', order: 'asc' },
    { field: 'status', label: 'Status (Z-A)', order: 'desc' },
    { field: 'updatedAt', label: 'Last Updated (Newest)', order: 'desc' },
    { field: 'updatedAt', label: 'Last Updated (Oldest)', order: 'asc' },
    { field: 'appliedDate', label: 'Applied Date (Newest)', order: 'desc' },
    { field: 'appliedDate', label: 'Applied Date (Oldest)', order: 'asc' }
  ];

  // Handle sort selection
  const handleSortChange = (option: SortOption) => {
    setSortBy(option.field);
    setSortOrder(option.order);
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Handle status filter change
  const handleStatusChange = (status: string) => {
    setSelectedStatus(status === "all" ? "" : status);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  // Handle position filter change
  const handlePositionChange = (position: string) => {
    setSelectedPosition(position === "all" ? "" : position);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  // Check authentication
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Fetch applications
  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching applications with params:', {
        skip: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
        status: selectedStatus || undefined,
        search: searchTerm || undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      });

      const response = await adminApi.getApplications({
        skip: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
        status: selectedStatus || undefined,
        search: searchTerm || undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      });

      console.log('Applications response:', response);

      if (!response || typeof response !== 'object') {
        console.error('Invalid response format:', response);
        setError('Invalid response format from server');
        return;
      }

      const applications = Array.isArray(response.applications) ? response.applications : [];
      const total = typeof response.total === 'number' ? response.total : 0;

      // Map the new structure to match existing application interface
      const mappedApplications = applications.map(app => {
        // Helper function to safely extract answer by question keywords - more flexible approach
        const getAnswerByKeywords = (keywords: string[]) => {
          if (!app.answers || !Array.isArray(app.answers)) return null;
          
          const found = app.answers.find(a => {
            if (!a?.questionText || typeof a.questionText !== 'string') return false;
            const questionLower = a.questionText.toLowerCase();
            return keywords.some(keyword => questionLower.includes(keyword.toLowerCase()));
          });
          
          return found?.answer || null;
        };
        
        // Enhanced helper function for better name extraction
        const getNameFromAnswers = () => {
          // First check if we have userDetails with name
          if (app.userDetails?.name && app.userDetails.name.trim() !== '') {
            return app.userDetails.name.trim();
          }
          
          // If no answers array, return placeholder indicating missing data
          if (!app.answers || !Array.isArray(app.answers) || app.answers.length === 0) {
            return 'No Application Data';
          }
          
          // Try various name field combinations
          const firstName = getAnswerByKeywords(['first name', 'firstname', 'given name', 'forename']) || '';
          const lastName = getAnswerByKeywords(['last name', 'lastname', 'surname', 'family name']) || '';
          
          // If we have both parts, combine them
          if (firstName && lastName) {
            return `${firstName} ${lastName}`.trim();
          }
          
          // Try single name fields
          const fullName = getAnswerByKeywords(['full name', 'name', 'your name', 'applicant name']) || '';
          if (fullName) return fullName;
          
          // Try the first or last name alone if we only have one
          if (firstName) return firstName;
          if (lastName) return lastName;
          
          // Last resort: look for ANY field that might contain a name
          const possibleNameField = app.answers.find(a => {
            if (!a?.questionText || !a?.answer) return false;
            const question = a.questionText.toLowerCase();
            const answer = String(a.answer).trim();
            
            // Skip obvious non-name fields
            if (question.includes('email') || question.includes('phone') || 
                question.includes('position') || question.includes('experience') ||
                question.includes('cv') || question.includes('resume') ||
                answer.includes('@') || answer.length < 2) {
              return false;
            }
            
            // Look for fields that likely contain names
            return question.includes('name') || 
                   (answer.length > 2 && answer.length < 50 && 
                    /^[a-zA-Z\s'-]+$/.test(answer));
          });
          
          if (possibleNameField) {
            return String(possibleNameField.answer).trim();
          }
          
          // Indicate that this is an incomplete application
          return 'Incomplete Application';
        };

        // Enhanced email extraction
        const getEmailFromAnswers = () => {
          // First check userDetails
          if (app.userDetails?.email && app.userDetails.email.trim() !== '') {
            return app.userDetails.email.trim();
          }
          
          // If no answers, return placeholder
          if (!app.answers || !Array.isArray(app.answers) || app.answers.length === 0) {
            return 'No Contact Info';
          }
          
          // Extract from answers
          const email = getAnswerByKeywords(['email', 'e-mail', 'email address', 'contact email', 'e mail']) || '';
          
          if (email && email.includes('@')) {
            return email;
          }
          
          // Look for any field that looks like an email
          const emailField = app.answers.find(a => {
            const answer = String(a?.answer || '').trim();
            return answer.includes('@') && answer.includes('.');
          });
          
          return emailField ? String(emailField.answer).trim() : 'No Email Provided';
        };

        // Extract name components with enhanced logic - prioritize existing processed data
        const extractedName = app.name && app.name.trim() !== '' ? app.name.trim() : getNameFromAnswers();
        
        // Build full name
        let fullName = extractedName;

        // Extract email with enhanced logic - prioritize existing processed data
        const email = app.email && app.email.trim() !== '' ? app.email.trim() : getEmailFromAnswers();

        // Extract phone number
        const phoneNumber = getAnswerByKeywords(['phone', 'phone number', 'mobile', 'contact', 'telephone']) || 'N/A';

        // Extract position
        const position = app.position && app.position.trim() !== '' ? app.position.trim() :
                        app.jobDetails?.title || 
                        getAnswerByKeywords(['position', 'job title', 'role', 'job']) || 
                        'N/A';

        return {
          ...app,
          id: app.id || app._id,
          name: fullName,
          email: email,
          phoneNumber: phoneNumber,
          position: position,
          status: app.status || 'New',
          appliedDate: new Date(app.appliedDate),
          cvUrl: app.cvUrl || '',
          jobId: app.jobId,
          jobDetails: app.jobDetails
        };
      });

      setApplications(mappedApplications);
      setTotalPages(Math.ceil(total / itemsPerPage) || 1);

      // No need to fetch job titles separately as they're included in jobDetails now
      const jobTitlesMap: Record<string, string> = {};
      applications.forEach(app => {
        if (app.jobDetails?.id && app.jobDetails?.title) {
          jobTitlesMap[app.jobDetails.id] = app.jobDetails.title;
        }
      });
      setJobTitles(jobTitlesMap);

    } catch (error) {
      console.error('Failed to fetch applications:', error);
      
      // Handle authentication errors through the global handler
      const isAuthError = handleAuthError(error);
      
      if (!isAuthError) {
        setError('Failed to fetch applications');
        toast.error('Failed to fetch applications');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchApplications();
    }
  }, [isAuthenticated, isAdmin, currentPage, selectedStatus, sortBy, sortOrder]);

  // Fetch job postings for position filter values
  useEffect(() => {
    const fetchJobPostings = async () => {
      try {
        const jobsResponse = await adminApi.getJobPostings();
        const jobs = Array.isArray(jobsResponse) ? jobsResponse : (jobsResponse?.jobPostings || []);
        const optionSet = new Set<string>();
        jobs.forEach((job: any) => {
          if (job?.title) optionSet.add(normalize(String(job.title)));
        });
        setJobFilterOptions(Array.from(optionSet).sort((a, b) => a.localeCompare(b)));
      } catch (e) {
        // Non-blocking: if it fails, filter just won't show options
        console.error("Failed to fetch job postings for filter:", e);
      }
    };

    if (isAuthenticated && isAdmin) {
      fetchJobPostings();
    }
  }, [isAuthenticated, isAdmin]);

  // Handlers
  const handleView = (id: string) => {
    const application = applications.find(app => app.id === id);
    setViewApplication(application || null);
  };

  const handleEdit = (id: string) => {
    const application = applications.find(app => app.id === id);
    setEditApplication(application || null);
  };

  const handleDelete = (id: string) => {
    setDeleteApplicationId(id);
  };

  const handleSaveEdit = async (updatedApplication: Application) => {
    try {
      await adminApi.updateApplication(updatedApplication.id, updatedApplication);
      await fetchApplications();
      setEditApplication(null);
      toast.success('Application updated successfully');
    } catch (error) {
      console.error('Failed to update application:', error);
      const isAuthError = handleAuthError(error);
      if (!isAuthError) {
        toast.error('Failed to update application');
      }
    }
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await adminApi.deleteApplication(id);
      await fetchApplications();
      setDeleteApplicationId(null);
      toast.success('Application deleted successfully');
    } catch (error) {
      console.error('Failed to delete application:', error);
      const isAuthError = handleAuthError(error);
      if (!isAuthError) {
        toast.error('Failed to delete application');
      }
    }
  };

  const handleBulkStatusChange = async (ids: string[], newStatus: string) => {
    try {
      await adminApi.updateBulkApplicationStatus(ids, newStatus);
      await fetchApplications();
      toast.success('Applications updated successfully');
    } catch (error) {
      console.error('Failed to update applications:', error);
      const isAuthError = handleAuthError(error);
      if (!isAuthError) {
        toast.error('Failed to update applications');
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await adminApi.deleteBulkApplications(ids);
      await fetchApplications();
      toast.success('Applications deleted successfully');
    } catch (error) {
      console.error('Failed to delete applications:', error);
      const isAuthError = handleAuthError(error);
      if (!isAuthError) {
        toast.error('Failed to delete applications');
      }
    }
  };

  if (authLoading) {
    return (
      <AdminPageLayout title="Applications">
        <TableSkeleton />
      </AdminPageLayout>
    );
  }

  if (error) {
    return (
      <AdminPageLayout title="Applications">
        <div className="p-4 text-red-500">
          Error: {error}
          <Button onClick={fetchApplications} className="ml-2">
            Retry
          </Button>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout 
      title="Applications" 
      searchPlaceholder="Search applications..."
      searchValue={searchTerm}
      onSearch={setSearchTerm}
      headerActions={
        <div className="flex items-center space-x-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort Applications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map((option, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={() => handleSortChange(option)}
                  className="cursor-pointer"
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Sheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="flex flex-col">
        <div className="mb-4 flex items-end gap-4">
          <div className="w-64">
            <Label htmlFor="position-filter">Filter by position</Label>
            <Select value={selectedPosition || "all"} onValueChange={handlePositionChange}>
              <SelectTrigger id="position-filter">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positionOptions.map(option => (
                  <SelectItem key={option} value={option}>
                    {option === "all" ? "All Positions" : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-64">
            <Label htmlFor="status-filter">Filter by status</Label>
            <Select value={selectedStatus || "all"} onValueChange={handleStatusChange}>
              <SelectTrigger id="status-filter">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Applied">Applied</SelectItem>
                <SelectItem value="In Review">In Review</SelectItem>
                <SelectItem value="Technical Assessment">Technical Assessment</SelectItem>
                <SelectItem value="Interviewing">Interviewing</SelectItem>
                <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                <SelectItem value="Hired">Hired</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Disqualified">Disqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <ApplicationsTable
            applications={filteredApplications}
            jobTitles={jobTitles}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkDelete={handleBulkDelete}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Modals */}
        <ViewApplicationModal
          application={viewApplication}
          isOpen={!!viewApplication}
          onClose={() => setViewApplication(null)}
        />
        <EditApplicationModal
          application={editApplication}
          isOpen={!!editApplication}
          onClose={() => setEditApplication(null)}
          onSave={handleSaveEdit}
        />
        <DeleteApplicationModal
          applicationId={deleteApplicationId}
          isOpen={!!deleteApplicationId}
          onClose={() => setDeleteApplicationId(null)}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </AdminPageLayout>
  );
}
