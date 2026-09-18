import { redirectAdmin } from "@/lib/admin-path.server";

export default function CvVaultRedirectPage() {
  redirectAdmin("/applicants");
}
