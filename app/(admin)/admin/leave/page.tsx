import { redirect } from "next/navigation";

export default function LeaveIndexPage() {
  redirect("/manage/leave/overview");
}
