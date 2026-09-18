/** CSV helpers for employee import / export (no backend jargon in UI). */

export type EmployeeCsvRow = {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  departmentCode?: string;
  departmentName?: string;
  phone?: string;
  location?: string;
  status?: string;
  employmentType?: string;
  startDate?: string;
  workEmail?: string;
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

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]+/g, "");
}

function cell(cells: string[], idx: number): string {
  return idx >= 0 ? (cells[idx] || "").trim() : "";
}

/**
 * Parse employee CSV. Required columns: firstName, lastName, email, jobTitle.
 * Accepts firstname/firstname, department/departmentname/departmentcode, etc.
 */
export function parseEmployeeCsv(text: string): EmployeeCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one employee");
  }

  const headers = splitCsvLine(lines[0]).map(normHeader);

  const idx = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));

  const firstIdx = idx(["firstname", "first", "givenname"]);
  const lastIdx = idx(["lastname", "last", "surname", "familyname"]);
  const emailIdx = idx(["email", "emailaddress", "workemail"]);
  const titleIdx = idx(["jobtitle", "title", "position", "role"]);

  if (firstIdx < 0 || lastIdx < 0 || emailIdx < 0 || titleIdx < 0) {
    throw new Error(
      'CSV must include firstName, lastName, email, and jobTitle columns'
    );
  }

  const phoneIdx = idx(["phone", "phonenumber", "mobile", "tel"]);
  const locationIdx = idx(["location", "city", "office"]);
  const statusIdx = idx(["status"]);
  const typeIdx = idx(["employmenttype", "type"]);
  const startIdx = idx(["startdate", "start", "hiredate"]);
  const workEmailIdx = idx(["workemail"]);
  const deptCodeIdx = idx(["departmentcode", "deptcode", "code"]);
  const deptNameIdx = idx(["departmentname", "department", "dept"]);

  // Prefer a dedicated email column over workEmail when both map to emailIdx
  const primaryEmailIsWork =
    headers[emailIdx] === "workemail" &&
    !headers.includes("email") &&
    !headers.includes("emailaddress");

  const rows: EmployeeCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const firstName = cell(cells, firstIdx);
    const lastName = cell(cells, lastIdx);
    const email = cell(cells, emailIdx);
    const jobTitle = cell(cells, titleIdx);
    if (!firstName && !lastName && !email) continue;
    if (!firstName || !lastName || !email || !email.includes("@") || !jobTitle) {
      throw new Error(
        `Invalid row: "${line}". firstName, lastName, email, and jobTitle are required.`
      );
    }
    rows.push({
      firstName,
      lastName,
      email,
      jobTitle,
      phone: cell(cells, phoneIdx) || undefined,
      location: cell(cells, locationIdx) || undefined,
      status: cell(cells, statusIdx) || undefined,
      employmentType: cell(cells, typeIdx) || undefined,
      startDate: cell(cells, startIdx) || undefined,
      workEmail: primaryEmailIsWork
        ? email
        : cell(cells, workEmailIdx) || undefined,
      departmentCode: cell(cells, deptCodeIdx) || undefined,
      departmentName: cell(cells, deptNameIdx) || undefined,
    });
  }

  if (rows.length === 0) {
    throw new Error("No employee rows found in CSV");
  }
  return rows;
}

export const EMPLOYEE_CSV_TEMPLATE = [
  "firstName,lastName,email,jobTitle,departmentCode,phone,location,status,employmentType,startDate",
  "Ada,Okello,ada.okello@example.com,Software Engineer,ENG,+254700000000,Nairobi,onboarding,full_time,2026-08-01",
].join("\n");
