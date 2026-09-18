import Image from "next/image";

const DEFAULT_COVER_SRC = "/images/admin-login-cover.png";
const LOGO_SRC = "/bqilogo-light.png";

interface TourBrandHeroProps {
  /** Compact strip for driver.js popovers; taller banner for welcome modal. */
  compact?: boolean;
  /** Per-tour hero; falls back to admin login cover. */
  coverSrc?: string;
}

/** React hero for TourWelcomeModal — cover + navy/cyan scrim. */
export function TourBrandHero({
  compact = false,
  coverSrc = DEFAULT_COVER_SRC,
}: TourBrandHeroProps) {
  return (
    <div
      className={
        compact
          ? "bqi-tour-brand-hero bqi-tour-brand-hero--compact"
          : "bqi-tour-brand-hero"
      }
      aria-hidden
    >
      <Image
        src={coverSrc}
        alt=""
        fill
        sizes="420px"
        className="object-cover object-center"
        priority
      />
      <div className="bqi-tour-brand-hero-scrim" />
      <div className="bqi-tour-brand-hero-fade" />
      <Image
        src={LOGO_SRC}
        alt=""
        width={72}
        height={28}
        className="bqi-tour-brand-hero-logo"
      />
    </div>
  );
}

/** DOM hero for driver.js onPopoverRender — static markup, no user content. */
export function createTourBrandHeroElement(
  compact = true,
  coverSrc = DEFAULT_COVER_SRC
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = compact
    ? "bqi-tour-brand-hero bqi-tour-brand-hero--compact"
    : "bqi-tour-brand-hero";
  root.setAttribute("aria-hidden", "true");

  const cover = document.createElement("img");
  cover.src = coverSrc;
  cover.alt = "";
  cover.className = "bqi-tour-brand-hero-img";
  cover.draggable = false;

  const scrim = document.createElement("div");
  scrim.className = "bqi-tour-brand-hero-scrim";

  const fade = document.createElement("div");
  fade.className = "bqi-tour-brand-hero-fade";

  const logo = document.createElement("img");
  logo.src = LOGO_SRC;
  logo.alt = "";
  logo.className = "bqi-tour-brand-hero-logo";
  logo.width = 72;
  logo.height = 28;
  logo.draggable = false;

  root.append(cover, scrim, fade, logo);
  return root;
}
