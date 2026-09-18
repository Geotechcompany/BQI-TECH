"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LegacyNewBlogPostPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/blog-management/wizard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#31CDFF]" />
    </div>
  );
}
