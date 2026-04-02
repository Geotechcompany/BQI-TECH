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
import { FailedStatusState } from "@/components/ui/failed-status-state";

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
    enableBulkUpdates: true,
    enablePositionFilter: true,
  });

  if (isLoading) {
    return (
      <AdminPageLayout title="All Applications" showSearch={false}>
        <TableSkeleton rows={10} columns={6} />
      </AdminPageLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Router will handle the redirect
  }

  if (error) {
    return (
      <AdminPageLayout title="All Applications" showSearch={false}>
        <FailedStatusState message="Failed to load applications" />
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="All Applications"
      searchPlaceholder="Search all applications..."
      searchValue={searchTerm}
      onSearch={setSearchTerm}
    >
      {/* Position Filter */}
      {positionFilterOptions.length > 0 && (
        <div className="mb-6 flex items-center gap-4">
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

      {/* Results Summary */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {applications.length} of {total} applications
      </div>

      {/* Applications Table */}
      <UnifiedApplicationTable
        applications={applications}
        jobTitles={jobTitles}
        statusType="all"
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
