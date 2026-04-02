"use client";

import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { UnifiedApplicationTable } from "@/components/admin/UnifiedApplicationTable";
import { EditApplicationModal } from "@/components/admin/EditApplicationModal";
import { ViewApplicationModal } from "@/components/admin/ViewApplicationModal";
import { DeleteApplicationModal } from "@/components/admin/DeleteApplicationModal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useAdminApplicationPage } from "@/hooks/useAdminApplicationPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FailedStatusState } from "@/components/ui/failed-status-state";

export default function ShortlistedPage() {
  const {
    applications,
    jobTitles,
    isLoading,
    error,
    isAuthenticated,
    isAdmin,
    searchTerm,
    setSearchTerm,
    selectedPosition,
    setSelectedPosition,
    positionFilterOptions,
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
    statusType: 'shortlisted',
    dateField: 'shortlistedDate',
    enableBulkUpdates: true,
    enablePositionFilter: true,
  });

  if (isLoading) {
    return (
      <AdminPageLayout title="Shortlisted Applications" showSearch={false}>
        <TableSkeleton rows={10} columns={6} />
      </AdminPageLayout>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Router will handle the redirect
  }

  if (error) {
    return (
      <AdminPageLayout title="Shortlisted Applications" showSearch={false}>
        <FailedStatusState message="Failed to load shortlisted applications" />
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Shortlisted Applications"
      searchPlaceholder="Search shortlisted candidates..."
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

      {/* Applications Table */}
      <UnifiedApplicationTable
        applications={applications}
        jobTitles={jobTitles}
        statusType="shortlisted"
        dateField="shortlistedDate"
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkStatusUpdate={handleBulkStatusUpdate}
      />

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
