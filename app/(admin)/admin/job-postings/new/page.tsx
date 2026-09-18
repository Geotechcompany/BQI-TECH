"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { publicAdminHref } from "@/lib/admin-path";

export default function LegacyNewJobPostingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(publicAdminHref("/manage/job-postings/wizard"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#31CDFF]" />
    </div>
  );
}
