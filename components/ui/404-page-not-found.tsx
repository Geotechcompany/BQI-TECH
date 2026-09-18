import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Local Dribbble-style 404 GIF — no external CDN at runtime. */
const NOT_FOUND_GIF_SRC = "/images/404-dribbble.gif";

type NotFoundPageProps = {
  homeHref?: string;
  homeLabel?: string;
};

export function NotFoundPage({
  homeHref = "/",
  homeLabel = "Go to Home",
}: NotFoundPageProps) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-white">
      <div className="container mx-auto">
        <div className="flex justify-center">
          <div className="w-full text-center sm:w-10/12 md:w-8/12">
            <div
              className="h-[250px] bg-contain bg-center bg-no-repeat sm:h-[350px] md:h-[400px]"
              style={{ backgroundImage: `url('${NOT_FOUND_GIF_SRC}')` }}
              aria-hidden="true"
            >
              <h1 className="pt-6 text-center text-6xl text-[#272156] sm:pt-8 sm:text-7xl md:text-8xl">
                404
              </h1>
            </div>

            <div className="mt-[-50px]">
              <h3 className="mb-4 text-2xl font-bold text-[#272156] sm:text-3xl">
                Page not found
              </h3>
              <p className="mb-6 text-gray-600 sm:mb-5">
                This page isn&apos;t available.
              </p>

              <Button
                asChild
                variant="default"
                className="my-5 bg-[#272156] text-white hover:bg-[#272156]/90"
              >
                <Link href={homeHref}>{homeLabel}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
