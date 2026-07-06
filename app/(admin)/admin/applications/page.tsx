"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, FileText, Sheet, Archive, Sparkles, Loader2, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { useAiStatus, AI_UNCONFIGURED_MESSAGE } from "@/contexts/AiStatusContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FailedStatusState } from "@/components/ui/failed-status-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function ApplicationsPage() {
  const [isArchivingAll, setIsArchivingAll] = useState(false);
  const { isUnconfigured: aiUnconfigured } = useAiStatus();

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
    selectedAiScore,
    setSelectedAiScore,
    aiScoreFilterOptions,
    sortBy,
    setSortBy,
    sortOrder,
    toggleSortOrder,
    sortFieldOptions,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    resetFilters,
    hasActiveFilters,
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
    handleSaveFromView,
    handleRankApplication,
    handleRankApplications,
    rankingApplicationId,
    isAiRanking,
    handleConfirmDelete,
    handleBulkStatusUpdate,
    handleBulkArchive,
    handleArchiveAll,
  } = useAdminApplicationPage({
    statusType: 'all',
    dateField: 'appliedDate',
    enableBulkUpdates: true,
    enablePositionFilter: true,
    enableStatusFilter: true,
    enableAiScoreFilter: true,
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
        <FailedStatusState message="Failed to load applications" />
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
          <span
            title={aiUnconfigured ? AI_UNCONFIGURED_MESSAGE : undefined}
            className="inline-flex"
          >
            <Button
              variant="outline"
              className="flex items-center gap-2 border-violet-200 text-violet-700 hover:bg-violet-50"
              disabled={isAiRanking || total === 0 || aiUnconfigured}
              onClick={() => handleRankApplications()}
            >
              {isAiRanking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ranking...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI Rank Page
                </>
              )}
            </Button>
          </span>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                disabled={isArchivingAll || total === 0}
              >
                <Archive className="h-4 w-4" />
                Archive All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive all applications?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will move all {total} active application(s) to the archive.
                  They will no longer appear in pipeline views but can be restored from the Archive page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isArchivingAll}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isArchivingAll}
                  onClick={async (event) => {
                    event.preventDefault();
                    setIsArchivingAll(true);
                    try {
                      await handleArchiveAll();
                    } finally {
                      setIsArchivingAll(false);
                    }
                  }}
                >
                  {isArchivingAll ? "Archiving..." : "Archive All"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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

        {/* AI Score Filter */}
        <div className="flex items-center gap-4">
          <Label htmlFor="ai-score-filter" className="text-sm font-medium">
            Filter by AI Score:
          </Label>
          <Select value={selectedAiScore} onValueChange={setSelectedAiScore}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All AI Scores" />
            </SelectTrigger>
            <SelectContent>
              {aiScoreFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Filters */}
        <div className="flex items-center gap-2 ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Advanced filters
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sort-by" className="text-sm font-medium">
                  Sort by
                </Label>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger id="sort-by" className="flex-1">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortFieldOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={toggleSortOrder}
                    aria-label={sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
                    title={sortOrder === "asc" ? "Ascending" : "Descending"}
                  >
                    {sortOrder === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="date-from" className="text-sm font-medium">
                    Applied from
                  </Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to" className="text-sm font-medium">
                    Applied to
                  </Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                className="w-full flex items-center gap-2"
                onClick={resetFilters}
              >
                <RotateCcw className="h-4 w-4" />
                Reset filters
              </Button>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-muted-foreground"
              onClick={resetFilters}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
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
        onBulkArchive={handleBulkArchive}
        onRank={handleRankApplication}
        onBulkRank={handleRankApplications}
        rankingApplicationId={rankingApplicationId}
        showAiScore
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
        onSave={handleSaveFromView}
        onRank={handleRankApplication}
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
