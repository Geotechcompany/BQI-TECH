"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  RefreshCw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { employeePortalApi } from "@/lib/api-backend";
import {
  documentLabelForCategory,
  getMissingDocumentCategories,
} from "@/lib/employee-portal-completeness";
import {
  EMPLOYEE_DOCUMENT_CATEGORY_LABELS,
  type EmployeeDocument,
  type EmployeeDocumentCategory,
} from "@/types/employee";
import {
  EmployeeDocumentUploadDialog,
  type EmployeeSelfDocumentPayload,
} from "@/components/employee/EmployeeDocumentUploadDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, bounce: 0, duration: 0.4 };

type UploadTarget =
  | { mode: "add"; category?: EmployeeDocumentCategory; name?: string }
  | {
      mode: "replace";
      documentId: string;
      category: EmployeeDocumentCategory;
      name: string;
    };

function formatUploadedAt(value: string): string {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 10);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value.slice(0, 10);
  }
}

export default function EmployeeDocumentsPage() {
  const reduceMotion = useReducedMotion();
  const press = reduceMotion ? undefined : { scale: 0.97 };
  const queryClient = useQueryClient();
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["employee-portal-documents"],
    queryFn: () =>
      employeePortalApi.getDocuments() as Promise<{
        items: EmployeeDocument[];
        total: number;
      }>,
    staleTime: 60_000,
  });

  const docs = data?.items ?? [];
  const missingCategories = useMemo(
    () => getMissingDocumentCategories(docs),
    [docs]
  );

  const uploadMutation = useMutation({
    mutationFn: async ({
      target,
      payload,
    }: {
      target: UploadTarget;
      payload: EmployeeSelfDocumentPayload;
    }) => {
      setUploadPercent(0);
      const uploaded = await employeePortalApi.uploadFile(
        payload.file,
        (percent) => setUploadPercent(Math.min(99, percent))
      );
      if (!uploaded?.url) {
        throw new Error("Upload failed — no file URL returned.");
      }
      setUploadPercent(100);
      const body = {
        name: payload.name,
        category: payload.category,
        fileUrl: uploaded.url,
        fileName: uploaded.fileName || payload.file.name,
        fileSize: uploaded.fileSize ?? payload.file.size,
      };
      if (target.mode === "replace") {
        return employeePortalApi.replaceDocument(target.documentId, body);
      }
      return employeePortalApi.addDocument(body);
    },
    onSuccess: (result) => {
      const items = (result as { items?: EmployeeDocument[] }).items;
      if (items) {
        queryClient.setQueryData(["employee-portal-documents"], {
          items,
          total: items.length,
        });
      } else {
        void queryClient.invalidateQueries({
          queryKey: ["employee-portal-documents"],
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["employee-portal-me"] });
      toast.success(
        uploadTarget?.mode === "replace" ? "Document replaced" : "Document uploaded"
      );
      setUploadTarget(null);
      setUploadPercent(null);
    },
    onError: (error) => {
      setUploadPercent(null);
      toast.error(
        error instanceof Error ? error.message : "Could not upload document"
      );
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {missingCategories.length > 0 ? (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="rounded-2xl border border-[#31CDFF]/35 bg-[#31CDFF]/10 p-4 backdrop-blur-md sm:p-5"
          data-tour="employee-documents-missing"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-[#272156]"
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[#272156]">
                Missing documents
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Upload these so HR has a complete file.
              </p>
              <ul className="mt-3 space-y-2">
                {missingCategories.map((category) => (
                  <li
                    key={category}
                    className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {documentLabelForCategory(category)}
                    </span>
                    <motion.div whileTap={press}>
                      <Button
                        size="sm"
                        className="rounded-xl bg-[#272156] text-white hover:bg-[#272156]/90"
                        onClick={() =>
                          setUploadTarget({
                            mode: "add",
                            category,
                            name: documentLabelForCategory(category),
                          })
                        }
                      >
                        Upload
                      </Button>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          IDs, CVs, and certificates on your employee record.
        </p>
        <motion.div whileTap={press}>
          <Button
            size="sm"
            className="rounded-xl bg-[#272156] text-white hover:bg-[#272156]/90"
            onClick={() => setUploadTarget({ mode: "add" })}
            data-tour="employee-documents-upload"
          >
            <Upload className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
            Add document
          </Button>
        </motion.div>
      </div>

      <div data-tour="employee-documents-list">
        {docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No documents yet. Upload your National ID or CV to get started.
            </p>
            <motion.div className="mt-4 inline-block" whileTap={press}>
              <Button
                className="rounded-xl bg-[#272156] text-white hover:bg-[#272156]/90"
                onClick={() => setUploadTarget({ mode: "add" })}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Upload document
              </Button>
            </motion.div>
          </div>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {docs.map((doc) => {
              const categoryLabel =
                EMPLOYEE_DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category;
              return (
                <li
                  key={doc.id || `${doc.name}-${doc.uploadedAt}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-lg bg-[#272156]/10 p-2">
                      <FileText
                        className="h-4 w-4 text-[#272156]"
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {doc.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {categoryLabel}
                        {doc.uploadedAt
                          ? ` · ${formatUploadedAt(doc.uploadedAt)}`
                          : ""}
                        {doc.sizeKb ? ` · ${doc.sizeKb} KB` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#272156]",
                          "transition-colors hover:bg-[#272156]/06 active:scale-[0.97]"
                        )}
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="px-2.5 py-1.5 text-xs text-muted-foreground">
                        On file
                      </span>
                    )}
                    {doc.id ? (
                      <motion.div whileTap={press}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl"
                          onClick={() =>
                            setUploadTarget({
                              mode: "replace",
                              documentId: doc.id,
                              category: doc.category,
                              name: doc.name,
                            })
                          }
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Replace
                        </Button>
                      </motion.div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <EmployeeDocumentUploadDialog
        open={uploadTarget != null}
        onOpenChange={(open) => {
          if (!open && !uploadMutation.isPending) {
            setUploadTarget(null);
            setUploadPercent(null);
          }
        }}
        isSubmitting={uploadMutation.isPending}
        uploadPercent={uploadPercent}
        mode={uploadTarget?.mode === "replace" ? "replace" : "add"}
        initialCategory={
          uploadTarget?.mode === "replace"
            ? uploadTarget.category
            : uploadTarget?.category || "national_id"
        }
        initialName={
          uploadTarget?.mode === "replace"
            ? uploadTarget.name
            : uploadTarget?.name || ""
        }
        onSubmit={async (payload) => {
          if (!uploadTarget) return;
          await uploadMutation.mutateAsync({ target: uploadTarget, payload });
        }}
      />
    </div>
  );
}
