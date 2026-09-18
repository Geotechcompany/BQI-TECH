"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LegacyEditBlogPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  useEffect(() => {
    if (params.id) {
      router.replace(`/admin/blog-management/${params.id}/wizard`);
    }
  }, [params.id, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#31CDFF]" />
    </div>
  );
}
