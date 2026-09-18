import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface HelpBreadcrumbItem {
  label: string;
  href?: string;
}

interface HelpBreadcrumbsProps {
  items: HelpBreadcrumbItem[];
}

export function HelpBreadcrumbs({ items }: HelpBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[#272055]/70">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#272055]/40" aria-hidden />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-[#2563eb] hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "font-medium text-[#272055]" : undefined}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
