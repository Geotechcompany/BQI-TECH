import { Suspense } from "react";
import HelpPageClient from "./HelpPageClient";
import { FormSkeleton, ListSkeleton } from "@/components/ui/skeleton";

export default function HelpPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6 p-6 lg:grid-cols-[16rem_1fr]">
          <ListSkeleton items={8} />
          <FormSkeleton />
        </div>
      }
    >
      <HelpPageClient />
    </Suspense>
  );
}
