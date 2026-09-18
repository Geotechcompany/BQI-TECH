"use client";

import { useParams } from "next/navigation";
import { BlogSetupWizard } from "@/components/admin/blog-wizard/BlogSetupWizard";

export default function EditBlogWizardPage() {
  const { id } = useParams<{ id: string }>();
  return <BlogSetupWizard postId={id} />;
}
