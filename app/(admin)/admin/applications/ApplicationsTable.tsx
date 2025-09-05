"use client";

import { useState } from "react";
import { Application } from "@/types/application";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Check } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Column<T> {
  header: string;
  accessor: (row: T) => string | number | Date;
  cell?: (value: ReturnType<Column<T>['accessor']>) => React.ReactNode;
}

interface ApplicationsTableProps {
  applications: Application[];
  jobTitles: Record<string, string>;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkStatusChange: (ids: string[], status: string) => void;
  onBulkDelete: (ids: string[]) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const isUUID = (str: string) => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

// Helper function for name and email extraction only (position now uses jobId references)
const extractDataFromAnswers = (answers: any[], type: 'name' | 'email', user?: any): string => {
  if (!Array.isArray(answers)) {
    // If no answers array, check if we have user data
    if (type === 'name' && user?.name) return user.name;
    if (type === 'email' && user?.email) return user.email;
    return type === 'name' ? 'No Application Data' : 'No Contact Info';
  }
  
  let keywords: string[] = [];
  
  switch (type) {
    case 'name':
      // First check user data
      if (user?.name && user.name.trim() !== '') {
        return user.name.trim();
      }
      
      // Try various name field combinations
      const firstName = getAnswerByKeywords(answers, ['first name', 'firstname', 'given name', 'forename']);
      const lastName = getAnswerByKeywords(answers, ['last name', 'lastname', 'surname', 'family name']);
      
      // If we have both parts, combine them
      if (firstName && lastName) {
        return `${firstName} ${lastName}`.trim();
      }
      
      // Try single name fields
      const fullName = getAnswerByKeywords(answers, ['full name', 'name', 'your name', 'applicant name']);
      if (fullName) return fullName;
      
      // Try the first or last name alone if we only have one
      if (firstName) return firstName;
      if (lastName) return lastName;
      
      // Last resort: look for ANY field that might contain a name
      const possibleNameField = answers.find(a => {
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
      
      return 'Incomplete Application';
      
    case 'email':
      // First check user data
      if (user?.email && user.email.trim() !== '') {
        return user.email.trim();
      }
      
      keywords = ['email', 'e-mail', 'email address', 'contact email', 'e mail'];
      const email = getAnswerByKeywords(answers, keywords);
      
      if (email && email.includes('@')) {
        return email;
      }
      
      // Look for any field that looks like an email
      const emailField = answers.find(a => {
        const answer = String(a?.answer || '').trim();
        return answer.includes('@') && answer.includes('.');
      });
      
      return emailField ? String(emailField.answer).trim() : 'No Email Provided';
      
    default:
      return '';
  }
};

// Helper function to safely get values
const getAnswerByKeywords = (answers: any[], keywords: string[]): string => {
  if (!Array.isArray(answers)) return '';
  
  for (const answer of answers) {
    if (answer?.questionText && typeof answer.questionText === 'string') {
      const questionLower = answer.questionText.toLowerCase();
      for (const keyword of keywords) {
        if (questionLower.includes(keyword.toLowerCase())) {
          return String(answer.answer || '').trim();
        }
      }
    }
  }
  return '';
};

export function ApplicationsTable({ 
  applications, 
  jobTitles, 
  onView, 
  onEdit, 
  onDelete,
  onBulkStatusChange,
  onBulkDelete,
  currentPage,
  totalPages,
  onPageChange 
}: ApplicationsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(applications.map(app => app.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const columns: Column<Application>[] = [
    { 
      header: "Applicant", 
      accessor: (row: Application) => {
        // First try the processed name field (from database)
        if (row.name && row.name.trim() !== '' && 
            !['N/A', 'No Application Data', 'Incomplete Application'].includes(row.name)) {
          return row.name;
        }
        
        // Fallback: Extract from answers using enhanced logic
        const extractedName = extractDataFromAnswers(row.answers || [], 'name', row.user);
        return extractedName;
      }
    },
    { 
      header: "Email", 
      accessor: (row: Application) => {
        // First try the processed email field (from database)
        if (row.email && row.email.trim() !== '' && 
            !['N/A', 'No Contact Info', 'No Email Provided'].includes(row.email)) {
          return row.email;
        }
        
        // Fallback: Extract from answers using enhanced logic
        const extractedEmail = extractDataFromAnswers(row.answers || [], 'email', row.user);
        return extractedEmail;
      }
    },
    { 
      header: "Position", 
      accessor: (row: Application) => {
        // Always use jobId references, never store position directly
        const jobId = row.jobId || (row as any).jobId;
        if (jobId && jobTitles[jobId]) {
          return jobTitles[jobId];
        }
        
        return 'Position Not Available';
      },
      cell: (value: string) => value
    },
    { 
      header: "Status", 
      accessor: (row: Application) => row.status || 'New'
    },
    { 
      header: "Applied Date", 
      accessor: (row: Application) => new Date(row.appliedDate),
      cell: (date: Date) => date.toLocaleDateString()
    },
    { 
      header: "CV", 
      accessor: (row: Application) => {
        // First check if cvUrl field exists (older applications)
        if (row.cvUrl && row.cvUrl.trim()) {
          return row.cvUrl.trim();
        }
        
        // Fall back to extracting CV from answers array (newer applications)
        if (Array.isArray(row.answers)) {
          for (const answer of row.answers) {
            const questionText = answer.questionText?.toLowerCase() || '';
            if (questionText.includes('cv') || 
                questionText.includes('resume') || 
                questionText.includes('upload')) {
              const cvUrl = answer.answer?.toString().trim();
              if (cvUrl && cvUrl.length > 10) { // Basic validation for URL
                return cvUrl;
              }
            }
          }
        }
        
        return '';
      },
      cell: (value: string) => value ? (
        <Link href={value} target="_blank" className="text-blue-600 hover:underline">
          View CV
        </Link>
      ) : 'N/A'
    },
    // {
    //   header: "Answers",
    //   accessor: (row: Application) => row.answers?.map(a => 
    //     `${a.questionText}: ${a.answer}`
    //   ).join('\n') || 'N/A',
    //   cell: (value: string) => (
    //     <pre className="whitespace-pre-wrap text-sm">{value}</pre>
    //   )
    // }
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} application(s) selected
          </span>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Change Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Applied')}>
                  Set to Applied
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'In Review')}>
                  Set to In Review
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Interview')}>
                  Set to Interview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Hired')}>
                  Set to Hired
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Rejected')}>
                  Set to Rejected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                if (confirm('Are you sure you want to delete the selected applications?')) {
                  onBulkDelete(selectedIds);
                  setSelectedIds([]);
                }
              }}
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <Checkbox 
                  checked={selectedIds.length === applications.length}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                />
              </th>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {column.header}
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {applications.map((application) => (
              <tr key={application.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Checkbox 
                    checked={selectedIds.includes(application.id)}
                    onCheckedChange={(checked) => handleSelectOne(application.id, checked as boolean)}
                  />
                </td>
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-6 py-4 whitespace-nowrap text-sm text-foreground"
                  >
                    {(() => {
                      const value = column.accessor(application);
                      return column.cell 
                        ? column.cell(value)
                        : value instanceof Date 
                          ? value.toLocaleDateString()
                          : value;
                    })()}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onView(application.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(application.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(application.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex justify-center mt-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="py-2 px-4 text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
} 