import { redirect } from "next/navigation"

export default function CvVaultRedirectPage() {
  redirect("/manage/applicants")
}
