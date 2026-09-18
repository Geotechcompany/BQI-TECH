import type {
  Employee,
  EmployeeAddress,
  EmployeeDocument,
  EmployeeDocumentCategory,
} from "@/types/employee";
import { EMPLOYEE_DOCUMENT_TYPE_OPTIONS } from "@/types/employee";

/** Categories employees are expected to keep on file. */
export const EMPLOYEE_EXPECTED_DOCUMENT_CATEGORIES: EmployeeDocumentCategory[] = [
  "national_id",
  "good_conduct",
  "cv",
  "tax_id",
];

export type MissingProfileField = {
  key: string;
  label: string;
};

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function addressIncomplete(address?: EmployeeAddress | null): boolean {
  if (!address) return true;
  return (
    isBlank(address.line1) ||
    isBlank(address.city) ||
    isBlank(address.country)
  );
}

export function getMissingProfileFields(employee: Employee): MissingProfileField[] {
  const missing: MissingProfileField[] = [];
  if (isBlank(employee.firstName)) missing.push({ key: "firstName", label: "First name" });
  if (isBlank(employee.lastName)) missing.push({ key: "lastName", label: "Last name" });
  if (isBlank(employee.phone)) missing.push({ key: "phone", label: "Phone" });
  if (isBlank(employee.personalEmail)) {
    missing.push({ key: "personalEmail", label: "Personal email" });
  }
  if (isBlank(employee.location)) missing.push({ key: "location", label: "Location" });
  if (addressIncomplete(employee.address)) {
    missing.push({ key: "address", label: "Home address" });
  }
  if (
    isBlank(employee.emergencyContact?.name) ||
    isBlank(employee.emergencyContact?.phone)
  ) {
    missing.push({ key: "emergencyContact", label: "Emergency contact" });
  }
  return missing;
}

export function getMissingDocumentCategories(
  documents: EmployeeDocument[]
): EmployeeDocumentCategory[] {
  const present = new Set(
    documents.map((doc) => doc.category).filter(Boolean)
  );
  return EMPLOYEE_EXPECTED_DOCUMENT_CATEGORIES.filter(
    (category) => !present.has(category)
  );
}

export function documentLabelForCategory(
  category: EmployeeDocumentCategory
): string {
  return (
    EMPLOYEE_DOCUMENT_TYPE_OPTIONS.find((option) => option.id === category)
      ?.label || category
  );
}
