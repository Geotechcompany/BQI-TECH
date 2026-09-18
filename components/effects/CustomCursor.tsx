"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import "./custom-cursor.css";

const ACTIVE_CLASS = "custom-cursor-active";

/** Dot half-size (10px) and ring half-size (36px) for centering. */
const DOT_HALF = 5;
const RING_HALF = 18;

export type CustomCursorProps = {
  /** When false, the custom cursor is not rendered and the system cursor stays. Default true. */
  active?: boolean;
  /** Runs the dashed ring spin animation (busy / loading affordance). */
  spinning?: boolean;
  className?: string;
  /** Dark fill for the center dot. Default `#1c1917`. */
  fillColor?: string;
  /** Light rim / halo so the cursor reads on dark UI. Default `#f4efe3`. */
  rimColor?: string;
  /** Dashed ring stroke. Default `#1c1917`. */
  ringColor?: string;
  /**
   * @deprecated Prefer fillColor / rimColor / ringColor.
   * When set alone, used as the light rim (legacy cream accent).
   */
  color?: string;
};

function lerp(start: number, end: number, amount: number) {
  return (1 - amount) * start + amount * end;
}

/**
 * Only skip on coarse-pointer-only devices (phones/tablets).
 * Hybrid Windows laptops often report maxTouchPoints > 0 but still have a fine pointer —
 * those must keep the custom cursor.
 */
function isCoarsePointerOnly() {
  if (typeof window === "undefined") return false;
  const fine = window.matchMedia("(pointer: fine)").matches;
  if (fine) return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0
  );
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Dual-layer custom cursor: high-contrast dark dot + lerped dashed ring.
 * Mount once at the app root. Applies `cursor: none` on `html` while active.
 * Skips coarse-pointer-only devices and `prefers-reduced-motion`.
 */
export function CustomCursor({
  active = true,
  spinning = false,
  className,
  fillColor = "#1c1917",
  rimColor,
  ringColor = "#1c1917",
  color,
}: CustomCursorProps) {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [leftWindow, setLeftWindow] = useState(false);
  const [clicked, setClicked] = useState(false);

  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const ringPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const resolvedRim = rimColor ?? color ?? "#f4efe3";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !active) {
      setEnabled(false);
      return;
    }

    const syncEnabled = () => {
      setEnabled(!isCoarsePointerOnly() && !prefersReducedMotion());
    };

    syncEnabled();

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia("(pointer: fine)");
    const onCapabilityChange = () => syncEnabled();

    motionQuery.addEventListener("change", onCapabilityChange);
    pointerQuery.addEventListener("change", onCapabilityChange);

    return () => {
      motionQuery.removeEventListener("change", onCapabilityChange);
      pointerQuery.removeEventListener("change", onCapabilityChange);
    };
  }, [mounted, active]);

  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    root.classList.add(ACTIVE_CLASS);

    const onMove = (event: MouseEvent) => {
      mouseRef.current.x = event.clientX;
      mouseRef.current.y = event.clientY;

      if (!initializedRef.current) {
        ringPosRef.current.x = event.clientX;
        ringPosRef.current.y = event.clientY;
        initializedRef.current = true;
      }
    };

    const onWindowEnter = () => setLeftWindow(false);
    const onWindowLeave = () => setLeftWindow(true);
    const onDown = () => setClicked(true);
    const onUp = () => setClicked(false);

    const tick = () => {
      const { x, y } = mouseRef.current;
      const cursor = cursorRef.current;
      const ring = ringRef.current;

      // left/top so the ring's CSS spin animation can own `transform`
      if (cursor) {
        cursor.style.left = `${x - DOT_HALF}px`;
        cursor.style.top = `${y - DOT_HALF}px`;
      }

      ringPosRef.current.x = lerp(ringPosRef.current.x, x, 0.2);
      ringPosRef.current.y = lerp(ringPosRef.current.y, y, 0.2);

      if (ring) {
        ring.style.left = `${ringPosRef.current.x - RING_HALF}px`;
        ring.style.top = `${ringPosRef.current.y - RING_HALF}px`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseenter", onWindowEnter);
    document.documentElement.addEventListener("mouseleave", onWindowLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("touchend", onUp, { passive: true });

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      root.classList.remove(ACTIVE_CLASS);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseenter", onWindowEnter);
      document.documentElement.removeEventListener("mouseleave", onWindowLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("touchend", onUp);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      initializedRef.current = false;
    };
  }, [enabled]);

  if (!mounted || !enabled) return null;

  const style = {
    "--bqi-cursor-fill": fillColor,
    "--bqi-cursor-rim": resolvedRim,
    "--bqi-cursor-ring": ringColor,
  } as CSSProperties;

  return createPortal(
    <div
      ref={cursorRef}
      className={cn(
        "bqi-cursor",
        leftWindow && "hidden",
        clicked && "clicked",
        className
      )}
      style={style}
      aria-hidden
    >
      <div
        ref={ringRef}
        className={cn("bqi-cursor-f", spinning && "is-spinning")}
        style={{
          animationPlayState: spinning ? "running" : "paused",
        }}
        aria-hidden
      />
    </div>,
    document.body
  );
}

export default CustomCursor;
