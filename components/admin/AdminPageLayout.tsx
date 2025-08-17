"use client";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

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
  headerActions
}: AdminPageLayoutProps) {
  const { sidebarCollapsed } = useSettings();

  return (
    <div 
      className={cn("min-h-screen w-full flex flex-col bg-background text-foreground transition-all duration-300 ease-in-out", className)}
      data-collapsed={sidebarCollapsed}
    >
      {/* Header Section */}
      <div className="flex-shrink-0">
        <div className="h-16">
          {/* This empty div accounts for the fixed header height */}
        </div>
        <AdminPageHeader title={title} showSearch={showSearch} onSearch={onSearch} />
      </div>
      
      {/* Main Content Container */}
      <div className="flex-1">
        {/* Search Filters Section */}
        {showSearch && (
          <div className="bg-card/80 backdrop-blur-sm border-b py-4">
            <div className="max-w-screen-2xl mx-auto px-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={searchValue}
                    onChange={(e) => onSearch?.(e.target.value)}
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                </div>
                {filters}
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="max-w-screen-2xl mx-auto px-4 py-6">
          {children}
        </div>
      </div>
    </div>
  );
} 