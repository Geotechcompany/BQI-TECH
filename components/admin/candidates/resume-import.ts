import { adminApplicationsApi } from "@/components/admin/utils/applications-api";

export const RESUME_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

export type ExtractedContactFields = {
  name?: string;
  email?: string;
  phoneNumber?: string;
  location?: string;
};

export type ResumeImportResult = {
  cvUrl: string;
  fileName: string;
  extracted: ExtractedContactFields;
  warning?: string | null;
};

export function isAllowedResumeFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  );
}

/** Upload a resume, extract contact fields, and return values for form review. */
export async function importResumeAndExtract(
  file: File
): Promise<ResumeImportResult> {
  if (!isAllowedResumeFile(file)) {
    throw new Error("Choose a PDF or Word resume (.pdf, .doc, .docx)");
  }
  if (file.size > RESUME_MAX_BYTES) {
    throw new Error("Resume must be 10 MB or smaller");
  }

  const uploaded = await adminApplicationsApi.uploadResumeFile(file);
  const preview = await adminApplicationsApi.extractContactPreview({
    cvUrl: uploaded.url,
  });

  return {
    cvUrl: uploaded.url,
    fileName: uploaded.fileName,
    extracted: preview.extracted || {},
    warning: preview.warning,
  };
}

export type CsvCandidateRow = {
  name: string;
  email: string;
  phoneNumber?: string;
  location?: string;
  cvUrl?: string;
  status?: string;
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/** Parse a simple name/email CSV (header row required). */
export function parseCandidateCsv(text: string): CsvCandidateRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one candidate");
  }

  const headers = splitCsvLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/\s+/g, "")
  );
  const nameIdx = headers.findIndex((header) =>
    ["name", "fullname", "candidate", "candidatename"].includes(header)
  );
  const emailIdx = headers.findIndex((header) =>
    ["email", "emailaddress", "e-mail"].includes(header)
  );
  if (nameIdx < 0 || emailIdx < 0) {
    throw new Error('CSV must include "name" and "email" columns');
  }

  const phoneIdx = headers.findIndex((header) =>
    ["phone", "phonenumber", "mobile", "tel"].includes(header)
  );
  const locationIdx = headers.findIndex((header) =>
    ["location", "city", "address"].includes(header)
  );
  const cvIdx = headers.findIndex((header) =>
    ["cvurl", "resumeurl", "cv", "resume"].includes(header)
  );
  const statusIdx = headers.findIndex((header) =>
    ["status", "stage", "pipelinestage"].includes(header)
  );

  const rows: CsvCandidateRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const name = (cells[nameIdx] || "").trim();
    const email = (cells[emailIdx] || "").trim();
    if (!name && !email) continue;
    if (!name || !email || !email.includes("@")) {
      throw new Error(`Invalid CSV row: "${line}". Name and email are required.`);
    }
    rows.push({
      name,
      email,
      phoneNumber:
        phoneIdx >= 0 ? (cells[phoneIdx] || "").trim() || undefined : undefined,
      location:
        locationIdx >= 0
          ? (cells[locationIdx] || "").trim() || undefined
          : undefined,
      cvUrl: cvIdx >= 0 ? (cells[cvIdx] || "").trim() || undefined : undefined,
      status:
        statusIdx >= 0 ? (cells[statusIdx] || "").trim() || undefined : undefined,
    });
  }

  if (rows.length === 0) {
    throw new Error("No candidate rows found in CSV");
  }
  return rows;
}
