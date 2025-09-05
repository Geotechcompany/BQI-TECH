"use client";

import { Application } from "@/types/application";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, ClipboardList } from "lucide-react";
import Link from "next/link";

interface Column<T> {
  header: string;
  accessor: (row: T) => string | number | Date;
  cell?: (value: ReturnType<Column<T>['accessor']>) => React.ReactNode;
}

interface ShortlistedTableProps {
  applications: Application[];
  jobTitles: Record<string, string>;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const isUUID = (str: string) => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

// Enhanced helper function for robust data extraction (same as ApplicationsTable)
const extractDataFromAnswers = (answers: any[], type: 'name' | 'email' | 'position', user?: any): string => {
  if (!Array.isArray(answers)) {
    // If no answers array, check if we have user data
    if (type === 'name' && user?.name) return user.name;
    if (type === 'email' && user?.email) return user.email;
    return type === 'name' ? 'No Application Data' : type === 'email' ? 'No Contact Info' : '';
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
      
    case 'position':
      keywords = ['position', 'job title', 'role', 'position applied for', 'desired position', 'job role', 'applying for'];
      const position = getAnswerByKeywords(answers, keywords);
      if (position && position.trim() !== '') {
        // Exclude motivation/description answers that are too long or contain certain phrases
        const positionAnswer = position.trim();
        
        // Skip if it looks like a motivation/description (too long, contains personal pronouns, etc.)
        if (positionAnswer.length > 50 || 
            positionAnswer.toLowerCase().includes('desire') ||
            positionAnswer.toLowerCase().includes('motivation') ||
            positionAnswer.toLowerCase().includes('learn') ||
            positionAnswer.toLowerCase().includes('my ') ||
            positionAnswer.toLowerCase().includes('i am') ||
            positionAnswer.toLowerCase().includes('because')) {
          // This looks like a motivation answer, not a position
          return '';
        }
        
        return positionAnswer;
      }
      
      // Look specifically for job title questions (avoid motivation questions)
      const jobTitleAnswer = answers.find(a => {
        if (!a?.questionText || !a?.answer) return false;
        const question = a.questionText.toLowerCase();
        const answer = String(a.answer).trim();
        
        // Look for specific position/job title questions but exclude motivation questions
        return (question.includes('job title') || 
                question.includes('position applied') ||
                question.includes('desired position') ||
                (question.includes('position') && !question.includes('motivation') && !question.includes('applying'))) && 
               answer.length > 2 && answer.length < 100 &&
               !answer.toLowerCase().includes('desire') &&
               !answer.toLowerCase().includes('motivation');
      });
      
      if (jobTitleAnswer) {
        return String(jobTitleAnswer.answer).trim();
      }
      
      return '';
      
    default:
      keywords = [];
      break;
  }
  
  return getAnswerByKeywords(answers, keywords);
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

export function ShortlistedTable({ applications, jobTitles, onView, onEdit, onDelete }: ShortlistedTableProps) {
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
        // First try the processed position field (from database) - clean it
        if (row.position && row.position.trim() !== '' && row.position.trim() !== 'N/A' && !isUUID(row.position)) {
          return row.position.trim(); // Remove trailing spaces
        }
        
        // If position is a UUID, look up job title
        if (row.position && isUUID(row.position)) {
          const jobTitle = jobTitles[row.position];
          if (jobTitle && jobTitle.trim() !== '') {
            return jobTitle.trim();
          }
          // If UUID but no job title found, fall through to other methods
        }
        
        // Fallback to job details
        if (row.jobDetails?.title && row.jobDetails.title.trim() !== '') {
          return row.jobDetails.title.trim();
        }
        
        // Extract from answers using enhanced logic
        const extractedPosition = extractDataFromAnswers(row.answers || [], 'position');
        if (extractedPosition && extractedPosition.trim() !== '' && extractedPosition !== 'N/A') {
          return extractedPosition.trim();
        }
        
        // If we have a jobId but no position, show a descriptive message
        if (row.jobId || (row as any).jobId) {
          return 'Position Not Available';
        }
        
        return 'N/A';
      },
      cell: (value: string) => value
    },
    { 
      header: "Shortlisted Date", 
      accessor: (row: Application) => new Date(row.shortlistedDate),
      cell: (date: Date) => date.toLocaleDateString()
    },
    { 
      header: "CV", 
      accessor: (row: Application) => row.cvUrl || '',
      cell: (value: string) => value ? (
        <Link href={value} target="_blank" className="text-blue-600 hover:underline">
          View CV
        </Link>
      ) : 'N/A'
    }
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <ClipboardList className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">No Shortlisted Candidates</h3>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Candidates who are marked as shortlisted will appear here. Review applications
            in the main applications list to identify potential candidates for shortlisting.
          </p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
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
      )}
    </div>
  );
} 