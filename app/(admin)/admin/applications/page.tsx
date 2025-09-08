"use client";

import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { UnifiedApplicationTable } from "@/components/admin/UnifiedApplicationTable";
import { EditApplicationModal } from "@/components/admin/EditApplicationModal";
import { ViewApplicationModal } from "@/components/admin/ViewApplicationModal";
import { DeleteApplicationModal } from "@/components/admin/DeleteApplicationModal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/Pagination";
import { useAdminApplicationPage } from "@/hooks/useAdminApplicationPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, FileText, Sheet, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function ApplicationsPage() {
  const {
    applications,
    jobTitles,
    isLoading,
    error,
    total,
    currentPage,
    totalPages,
    isAuthenticated,
    isAdmin,
    searchTerm,
    setSearchTerm,
    selectedPosition,
    setSelectedPosition,
    positionFilterOptions,
    selectedStatus,
    setSelectedStatus,
    statusFilterOptions,
    handlePageChange,
    viewApplication,
    setViewApplication,
    editApplication,
    setEditApplication,
    deleteApplicationId,
    setDeleteApplicationId,
    handleView,
    handleEdit,
    handleDelete,
    handleSaveEdit,
    handleConfirmDelete,
    handleBulkStatusUpdate,
  } = useAdminApplicationPage({
    statusType: 'all',
    dateField: 'appliedDate',
    enableBulkUpdates: true,
    enablePositionFilter: true,
    enableStatusFilter: true,
  });

  if (isLoading) {
    return (
      <AdminPageLayout title="Applications" showSearch={false}>
        <TableSkeleton rows={10} columns={6} />
      </AdminPageLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Router will handle the redirect
  }

  if (error) {
    return (
      <AdminPageLayout title="Applications" showSearch={false}>
        <div className="text-center text-red-600">Failed to load applications</div>
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
      {/* Filters */}
      <div className="mb-6 flex items-center gap-6 flex-wrap">
        {/* Status Filter */}
        <div className="flex items-center gap-4">
          <Label htmlFor="status-filter" className="text-sm font-medium">
            Filter by Status:
          </Label>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Position Filter */}
        {positionFilterOptions.length > 0 && (
          <div className="flex items-center gap-4">
            <Label htmlFor="position-filter" className="text-sm font-medium">
              Filter by Position:
            </Label>
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Positions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                {positionFilterOptions.map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {applications.length} of {total} applications
      </div>

      {/* Applications Table */}
      <UnifiedApplicationTable
        applications={applications}
        jobTitles={jobTitles}
        statusType="all"
        dateField="appliedDate"
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkStatusUpdate={handleBulkStatusUpdate}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          className="mt-6"
        />
      )}

      {/* Modals */}
      <ViewApplicationModal
        application={viewApplication}
        isOpen={!!viewApplication}
        onClose={() => setViewApplication(null)}
        jobTitles={jobTitles}
      />
      
      <EditApplicationModal
        application={editApplication}
        isOpen={!!editApplication}
        onClose={() => setEditApplication(null)}
        onSave={handleSaveEdit}
        jobTitles={jobTitles}
      />
      
      <DeleteApplicationModal
        applicationId={deleteApplicationId}
        isOpen={!!deleteApplicationId}
        onClose={() => setDeleteApplicationId(null)}
        onConfirm={handleConfirmDelete}
      />
    </AdminPageLayout>
  );
}
