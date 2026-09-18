import { NotFoundPage } from "@/components/ui/404-page-not-found";

/**
 * Rewrite target for middleware opaque 404s (e.g. direct hits on `/manage`
 * after the public base moved to `/manage`). Renders the same custom UI as
 * `app/not-found.tsx`.
 */
export default function AppOpaqueNotFoundPage() {
  return <NotFoundPage homeHref="/" />;
}
