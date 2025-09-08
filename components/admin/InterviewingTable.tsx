"use client";

import { Application } from "@/types/application";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Users, CalendarCheck } from "lucide-react";
import { getNameDisplay, getEmailDisplay, getPositionDisplay, getCvUrl } from "@/lib/admin-table-utils";
import { CVCell } from "@/components/admin/CVCell";

interface Column<T> {
  header: string;
  accessor: (row: T) => string | number | Date;
  cell?: (value: ReturnType<Column<T>['accessor']>, row: T) => React.ReactNode;
}

interface InterviewingTableProps {
  applications: Application[];
  jobTitles: Record<string, string>;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function InterviewingTable({ applications, jobTitles, onView, onEdit, onDelete }: InterviewingTableProps) {
  const columns: Column<Application>[] = [
    { 
      header: "Applicant", 
      accessor: (row: Application) => getNameDisplay(row)
    },
    { 
      header: "Email", 
      accessor: (row: Application) => getEmailDisplay(row)
    },
    { 
      header: "Position", 
      accessor: (row: Application) => getPositionDisplay(row, jobTitles)
    },
    { 
      header: "Interview Date", 
      accessor: (row: Application) => {
        if (row.interviewDate) {
          try {
            const date = new Date(row.interviewDate);
            if (isNaN(date.getTime())) {
              return 'Invalid Date';
            }
            return date;
          } catch (error) {
            return 'Invalid Date';
          }
        }
        return 'Not Scheduled';
      },
      cell: (value: Date | string) => value instanceof Date ? value.toLocaleDateString() : value
    },
    { 
      header: "Interviewer", 
      accessor: (row: Application) => row.interviewer || 'N/A'
    },
    { 
      header: "CV", 
      accessor: (row: Application) => getCvUrl(row),
      cell: (value: string, row: Application) => (
        <CVCell cvUrl={value} candidateName={getNameDisplay(row)} />
      )
    }
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <CalendarCheck className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">No Interviews Scheduled</h3>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Candidates who are moved to the interviewing stage will appear here with their 
            scheduled interview details. Use the assessment stage to evaluate candidates 
            before scheduling interviews.
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
                        ? column.cell(value, application)
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