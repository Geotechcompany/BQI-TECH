"use client";

import { useParams } from "next/navigation";
import { JobSetupWizard } from "@/components/admin/job-wizard/JobSetupWizard";

export default function EditJobWizardPage() {
  const { id } = useParams<{ id: string }>();
  return <JobSetupWizard jobId={id} />;
}
