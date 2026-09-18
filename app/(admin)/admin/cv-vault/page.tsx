import { redirect } from "next/navigation"

export default function CvVaultRedirectPage() {
  redirect("/admin/applicants")
}
