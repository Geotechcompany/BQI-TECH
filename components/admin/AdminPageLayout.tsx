"use client";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { TourHelpButton } from "@/components/admin/tour/TourHelpButton";

interface AdminPageLayoutProps {
  title: string;
  searchPlaceholder?: string;
  children: React.ReactNode;
  filters?: React.ReactNode;
  onSearch?: (value: string) => void;
  searchValue?: string;
  showSearch?: boolean;
  className?: string;
  headerActions?: React.ReactNode;
  breadcrumb?: string;
  /** Shows a Guide button and enables page tour restart */
  tourId?: string;
  /**
   * When true, Guide lives on the welcome banner instead of the header strip.
   * Pass the same tourId to OverviewWelcomeBanner / AdminPageWelcomeBanner.
   */
  guideInBanner?: boolean;
  /** Optional `data-tour` value on the search input for Guide spotlights */
  searchDataTour?: string;
  /** Stretch content to fill viewport below header (for full-height boards) */
  fillViewport?: boolean;
  /** Extra classes for the content wrapper (e.g. full-bleed two-pane layouts) */
  contentClassName?: string;
}

export function AdminPageLayout({
  title,
  searchPlaceholder,
  children,
  filters,
  onSearch,
  searchValue,
  showSearch = true,
  className,
  headerActions,
  tourId,
  guideInBanner = false,
  searchDataTour,
  fillViewport = false,
  contentClassName,
}: AdminPageLayoutProps) {
  const { sidebarCollapsed } = useSettings();
  const showHeaderGuide = Boolean(tourId) && !guideInBanner;

  return (
    <div 
      className={cn(
        "w-full flex flex-col bg-background text-foreground transition-all duration-300 ease-in-out",
        fillViewport ? "h-screen overflow-hidden" : "min-h-screen",
        className
      )}
      data-collapsed={sidebarCollapsed}
    >
      {/* Header Section — sticky inside main (dual-rail spacer handles left offset) */}
      <div className="flex-shrink-0">
        <AdminPageHeader title={title} />
      </div>
      
      {/* Main Content Container */}
      <div className={cn("flex-1", fillViewport && "flex min-h-0 flex-col overflow-hidden")}>
        {/* Search Filters Section */}
        {showSearch && (
          <div className="bg-card/80 backdrop-blur-sm border-b py-4">
            <div className="max-w-screen-2xl mx-auto px-4">
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={searchValue}
                    onChange={(e) => onSearch?.(e.target.value)}
                    data-tour={searchDataTour}
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                </div>
                {(headerActions || showHeaderGuide) ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {showHeaderGuide ? <TourHelpButton tourId={tourId!} /> : null}
                    {headerActions}
                  </div>
                ) : null}
                {filters}
              </div>
            </div>
          </div>
        )}

        {!showSearch && (headerActions || showHeaderGuide) ? (
          <div className="border-b bg-card/80 py-3">
            <div className="mx-auto flex max-w-screen-2xl justify-end gap-2 px-4">
              {showHeaderGuide ? <TourHelpButton tourId={tourId!} /> : null}
              {headerActions}
            </div>
          </div>
        ) : null}

        {/* Content Area */}
        <div
          className={cn(
            "w-full max-w-screen-2xl mx-auto px-4 py-6",
            fillViewport && "flex flex-1 min-h-0 flex-col overflow-hidden py-4",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
} 