/**
 * Status History Management Utilities for Frontend
 * 
 * This module provides utilities for working with application status history
 * on the frontend, including formatting, validation, and timeline rendering.
 */

import { StatusHistoryEntry, Application } from '../types/application';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
  description: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  'New': {
    label: 'New Application',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-700',
    icon: 'clock',
    description: 'Application has been submitted and is awaiting review'
  },
  'Shortlisted': {
    label: 'Shortlisted',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-700',
    icon: 'check-circle',
    description: 'Application has been reviewed and candidate is shortlisted'
  },
  'Technical Assessment': {
    label: 'Technical Assessment',
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    borderColor: 'border-yellow-200 dark:border-yellow-700',
    icon: 'code',
    description: 'Candidate is undergoing technical assessment'
  },
  'Interviewing': {
    label: 'Interview Stage',
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-700',
    icon: 'users',
    description: 'Candidate is in the interview process'
  },
  'Hired': {
    label: 'Hired',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/20',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-200 dark:border-emerald-700',
    icon: 'check-badge',
    description: 'Candidate has been successfully hired'
  },
  'Rejected': {
    label: 'Rejected',
    color: 'from-red-500 to-rose-500',
    bgColor: 'bg-red-100 dark:bg-red-900/20',
    textColor: 'text-red-700 dark:text-red-300',
    borderColor: 'border-red-200 dark:border-red-700',
    icon: 'x-circle',
    description: 'Application has been rejected'
  },
  'Disqualified': {
    label: 'Disqualified',
    color: 'from-gray-500 to-slate-500',
    bgColor: 'bg-gray-100 dark:bg-gray-900/20',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-200 dark:border-gray-700',
    icon: 'minus-circle',
    description: 'Candidate has been disqualified'
  }
};

export const STATUS_PRIORITY: Record<string, number> = {
  'New': 0,
  'Shortlisted': 1,
  'Technical Assessment': 2,
  'Interviewing': 3,
  'Hired': 4,
  'Rejected': 5,
  'Disqualified': 6
};

export const VALID_TRANSITIONS: Record<string, string[]> = {
  'New': ['Shortlisted', 'Rejected', 'Disqualified'],
  'Shortlisted': ['Technical Assessment', 'Interviewing', 'Rejected', 'Disqualified'],
  'Technical Assessment': ['Interviewing', 'Shortlisted', 'Rejected', 'Disqualified'],
  'Interviewing': ['Hired', 'Rejected', 'Technical Assessment', 'Disqualified'],
  'Hired': ['Disqualified'],
  'Rejected': [],
  'Disqualified': []
};

export class StatusHistoryManager {
  /**
   * Get the current status from status history
   */
  static getCurrentStatus(statusHistory: StatusHistoryEntry[]): string {
    if (!statusHistory || statusHistory.length === 0) {
      return 'New';
    }
    
    const sortedHistory = [...statusHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return sortedHistory[sortedHistory.length - 1].status;
  }

  /**
   * Check if a status transition is valid
   */
  static isValidTransition(fromStatus: string, toStatus: string): boolean {
    return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) || false;
  }

  /**
   * Get all valid next statuses for a current status
   */
  static getValidNextStatuses(currentStatus: string): string[] {
    return VALID_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Get the date when a specific status was first reached
   */
  static getStatusDate(statusHistory: StatusHistoryEntry[], status: string): Date | null {
    const entry = statusHistory.find(entry => entry.status === status);
    return entry ? new Date(entry.date) : null;
  }

  /**
   * Get duration spent in a specific status
   */
  static getStatusDuration(statusHistory: StatusHistoryEntry[], status: string): number | null {
    const sortedHistory = [...statusHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const statusIndex = sortedHistory.findIndex(entry => entry.status === status);
    if (statusIndex === -1) return null;
    
    const startDate = new Date(sortedHistory[statusIndex].date);
    const endDate = statusIndex + 1 < sortedHistory.length 
      ? new Date(sortedHistory[statusIndex + 1].date)
      : new Date();
    
    return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get total processing time from application to current status
   */
  static getTotalProcessingTime(statusHistory: StatusHistoryEntry[]): number {
    if (!statusHistory || statusHistory.length === 0) return 0;
    
    const sortedHistory = [...statusHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const startDate = new Date(sortedHistory[0].date);
    const endDate = new Date(sortedHistory[sortedHistory.length - 1].date);
    
    return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Format status history for timeline display
   */
  static formatForTimeline(statusHistory: StatusHistoryEntry[]): Array<{
    status: string;
    date: string;
    formattedDate: string;
    reason?: string;
    changedBy?: string;
    config: StatusConfig;
    metadata?: any;
  }> {
    if (!statusHistory) return [];
    
    const sortedHistory = [...statusHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return sortedHistory.map(entry => ({
      status: entry.status,
      date: entry.date.toString(),
      formattedDate: this.formatDate(new Date(entry.date)),
      reason: entry.reason,
      changedBy: entry.changedBy,
      config: STATUS_CONFIG[entry.status] || STATUS_CONFIG['New'],
      metadata: entry.metadata
    }));
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get relative time (e.g., "2 days ago")
   */
  static getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  }

  /**
   * Get status statistics for an application
   */
  static getStatusStats(statusHistory: StatusHistoryEntry[]): {
    currentStatus: string;
    totalStatusChanges: number;
    totalProcessingDays: number;
    statusBreakdown: Record<string, {
      count: number;
      firstDate: Date;
      lastDate: Date;
      totalDays: number;
    }>;
    applicationDate: Date;
    lastUpdated: Date;
  } {
    if (!statusHistory || statusHistory.length === 0) {
      return {
        currentStatus: 'New',
        totalStatusChanges: 0,
        totalProcessingDays: 0,
        statusBreakdown: {},
        applicationDate: new Date(),
        lastUpdated: new Date()
      };
    }

    const sortedHistory = [...statusHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const currentStatus = sortedHistory[sortedHistory.length - 1].status;
    const applicationDate = new Date(sortedHistory[0].date);
    const lastUpdated = new Date(sortedHistory[sortedHistory.length - 1].date);
    const totalProcessingDays = Math.floor(
      (lastUpdated.getTime() - applicationDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate status breakdown
    const statusBreakdown: Record<string, any> = {};
    
    for (const entry of statusHistory) {
      const status = entry.status;
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = {
          count: 0,
          firstDate: new Date(entry.date),
          lastDate: new Date(entry.date),
          totalDays: 0
        };
      }
      statusBreakdown[status].count += 1;
      statusBreakdown[status].lastDate = new Date(Math.max(
        statusBreakdown[status].lastDate.getTime(),
        new Date(entry.date).getTime()
      ));
      statusBreakdown[status].firstDate = new Date(Math.min(
        statusBreakdown[status].firstDate.getTime(),
        new Date(entry.date).getTime()
      ));
    }

    // Calculate duration for each status
    for (const status in statusBreakdown) {
      const duration = this.getStatusDuration(statusHistory, status);
      statusBreakdown[status].totalDays = duration || 0;
    }

    return {
      currentStatus,
      totalStatusChanges: statusHistory.length - 1,
      totalProcessingDays,
      statusBreakdown,
      applicationDate,
      lastUpdated
    };
  }

  /**
   * Create a new status history entry
   */
  static createStatusEntry(
    status: string,
    changedBy?: string,
    reason?: string,
    metadata?: any
  ): StatusHistoryEntry {
    return {
      status,
      date: new Date(),
      changedBy,
      reason: reason || `Status changed to ${status}`,
      metadata: metadata || {}
    };
  }

  /**
   * Validate status history integrity
   */
  static validateStatusHistory(statusHistory: StatusHistoryEntry[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!statusHistory || statusHistory.length === 0) {
      return { isValid: true, errors: [] };
    }

    const sortedHistory = [...statusHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Check if first status is 'New'
    if (sortedHistory[0].status !== 'New') {
      errors.push('First status should be "New"');
    }

    // Check for valid transitions
    for (let i = 1; i < sortedHistory.length; i++) {
      const prevStatus = sortedHistory[i - 1].status;
      const currentStatus = sortedHistory[i].status;
      
      if (!this.isValidTransition(prevStatus, currentStatus)) {
        errors.push(`Invalid transition from "${prevStatus}" to "${currentStatus}"`);
      }
    }

    // Check for chronological order
    for (let i = 1; i < sortedHistory.length; i++) {
      const prevDate = new Date(sortedHistory[i - 1].date);
      const currentDate = new Date(sortedHistory[i].date);
      
      if (currentDate <= prevDate) {
        errors.push('Status changes must be in chronological order');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
