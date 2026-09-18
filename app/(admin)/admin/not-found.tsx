import { NotFoundPage } from "@/components/ui/404-page-not-found";
import { adminHref } from "@/lib/admin-path";
import { getServerPublicAdminBase } from "@/lib/admin-path.server";

export default function NotFound() {
  return (
    <NotFoundPage
      homeHref={adminHref("/overview", getServerPublicAdminBase())}
      homeLabel="Return to Dashboard"
    />
  );
}
