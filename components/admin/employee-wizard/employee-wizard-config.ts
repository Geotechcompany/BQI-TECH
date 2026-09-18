import {
  Briefcase,
  ClipboardCheck,
  FileText,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type {
  EmployeeDocumentCategory,
  EmployeeStatus,
  EmploymentType,
} from "@/types/employee";

export type EmployeeWizardStepId =
  | "personal"
  | "employment"
  | "compensation"
  | "documents"
  | "review";

export interface WizardStepConfig {
  id: EmployeeWizardStepId;
  label: string;
  icon: LucideIcon;
}

export const EMPLOYEE_WIZARD_STEPS: WizardStepConfig[] = [
  { id: "personal", label: "Personal", icon: User },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "compensation", label: "Compensation", icon: Wallet },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "review", label: "Review & invite", icon: ClipboardCheck },
];

export interface PendingWizardDocument {
  id: string;
  category: EmployeeDocumentCategory;
  label: string;
  /** Custom display name (required for Other) */
  name: string;
  file: File | null;
  required: boolean;
}

export interface EmployeeWizardState {
  avatarFile: File | null;
  avatarPreviewUrl: string;
  firstName: string;
  lastName: string;
  displayName: string;
  pronouns: string;
  dateOfBirth: string;
  gender: string;
  personalEmail: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
  nationality: string;
  maritalStatus: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;

  workEmail: string;
  jobTitle: string;
  jobGrade: string;
  departmentId: string;
  managerId: string;
  location: string;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  startDate: string;
  probationMonths: string;
  workArrangement: string;
  weeklyHours: string;

  baseSalary: string;
  bonusTarget: string;
  signOnBonus: string;
  equityValue: string;
  currency: string;

  documents: PendingWizardDocument[];
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
  bankBranch: string;

  inviteMethod: string;
  inviteTiming: string;
  welcomeMessage: string;
  sendInvite: boolean;
  checklistDocusign: boolean;
  checklistSso: boolean;
  checklistPayroll: boolean;
  checklistBuddy: boolean;
  checklistEquipment: boolean;
  /** Queue DocuSign offer send after create + document upload */
  sendOfferViaDocusign: boolean;
}

export function createDefaultDocuments(): PendingWizardDocument[] {
  return [
    {
      id: "national_id",
      category: "national_id",
      label: "National ID / Government ID",
      name: "National ID",
      file: null,
      required: false,
    },
    {
      id: "good_conduct",
      category: "good_conduct",
      label: "Good Conduct",
      name: "Good Conduct",
      file: null,
      required: false,
    },
    {
      id: "cv",
      category: "cv",
      label: "CV / Resume",
      name: "CV / Resume",
      file: null,
      required: false,
    },
    {
      id: "tax_id",
      category: "tax_id",
      label: "Tax ID / PAN",
      name: "Tax ID / PAN",
      file: null,
      required: false,
    },
    {
      id: "offer_letter",
      category: "contract",
      label: "Offer letter",
      name: "Offer letter",
      file: null,
      required: false,
    },
    {
      id: "other",
      category: "other",
      label: "Custom document",
      name: "",
      file: null,
      required: false,
    },
  ];
}

export function createEmptyEmployeeWizardState(): EmployeeWizardState {
  return {
    avatarFile: null,
    avatarPreviewUrl: "",
    firstName: "",
    lastName: "",
    displayName: "",
    pronouns: "",
    dateOfBirth: "",
    gender: "",
    personalEmail: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    addressCity: "",
    addressState: "",
    addressPostalCode: "",
    addressCountry: "Kenya",
    nationality: "",
    maritalStatus: "",
    emergencyName: "",
    emergencyRelation: "",
    emergencyPhone: "",

    workEmail: "",
    jobTitle: "",
    jobGrade: "",
    departmentId: "",
    managerId: "none",
    location: "Nairobi",
    status: "onboarding",
    employmentType: "full_time",
    startDate: new Date().toISOString().slice(0, 10),
    probationMonths: "3",
    workArrangement: "hybrid",
    weeklyHours: "40",

    baseSalary: "40000",
    bonusTarget: "0",
    signOnBonus: "0",
    equityValue: "0",
    currency: "USD",

    documents: createDefaultDocuments(),
    bankAccountName: "",
    bankAccountNumber: "",
    bankName: "",
    bankBranch: "",

    inviteMethod: "email",
    inviteTiming: "on_start",
    welcomeMessage:
      "Welcome to the team. Your manager will share next steps before your start date.",
    sendInvite: true,
    checklistDocusign: false,
    checklistSso: false,
    checklistPayroll: false,
    checklistBuddy: false,
    checklistEquipment: false,
    sendOfferViaDocusign: false,
  };
}

export function employeeWizardToPayload(state: EmployeeWizardState) {
  const workEmail = state.workEmail.trim().toLowerCase();
  const hasAddress = [
    state.addressLine1,
    state.addressCity,
    state.addressCountry,
  ].some((v) => v.trim());

  const hasEmergency = [
    state.emergencyName,
    state.emergencyRelation,
    state.emergencyPhone,
  ].some((v) => v.trim());

  const hasBank = [
    state.bankAccountName,
    state.bankAccountNumber,
    state.bankName,
  ].some((v) => v.trim());

  const base = Number(state.baseSalary) || 0;
  const bonus = Number(state.bonusTarget) || 0;
  const equity = Number(state.equityValue) || 0;
  const signOn = Number(state.signOnBonus) || 0;

  return {
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    displayName:
      state.displayName.trim() ||
      `${state.firstName.trim()} ${state.lastName.trim()}`.trim() ||
      undefined,
    pronouns: state.pronouns.trim() || undefined,
    gender: state.gender.trim() || undefined,
    maritalStatus: state.maritalStatus.trim() || undefined,
    email: workEmail,
    workEmail,
    personalEmail: state.personalEmail.trim() || undefined,
    phone: state.phone.trim(),
    dateOfBirth: state.dateOfBirth || undefined,
    nationality: state.nationality.trim() || undefined,
    address: hasAddress
      ? {
          line1: state.addressLine1.trim(),
          line2: state.addressLine2.trim() || undefined,
          city: state.addressCity.trim(),
          state: state.addressState.trim() || undefined,
          postalCode: state.addressPostalCode.trim() || undefined,
          country: state.addressCountry.trim(),
        }
      : undefined,
    jobTitle: state.jobTitle.trim(),
    jobGrade: state.jobGrade.trim() || undefined,
    departmentId: state.departmentId || undefined,
    managerId:
      state.managerId !== "none" ? state.managerId || undefined : undefined,
    location: state.location.trim(),
    status: state.status,
    employmentType: state.employmentType,
    startDate: state.startDate,
    probationMonths: state.probationMonths
      ? Number(state.probationMonths) || undefined
      : undefined,
    workArrangement: state.workArrangement.trim() || undefined,
    weeklyHours: state.weeklyHours
      ? Number(state.weeklyHours) || undefined
      : undefined,
    baseSalary: base,
    bonusTarget: bonus,
    signOnBonus: signOn,
    equityValue: equity,
    totalCompensation: base + bonus + equity,
    currency: state.currency || "USD",
    emergencyContact: hasEmergency
      ? {
          name: state.emergencyName.trim(),
          relation: state.emergencyRelation.trim(),
          phone: state.emergencyPhone.trim(),
        }
      : undefined,
    bankDetails: hasBank
      ? {
          accountName: state.bankAccountName.trim(),
          accountNumber: state.bankAccountNumber.trim(),
          bankName: state.bankName.trim(),
          branch: state.bankBranch.trim() || undefined,
        }
      : undefined,
    onboardingChecklist: {
      docusignOffer: state.checklistDocusign,
      sso: state.checklistSso,
      payroll: state.checklistPayroll,
      buddy: state.checklistBuddy,
      equipment: state.checklistEquipment,
    },
    invitePreferences: {
      method: state.inviteMethod,
      timing: state.inviteTiming,
      welcomeMessage: state.welcomeMessage.trim(),
      sendInvite:
        state.inviteMethod === "email" ? state.sendInvite : false,
    },
  };
}

export function validateEmployeeStep(
  step: EmployeeWizardStepId,
  state: EmployeeWizardState
): string | null {
  if (step === "personal") {
    if (!state.firstName.trim() || !state.lastName.trim()) {
      return "First and last name are required.";
    }
  }

  if (step === "employment") {
    if (!state.workEmail.trim()) {
      return "Work email is required.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.workEmail.trim())) {
      return "Enter a valid work email.";
    }
    if (!state.jobTitle.trim()) {
      return "Job title is required.";
    }
    if (!state.startDate) {
      return "Start date is required.";
    }
  }

  if (step === "documents") {
    const custom = state.documents.find((d) => d.id === "other");
    if (custom?.file && !custom.name.trim()) {
      return "Name the custom document before continuing.";
    }
  }

  return null;
}

export function documentsReadyForUpload(state: EmployeeWizardState) {
  return state.documents.filter((doc) => {
    if (!doc.file) return false;
    if (doc.category === "other" && !doc.name.trim()) return false;
    return true;
  });
}
