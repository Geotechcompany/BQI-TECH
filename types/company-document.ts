export type DocumentCategory = "policies" | "handbooks" | "templates" | "forms";

export type DocumentFormat = "PDF" | "DOC" | "XLS";

export type DocumentCategoryFilter = "all" | DocumentCategory;

export interface CompanyDocument {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  format: DocumentFormat;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  authorId?: string | null;
  authorName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastAccessedAt?: string | null;
}

export const DOCUMENT_CATEGORIES: {
  id: DocumentCategoryFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "policies", label: "Policies" },
  { id: "handbooks", label: "Handbooks" },
  { id: "templates", label: "Templates" },
  { id: "forms", label: "Forms" },
];

export const CATEGORY_OPTIONS: { id: DocumentCategory; label: string }[] = [
  { id: "policies", label: "Policies" },
  { id: "handbooks", label: "Handbooks" },
  { id: "templates", label: "Templates" },
  { id: "forms", label: "Forms" },
];
