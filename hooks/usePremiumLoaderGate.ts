"use client";

import { useEffect, useRef, useState } from "react";
import {
  AUTH_SETTLE_LOADER_MIN_MS,
  clearPostLoginLoaderFlag,
  hasPostLoginLoaderFlag,
  POST_LOGIN_LOADER_MIN_MS,
} from "@/lib/post-login-loader";

/**
 * Auth hydrates from localStorage in the same tick as mount, so `authLoading`
 * alone is often a single frame. Hold the premium loader until auth settles and
 * a minimum moment has played (longer after login via sessionStorage flag).
 */
export function usePremiumLoaderGate({
  isLoginRoute,
  authLoading,
}: {
  isLoginRoute: boolean;
  authLoading: boolean;
}): boolean {
  const startedAtRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const [holding, setHolding] = useState(() => {
    if (typeof window === "undefined") return false;
    if (isLoginRoute) return false;
    return true;
  });

  const postLoginFlag =
    typeof window !== "undefined" && !isLoginRoute && hasPostLoginLoaderFlag();

  useEffect(() => {
    if (isLoginRoute) {
      startedAtRef.current = null;
      setHolding(false);
      return;
    }

    const isPostLogin = hasPostLoginLoaderFlag();

    if (settledRef.current && !isPostLogin && !authLoading) {
      setHolding(false);
      return;
    }

    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
    }
    setHolding(true);

    if (authLoading) {
      return;
    }

    const minMs = isPostLogin
      ? POST_LOGIN_LOADER_MIN_MS
      : AUTH_SETTLE_LOADER_MIN_MS;
    const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
    const remaining = Math.max(0, minMs - elapsed);

    const timer = window.setTimeout(() => {
      clearPostLoginLoaderFlag();
      startedAtRef.current = null;
      settledRef.current = true;
      setHolding(false);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [authLoading, isLoginRoute]);

  if (isLoginRoute) return false;
  return authLoading || holding || postLoginFlag;
}
