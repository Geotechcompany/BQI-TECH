"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee, EmployeeDocumentCategory } from "@/types/employee";
import { EMPLOYEE_DOCUMENT_CATEGORY_LABELS } from "@/types/employee";
import { EmployeeMetricCard } from "../EmployeeMetricCard";
import {
  UploadEmployeeDocumentDialog,
  type UploadEmployeeDocumentPayload,
} from "../UploadEmployeeDocumentDialog";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api-backend";
import { Download, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

const CATEGORY_ORDER: EmployeeDocumentCategory[] = [
  "contract",
  "national_id",
  "good_conduct",
  "cv",
  "tax_id",
  "certificate",
  "other",
];

function formatUploadedAt(value: string): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function openDocumentUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function DocumentsTab({ employee }: { employee: Employee }) {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: docusignStatus } = useQuery({
    queryKey: ["admin-docusign-status"],
    queryFn: async () => {
      const response = await adminApi.getDocuSignIntegrationStatus();
      return (response as { status?: { connected?: boolean; configured?: boolean } })
        ?.status;
    },
    staleTime: 60_000,
  });
  const docusignConnected = Boolean(
    docusignStatus?.connected || docusignStatus?.configured
  );

  const counts = employee.documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});

  const uploadMutation = useMutation({
    mutationFn: async (payload: UploadEmployeeDocumentPayload) => {
      const uploaded = (await adminApi.uploadAdminFile(payload.file)) as {
        url?: string;
        fileName?: string;
        fileSize?: number;
      };
      if (!uploaded?.url) {
        throw new Error("Upload failed — no file URL returned.");
      }
      return adminApi.uploadEmployeeDocument(employee.id, {
        name: payload.name,
        category: payload.category,
        fileUrl: uploaded.url,
        fileName: uploaded.fileName || payload.file.name,
        fileSize: uploaded.fileSize ?? payload.file.size,
      });
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      setUploadOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["admin-employee", employee.id],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    },
  });

  const sendOfferMutation = useMutation({
    mutationFn: () => adminApi.sendEmployeeOfferViaDocuSign(employee.id),
    onSuccess: () => {
      toast.success("Offer letter sent via DocuSign");
      void queryClient.invalidateQueries({
        queryKey: ["admin-employee", employee.id],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "DocuSign send failed"
      );
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Contracts, IDs, and certificates on this employee.
        </p>
        <div className="flex flex-wrap gap-2">
          {docusignConnected ? (
            <Button
              size="sm"
              variant="outline"
              className="border-[#272156]/25 text-[#272156]"
              onClick={() => sendOfferMutation.mutate()}
              disabled={sendOfferMutation.isPending}
            >
              {sendOfferMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Send via DocuSign
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/settings?section=integrations">
                Connect DocuSign
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            className="bg-[#272156] hover:bg-[#272156]/90 text-white"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_ORDER.map((cat) => (
          <EmployeeMetricCard
            key={cat}
            label={EMPLOYEE_DOCUMENT_CATEGORY_LABELS[cat]}
            value={counts[cat] ?? 0}
            icon={FileText}
            accent={cat === "contract" ? "navy" : "neutral"}
          />
        ))}
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">Documents</h3>
        {employee.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents yet. Upload a contract, ID, or certificate to get
            started.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {employee.documents.map((doc) => {
              const categoryLabel =
                EMPLOYEE_DOCUMENT_CATEGORY_LABELS[
                  doc.category as EmployeeDocumentCategory
                ] ?? "Other";
              return (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-[#272156]/10 p-2 dark:bg-[#31CDFF]/15">
                      <FileText className="h-4 w-4 text-[#272156] dark:text-[#31CDFF]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {categoryLabel} · {doc.sizeKb} KB · uploaded{" "}
                        {formatUploadedAt(doc.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  {doc.url ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDocumentUrl(doc.url!)}
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a href={doc.url} download={doc.fileName || doc.name}>
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      No file link
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <UploadEmployeeDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        isSubmitting={uploadMutation.isPending}
        onSubmit={async (payload) => {
          await uploadMutation.mutateAsync(payload);
        }}
      />
    </div>
  );
}
