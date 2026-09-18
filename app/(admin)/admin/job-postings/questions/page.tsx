import { redirect } from "next/navigation";

/** Legacy Questions Management URL — questionnaires live in the job wizard. */
export default function QuestionsRedirectPage() {
  redirect("/manage/job-postings");
}
