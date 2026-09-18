import { NotFoundPage } from "@/components/ui/404-page-not-found";

export default function NotFound() {
  return (
    <NotFoundPage
      homeHref="/manage/overview"
      homeLabel="Return to Dashboard"
    />
  );
}
