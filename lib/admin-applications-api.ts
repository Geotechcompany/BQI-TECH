/**
 * Unified API service for admin application management across all status pages
 * This ensures consistency between Applications, Shortlisted, Technical Assessment, 
 * Interviewing, Hired, and Disqualified pages
 */

import { authService } from '@/lib/auth-backend';

export interface ApplicationFilters {
  position?: string;
  search?: string;
  skip?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  applications: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface BulkUpdateRequest {
  ids: string[];
  status: string;
}

class AdminApplicationsApi {
  private baseUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'https://api.bqitech.com';

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    useAdminEndpoint: boolean = true
  ): Promise<T> {
    const session = authService.getSession();
    if (!session) {
      throw new Error('No authentication session');
    }

    const url = `${this.baseUrl}/api${useAdminEndpoint ? '/admin' : ''}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.token}`,
      'Accept': 'application/json'
    };

    const requestOptions: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    let response = await fetch(url, requestOptions);

    // Handle token refresh
    if (response.status === 401) {
      const refreshed = await authService.refreshToken();
      if (!refreshed) {
        window.location.href = '/login';
        throw new Error('Session expired');
      }

      // Retry with new token
      requestOptions.headers = {
        ...defaultHeaders,
        'Authorization': `Bearer ${refreshed.access_token}`,
        ...options.headers,
      };
      
      response = await fetch(url, requestOptions);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Get applications by status
  async getApplicationsByStatus(
    status: 'all' | 'shortlisted' | 'technical-assessment' | 'interviewing' | 'hired' | 'disqualified',
    filters: ApplicationFilters = {}
  ) {
    const params = new URLSearchParams();
    
    // Map frontend status to backend status format
    const statusMap: Record<string, string> = {
      'shortlisted': 'Shortlisted',
      'technical-assessment': 'Technical Assessment',
      'interviewing': 'Interviewing',
      'hired': 'Hired',
      'disqualified': 'Disqualified',
    };
    
    // Add status parameter for non-'all' statuses
    if (status !== 'all') {
      const backendStatus = statusMap[status] || status;
      params.append('status', backendStatus);
    }
    
    if (filters.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sort_by', filters.sortBy);
    if (filters.sortOrder) params.append('sort_order', filters.sortOrder);
    if (filters.search) params.append('search', filters.search);
    if (filters.position && filters.position !== 'all') params.append('position', filters.position);

    const queryString = params.toString();
    
    // Use the correct endpoint based on status
    let endpoint: string;
    if (status === 'shortlisted') {
      // Use dedicated shortlisted endpoint
      endpoint = `/applications/shortlisted${queryString ? `?${queryString}` : ''}`;
    } else if (status === 'disqualified') {
      // Use dedicated disqualified endpoint
      endpoint = `/applications/disqualified${queryString ? `?${queryString}` : ''}`;
    } else {
      // Use general applications endpoint with status parameter
      endpoint = `/applications${queryString ? `?${queryString}` : ''}`;
    }

    const response = await this.makeRequest<ApiResponse<any>>(endpoint);
    
    // Ensure consistent response format
    if (Array.isArray(response)) {
      return {
        applications: response,
        total: response.length,
        page: 1,
        totalPages: 1
      };
    }
    
    return response;
  }

  // Update single application
  async updateApplication(applicationId: string, updateData: any) {
    return this.makeRequest(`/applications/${applicationId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  // Delete single application
  async deleteApplication(applicationId: string) {
    return this.makeRequest(`/applications/${applicationId}`, {
      method: 'DELETE',
    });
  }

  // Bulk update application status
  async bulkUpdateStatus(request: BulkUpdateRequest) {
    return this.makeRequest('/applications/bulk-status', {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  // Get job postings for position filtering
  async getJobPostings() {
    return this.makeRequest('/job-postings');
  }

  // Get application positions for filtering
  async getApplicationPositions(status?: string) {
    const params = new URLSearchParams();
    if (status && status !== 'all') {
      // Map frontend status to backend status format
      const statusMap: Record<string, string> = {
        'shortlisted': 'Shortlisted',
        'technical-assessment': 'Technical Assessment',
        'interviewing': 'Interviewing',
        'hired': 'Hired',
        'disqualified': 'Disqualified',
      };
      
      const backendStatus = statusMap[status] || status;
      params.append('status', backendStatus);
    }
    
    const queryString = params.toString();
    const endpoint = `/applications/positions${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest(endpoint);
  }

  // Get all applications with optional status filter (for main applications page)
  async getAllApplicationsWithStatusFilter(filters: ApplicationFilters = {}, status?: string) {
    const params = new URLSearchParams();
    
    // Add status parameter if provided
    if (status && status !== 'all') {
      params.append('status', status);
    }
    
    if (filters.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sort_by', filters.sortBy);
    if (filters.sortOrder) params.append('sort_order', filters.sortOrder);
    if (filters.search) params.append('search', filters.search);
    if (filters.position && filters.position !== 'all') params.append('position', filters.position);

    const queryString = params.toString();
    const endpoint = `/applications${queryString ? `?${queryString}` : ''}`;

    const response = await this.makeRequest<ApiResponse<any>>(endpoint);
    
    // Ensure consistent response format
    if (Array.isArray(response)) {
      return {
        applications: response,
        total: response.length,
        page: 1,
        totalPages: 1
      };
    }
    
    return response;
  }

  // Get all applications (main applications page)
  async getAllApplications(filters: ApplicationFilters = {}) {
    return this.getAllApplicationsWithStatusFilter(filters);
  }

  // Status-specific methods for easier use
  async getShortlistedApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus('shortlisted', filters);
  }

  async getTechnicalAssessmentApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus('technical-assessment', filters);
  }

  async getInterviewingApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus('interviewing', filters);
  }

  async getHiredApplications(filters: ApplicationFilters = {}) {
    return this.getApplicationsByStatus('hired', filters);
  }

  async getDisqualifiedApplications(filters: ApplicationFilters = {}) {
    // Since rejected and disqualified are handled as a single status in the backend,
    // we just fetch disqualified applications using the dedicated endpoint
    return this.getApplicationsByStatus('disqualified', filters);
  }
}

export const adminApplicationsApi = new AdminApplicationsApi();
