"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  FileText,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";
import { AdminPageWelcomeBanner } from "@/components/admin/AdminPageWelcomeBanner";
import { TourPageHelper } from "@/components/admin/tour/TourPageHelper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/api-backend";
import {
  DOCUMENT_CATEGORIES,
  type CompanyDocument,
  type DocumentCategoryFilter,
  type DocumentFormat,
} from "@/types/company-document";
import { DocumentsEmptyState } from "@/components/admin/documents/DocumentsEmptyState";
import {
  UploadDocumentDialog,
  type UploadDocumentPayload,
} from "@/components/admin/documents/UploadDocumentDialog";
import {
  detectFormatFromFilename,
  formatFileSize,
  formatModifiedDate,
  pushRecentDocumentId,
  readRecentDocumentIds,
  resolveRecentDocuments,
} from "@/components/admin/documents/document-utils";

function FormatIcon({ format }: { format: DocumentFormat }) {
  if (format === "XLS") {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" strokeWidth={1.75} />;
  }
  if (format === "DOC") {
    return <FileText className="h-5 w-5 text-blue-600" strokeWidth={1.75} />;
  }
  return <FileText className="h-5 w-5 text-red-600" strokeWidth={1.75} />;
}

function formatBadgeClass(format: DocumentFormat): string {
  if (format === "XLS") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (format === "DOC") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
}

async function fetchDocuments(): Promise<CompanyDocument[]> {
  const response = (await adminApi.listCompanyDocuments({ limit: 200 })) as {
    documents?: CompanyDocument[];
  };
  return response?.documents || [];
}

export function AdminDocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DocumentCategoryFilter>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setRecentIds(readRecentDocumentIds());
  }, []);

  const { data: documents = [], isLoading, isError } = useQuery({
    queryKey: ["admin-company-documents"],
    queryFn: fetchDocuments,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });

  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (category !== "all" && doc.category !== category) return false;
      if (!needle) return true;
      const haystack = [
        doc.title,
        doc.description,
        doc.fileName,
        doc.authorName,
        doc.format,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [documents, category, search]);

  const recentDocuments = useMemo(
    () => resolveRecentDocuments(documents, recentIds),
    [documents, recentIds]
  );

  const activeCategoryLabel =
    DOCUMENT_CATEGORIES.find((item) => item.id === category)?.label || "All";

  const uploadMutation = useMutation({
    mutationFn: async (payload: UploadDocumentPayload) => {
      const format = detectFormatFromFilename(payload.file.name);
      if (!format) {
        throw new Error("Use a PDF, Word, or Excel file.");
      }
      const uploaded = (await adminApi.uploadAdminFile(payload.file)) as {
        url?: string;
        fileName?: string;
        fileSize?: number;
      };
      if (!uploaded?.url) {
        throw new Error("Upload failed — no file URL returned.");
      }
      await adminApi.createCompanyDocument({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        format,
        fileUrl: uploaded.url,
        fileName: uploaded.fileName || payload.file.name,
        fileSize: uploaded.fileSize ?? payload.file.size,
      });
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      setUploadOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-company-documents"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await adminApi.deleteCompanyDocument(documentId);
    },
    onSuccess: () => {
      toast.success("Document deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin-company-documents"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete document"
      );
    },
  });

  const openDocument = async (doc: CompanyDocument) => {
    pushRecentDocumentId(doc.id);
    setRecentIds(readRecentDocumentIds());
    try {
      await adminApi.markCompanyDocumentAccessed(doc.id);
      void queryClient.invalidateQueries({ queryKey: ["admin-company-documents"] });
    } catch {
      // local recent list still updates
    }
    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <AdminPageLayout title="Documents" showSearch={false} tourId="documents" guideInBanner>
      <TourPageHelper tourId="documents" />
      <div className="space-y-8">
        <AdminPageWelcomeBanner tourId="documents"
          bannerKey="documents"
          actions={
            <Button
              type="button"
              className="shrink-0 bg-white text-[#272156] hover:bg-white/90"
              onClick={() => setUploadOpen(true)}
              data-tour="documents-upload"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Upload Document
            </Button>
          }
        />

        <div className="relative" data-tour="documents-search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search documents"
          />
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>

        {recentDocuments.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-medium text-foreground">
              Recently Accessed
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recentDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => void openDocument(doc)}
                  className="flex min-w-[180px] max-w-[220px] shrink-0 items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left transition-colors hover:border-[#272156]/30 hover:bg-[#272156]/[0.03]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                    <FormatIcon format={doc.format} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {doc.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSize)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div
          className="flex gap-1 overflow-x-auto border-b border-border/70"
          role="tablist"
          aria-label="Document categories"
          data-tour="documents-categories"
        >
          {DOCUMENT_CATEGORIES.map((item) => {
            const selected = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setCategory(item.id)}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
                  selected
                    ? "border-[#272156] font-medium text-[#272156]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Could not load documents. Confirm the backend is running the latest
              code.
            </p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <DocumentsEmptyState
            categoryLabel={activeCategoryLabel}
            hasSearch={Boolean(search.trim())}
            onUpload={() => setUploadOpen(true)}
          />
        ) : (
          <ul
            className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card"
            data-tour="documents-list"
          >
            {filteredDocuments.map((doc) => (
              <li key={doc.id} className="group">
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <button
                    type="button"
                    onClick={() => void openDocument(doc)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                      <FormatIcon format={doc.format} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground group-hover:text-[#272156]">
                          {doc.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
                            formatBadgeClass(doc.format)
                          )}
                        >
                          {doc.format}
                        </Badge>
                      </div>
                      {doc.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {doc.description}
                        </p>
                      ) : null}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center justify-between gap-4 pl-12 sm:pl-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-end">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>{doc.authorName || "Unknown"}</span>
                      <span>{formatModifiedDate(doc.updatedAt || doc.createdAt)}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${doc.title}`}
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete “${doc.title}”? This removes it from the library.`
                          )
                        ) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        isSubmitting={uploadMutation.isPending}
        onSubmit={async (payload) => {
          await uploadMutation.mutateAsync(payload);
        }}
      />
    </AdminPageLayout>
  );
}
