"use client";

import { useState } from "react";
import { Application } from "@/types/application";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNameDisplay, getEmailDisplay, getPositionDisplay, getCvUrl } from "@/lib/admin-table-utils";
import { CVCell } from "@/components/admin/CVCell";

interface Column<T> {
  header: string;
  accessor: (row: T) => string | number | Date;
  cell?: (value: ReturnType<Column<T>['accessor']>, row: T) => React.ReactNode;
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
      accessor: (row: Application) => getCvUrl(row),
      cell: (value: string, row: Application) => (
        <CVCell cvUrl={value} candidateName={getNameDisplay(row)} />
      )
    }
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
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'New')}>
                  Set to New
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Shortlisted')}>
                  Set to Shortlisted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Technical Assessment')}>
                  Set to Technical Assessment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Interviewing')}>
                  Set to Interviewing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Hired')}>
                  Set to Hired
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Rejected')}>
                  Set to Rejected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkStatusChange(selectedIds, 'Disqualified')}>
                  Set to Disqualified
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