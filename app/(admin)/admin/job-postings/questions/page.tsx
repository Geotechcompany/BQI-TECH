import { redirectAdmin } from "@/lib/admin-path.server";

/** Legacy Questions Management URL — questionnaires live in the job wizard. */
export default function QuestionsRedirectPage() {
  redirectAdmin("/job-postings");
}
