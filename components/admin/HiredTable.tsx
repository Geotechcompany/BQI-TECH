"use client";

import { Application } from "@/types/application";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Briefcase } from "lucide-react";
import { getNameDisplay, getEmailDisplay, getPositionDisplay, getCvUrl } from "@/lib/admin-table-utils";
import { CVCell } from "@/components/admin/CVCell";

interface Column<T> {
  header: string;
  accessor: (row: T) => string | number | Date;
  cell?: (value: ReturnType<Column<T>['accessor']>, row: T) => React.ReactNode;
}

interface HiredTableProps {
  applications: Application[];
  jobTitles: Record<string, string>;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function HiredTable({ applications, jobTitles, onView, onEdit, onDelete }: HiredTableProps) {
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
      header: "Hired Date", 
      accessor: (row: Application) => {
        if (row.hireDate) {
          try {
            const date = new Date(row.hireDate);
            if (isNaN(date.getTime())) {
              return 'Invalid Date';
            }
            return date;
          } catch (error) {
            return 'Invalid Date';
          }
        }
        return 'Not Set';
      },
      cell: (value: Date | string) => value instanceof Date ? value.toLocaleDateString() : value
    },
    { 
      header: "Start Date", 
      accessor: (row: Application) => {
        if (row.startDate) {
          try {
            const date = new Date(row.startDate);
            if (isNaN(date.getTime())) {
              return 'Invalid Date';
            }
            return date;
          } catch (error) {
            return 'Invalid Date';
          }
        }
        return 'TBD';
      },
      cell: (value: Date | string) => value instanceof Date ? value.toLocaleDateString() : value
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
            <Briefcase className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">No Hired Candidates</h3>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Candidates who have been officially hired will appear here. 
            Use the interviewing stage to finalize candidates before moving them to hired status.
          </p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-border">
          {/* Table structure similar to ShortlistedTable */}
        </table>
      )}
    </div>
  );
} 